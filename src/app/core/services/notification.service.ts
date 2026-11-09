import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { ToastController } from '@ionic/angular';
import { WebsocketService } from './websocket.service';
import { ContextService } from './context.service';
import { AlertService } from './alert.service';
import { Novedad } from '../models/novedad.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  private websocketService = inject(WebsocketService);
  private contextService = inject(ContextService);
  private alertService = inject(AlertService);
  private toastCtrl = inject(ToastController);

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private incomingAlertSubject = new Subject<Novedad>();
  public incomingAlert$ = this.incomingAlertSubject.asObservable();

  private contextSub?: Subscription;
  private currentFarmSub?: Subscription;
  private currentFarmId: string | null = null;

  constructor() {
    this.contextSub = this.contextService.selectedFarm$.subscribe((farm) => {
      const nextFarmId = farm?.id || null;
      if (nextFarmId !== this.currentFarmId) {
        this.currentFarmSub?.unsubscribe();
        this.currentFarmId = nextFarmId;
        this.resetCount();

        if (nextFarmId) {
          this.currentFarmSub = this.websocketService
            .watchAlerts(nextFarmId)
            .subscribe((rawAlert) => {
              const mapped = this.alertService.mapAlert(rawAlert);
              this.incrementCount();
              this.incomingAlertSubject.next(mapped);
              this.presentAlertToast(mapped);
            });
        }
      }
    });
  }

  public incrementCount() {
    this.unreadCountSubject.next(this.unreadCountSubject.value + 1);
  }

  public resetCount() {
    this.unreadCountSubject.next(0);
  }

  private async presentAlertToast(novedad: Novedad) {
    try {
      const toast = await this.toastCtrl.create({
        header:
          novedad.tipo === 'Alerta'
            ? `Nueva Alerta (${novedad.prioridad})`
            : 'Nueva Nota de Campo',
        message: novedad.titulo,
        duration: 3500,
        position: 'top',
        color: novedad.tipo === 'Alerta' ? 'warning' : 'primary',
        icon:
          novedad.tipo === 'Alerta'
            ? 'warning-outline'
            : 'document-text-outline',
      });
      await toast.present();
    } catch {
      // Ignorar si no hay vista activa para mostrar toast
    }
  }

  ngOnDestroy() {
    this.contextSub?.unsubscribe();
    this.currentFarmSub?.unsubscribe();
  }
}
