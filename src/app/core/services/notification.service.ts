import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Subject,
  Subscription,
  combineLatest,
  firstValueFrom,
} from 'rxjs';
import { map } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { WebsocketService } from './websocket.service';
import { ContextService } from './context.service';
import { AlertService } from './alert.service';
import { TaskService } from './task.service';
import { PermissionService } from './permission.service';
import { AuthService } from '../auth/services/auth.service';
import { FarmService } from './farm.service';
import { Novedad } from '../models/novedad.model';
import { Tarea } from '../models/tarea.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  private websocketService = inject(WebsocketService);
  private contextService = inject(ContextService);
  private alertService = inject(AlertService);
  private taskService = inject(TaskService);
  private farmService = inject(FarmService);
  private permissionService = inject(PermissionService);
  private authService = inject(AuthService);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private unreadTasksCountSubject = new BehaviorSubject<number>(0);
  public unreadTasksCount$ = this.unreadTasksCountSubject.asObservable();

  public totalUnreadCount$ = combineLatest([
    this.unreadCount$,
    this.unreadTasksCount$,
  ]).pipe(map(([alerts, tasks]) => alerts + tasks));

  private incomingAlertSubject = new Subject<Novedad>();
  public incomingAlert$ = this.incomingAlertSubject.asObservable();

  private incomingTaskSubject = new Subject<Tarea>();
  public incomingTask$ = this.incomingTaskSubject.asObservable();

  private contextSub?: Subscription;
  private currentAlertsSub?: Subscription;
  private taskSubscriptions: Map<string, Subscription> = new Map();
  private farmsCache: Map<string, string> = new Map();
  private currentFarmId: string | null = null;
  private notificationSeq = Math.floor(Date.now() % 100000);
  private isAppActive = true;

  private readonly onVisibilityChange = () => {
    if (typeof document !== 'undefined') {
      this.isAppActive = document.visibilityState === 'visible';
    }
  };

  constructor() {
    this.initAppStateTracking();
    this.initNativeNotificationsListener();
    this.loadGlobalPendingCounts();
    this.syncFarmTaskSubscriptions();

    this.contextSub = this.contextService.selectedFarm$.subscribe((farm) => {
      const nextFarmId = farm?.id || null;
      if (nextFarmId !== this.currentFarmId) {
        this.currentAlertsSub?.unsubscribe();
        this.currentFarmId = nextFarmId;

        if (nextFarmId) {
          this.resetCount();
          this.permissionService.ensureNotificationPermission().catch(() => {});
          this.verificarPendientesAlConectar(nextFarmId);

          this.currentAlertsSub = this.websocketService
            .watchAlerts(nextFarmId)
            .subscribe(async (rawAlert) => {
              const mapped = this.alertService.mapAlert(rawAlert);
              this.incomingAlertSubject.next(mapped);

              const currentUserId = await this.authService.getUserId();
              await this.actualizarUltimoVisto(
                'alert',
                currentUserId,
                nextFarmId
              );

              const isOwnAlert =
                !!currentUserId &&
                !!mapped.authorId &&
                String(mapped.authorId) === String(currentUserId);

              if (!isOwnAlert) {
                this.incrementCount();
                const farmName = farm?.name || 'Finca';
                const header = `[${farmName}] ${
                  mapped.tipo === 'Alerta'
                    ? `Nueva Alerta (${mapped.prioridad})`
                    : 'Nueva Nota de Campo'
                }`;
                if (this.isAppInForeground()) {
                  this.presentAlertToast(mapped, farmName);
                } else {
                  this.scheduleNativeNotification(
                    header,
                    `${mapped.titulo}${mapped.origen ? ' · ' + mapped.origen : ''}`,
                    `/novedades/${mapped.id}`,
                    nextFarmId
                  );
                }
              }
            });
        } else {
          this.resetCount();
          this.loadGlobalPendingCounts();
          this.syncFarmTaskSubscriptions();
        }
      }
    });
  }

  /**
   * Sincroniza suscripciones de WebSocket a los tópicos de tareas de TODAS las fincas del usuario.
   * Permite recibir avisos push/toast de cualquier finca aunque el usuario esté en el Home u otra finca.
   */
  public async syncFarmTaskSubscriptions() {
    try {
      const fincas = await firstValueFrom(this.farmService.getFincas());
      const currentUserId = await this.authService.getUserId();
      if (!currentUserId || !fincas) return;

      fincas.forEach((f) => {
        if (f.id && f.name) {
          this.farmsCache.set(String(f.id), f.name);
        }
      });

      const currentIds = new Set(fincas.map((f) => String(f.id)));

      // Desuscribir fincas ya no disponibles
      for (const [farmId, sub] of this.taskSubscriptions.entries()) {
        if (!currentIds.has(farmId)) {
          sub.unsubscribe();
          this.taskSubscriptions.delete(farmId);
        }
      }

      // Suscribir a cada finca asignada
      for (const farm of fincas) {
        const farmId = String(farm.id);
        if (!this.taskSubscriptions.has(farmId)) {
          const sub = this.websocketService
            .watchTasks(farmId)
            .subscribe(async (rawTask) => {
              const mapped = this.taskService.mapTask(rawTask);
              this.incomingTaskSubject.next(mapped);

              const userId = await this.authService.getUserId();
              await this.actualizarUltimoVisto('task', userId, farmId);

              const isAssignedToMe =
                !!userId &&
                !!mapped.responsableId &&
                String(mapped.responsableId) === String(userId);

              // Solo notificar al asignado cuando se crea/asigna la tarea
              if (isAssignedToMe && mapped.rawStatus === 'CREATED') {
                this.incrementTasksCount();
                const farmName = this.obtenerNombreFinca(mapped, farmId);
                const header = `[${farmName}] Nueva Tarea (${mapped.prioridad})`;

                if (this.isAppInForeground()) {
                  this.presentTaskToast(mapped, header, farmName);
                } else {
                  const body = `${mapped.titulo}${
                    mapped.lote ? ' · Lote: ' + mapped.lote : ' · Área General'
                  } (${mapped.accionLabel})`;
                  this.scheduleNativeNotification(
                    header,
                    body,
                    `/tareas/${mapped.id}`,
                    farmId
                  );
                }
              }
            });
          this.taskSubscriptions.set(farmId, sub);
        }
      }
    } catch {
      // Ignorar errores de conexión inicial
    }
  }

  public obtenerNombreFinca(tarea: Tarea, farmId?: string): string {
    if (tarea.finca && tarea.finca.trim() !== '' && tarea.finca !== tarea.fincaId) {
      return tarea.finca;
    }
    const id = tarea.fincaId || farmId;
    if (id && this.farmsCache.has(String(id))) {
      return this.farmsCache.get(String(id))!;
    }
    return 'Finca';
  }

  /**
   * Actualiza el conteo de tareas pendientes asignadas al usuario para la finca conectada.
   * NO dispara Toasts automáticos (las tareas pendientes se consultan desde la campanita).
   */
  private async verificarPendientesAlConectar(farmId: string) {
    try {
      const currentUserId = await this.authService.getUserId();
      if (!currentUserId || !farmId) return;

      const misTareas = await firstValueFrom(
        this.taskService.getMyAssignedTasks(farmId)
      );
      const pendientes = misTareas.filter(
        (t) =>
          t.rawStatus === 'CREATED' &&
          String(t.responsableId) === String(currentUserId)
      );

      this.unreadTasksCountSubject.next(pendientes.length);
    } catch {
      // Ignorar errores de sincronización inicial
    }
  }

  /**
   * Carga el conteo global de todas las tareas pendientes asignadas al usuario
   * para reflejarlo en la campanita de la página principal (Home).
   */
  public async loadGlobalPendingCounts() {
    try {
      const currentUserId = await this.authService.getUserId();
      if (!currentUserId) return;

      const misTareas = await firstValueFrom(
        this.taskService.getMyAssignedTasks()
      );
      const pendientes = misTareas.filter(
        (t) =>
          t.rawStatus === 'CREATED' &&
          String(t.responsableId) === String(currentUserId)
      );

      this.unreadTasksCountSubject.next(pendientes.length);
    } catch {
      // Ignorar errores de sincronización inicial
    }
  }

  private async actualizarUltimoVisto(
    type: 'task' | 'alert',
    userId: string | null,
    farmId: string
  ) {
    if (!userId || !farmId) return;
    const key = `last_seen_${type}_${userId}_${farmId}`;
    await Preferences.set({ key, value: String(Date.now()) }).catch(() => {});
  }

  private async initAppStateTracking() {
    if (typeof document !== 'undefined') {
      this.isAppActive = document.visibilityState === 'visible';
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const state = await App.getState();
        this.isAppActive = state.isActive;
        await App.addListener('appStateChange', ({ isActive }) => {
          this.isAppActive = isActive;
        });
      } catch {
        // Ignorar si no está disponible
      }
    }
  }

  private isAppInForeground(): boolean {
    const docVisible =
      typeof document === 'undefined' || document.visibilityState === 'visible';
    return this.isAppActive && docVisible;
  }

  private async initNativeNotificationsListener() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        async (event) => {
          const targetRoute = event?.notification?.extra?.route;
          const farmId = event?.notification?.extra?.farmId;
          if (farmId) {
            try {
              const finca = await firstValueFrom(
                this.farmService.getFincaById(farmId)
              );
              if (finca) {
                this.contextService.setFarmContext(finca);
              }
            } catch {
              // Si falla obtener la finca, continúa la navegación
            }
          }
          if (targetRoute && typeof targetRoute === 'string') {
            this.ngZone.run(() => {
              this.router.navigateByUrl(targetRoute);
            });
          }
        }
      );
    } catch {
      // Ignorar si el plugin no está disponible en entorno web
    }
  }

  private async scheduleNativeNotification(
    title: string,
    body: string,
    route: string,
    farmId?: string
  ) {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const granted =
        await this.permissionService.ensureNotificationPermission();
      if (!granted) return;

      this.notificationSeq = (this.notificationSeq + 1) % 2147483000;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationSeq,
            title,
            body,
            smallIcon: 'ic_stat_agrotrack',
            largeIcon: 'ic_agrotrack_logo',
            iconColor: '#0d8a5c',
            extra: { route, farmId },
          },
        ],
      });
    } catch {
      // Ignorar errores de notificación nativa
    }
  }

  private async presentAlertToast(novedad: Novedad, farmName?: string) {
    try {
      const prefix = farmName ? `[${farmName}] ` : '';
      const toast = await this.toastCtrl.create({
        header:
          novedad.tipo === 'Alerta'
            ? `${prefix}Nueva Alerta (${novedad.prioridad})`
            : `${prefix}Nueva Nota de Campo`,
        message: novedad.titulo,
        duration: 4000,
        position: 'top',
        color: novedad.tipo === 'Alerta' ? 'warning' : 'primary',
        icon:
          novedad.tipo === 'Alerta'
            ? 'warning-outline'
            : 'document-text-outline',
        buttons: [
          {
            text: 'Ver',
            handler: () => {
              this.router.navigate(['/novedades', novedad.id]);
            },
          },
        ],
      });
      await toast.present();
    } catch {
      // Ignorar si no hay vista activa
    }
  }

  private async presentTaskToast(tarea: Tarea, header: string, farmName?: string) {
    try {
      const locationText = tarea.lote ? ` · Lote: ${tarea.lote}` : ' · Área General';
      const toast = await this.toastCtrl.create({
        header,
        message: `${tarea.titulo} (${tarea.accionLabel})${locationText}`,
        duration: 4500,
        position: 'top',
        color: tarea.rawPriority === 'HIGH' ? 'danger' : 'primary',
        icon: 'clipboard-outline',
        buttons: [
          {
            text: 'Abrir',
            handler: () => {
              if (tarea.fincaId) {
                this.farmService.getFincaById(tarea.fincaId).subscribe({
                  next: (finca) => this.contextService.setFarmContext(finca),
                  error: () => {},
                });
              }
              this.router.navigate(['/tareas', tarea.id]);
            },
          },
        ],
      });
      await toast.present();
    } catch {
      // Ignorar si no hay vista activa
    }
  }

  public incrementCount() {
    this.unreadCountSubject.next(this.unreadCountSubject.value + 1);
  }

  public resetCount() {
    this.unreadCountSubject.next(0);
  }

  public incrementTasksCount() {
    this.unreadTasksCountSubject.next(this.unreadTasksCountSubject.value + 1);
  }

  public resetTasksCount() {
    this.unreadTasksCountSubject.next(0);
  }

  ngOnDestroy() {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.contextSub?.unsubscribe();
    this.currentAlertsSub?.unsubscribe();
    for (const sub of this.taskSubscriptions.values()) {
      sub.unsubscribe();
    }
    this.taskSubscriptions.clear();
  }
}
