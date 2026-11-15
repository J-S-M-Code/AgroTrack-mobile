import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { 
  IonHeader, IonToolbar, IonContent, IonButtons, IonMenuButton, 
  IonIcon, IonBadge, IonAvatar, IonButton, IonCard, IonCardHeader, 
  IonCardTitle, IonCardSubtitle, IonCardContent, IonTitle, IonSpinner, 
  IonModal, IonList, IonItem, ViewWillEnter
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  notificationsOutline, locationOutline, cloudOutline, waterOutline,
  closeOutline, checkmarkCircleOutline, alertCircleOutline, calendarOutline,
  businessOutline
} from 'ionicons/icons';
import { FarmService } from '../core/services/farm.service';
import { ContextService } from '../core/services/context.service';
import { NotificationService } from '../core/services/notification.service';
import { TaskService } from '../core/services/task.service';
import { Finca } from '../core/models/finca.model';
import { Tarea } from '../core/models/tarea.model';
import { UserService } from '../core/services/user.service';

import { FincaMinimapComponent } from '../shared/components/finca-minimap/finca-minimap.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, DatePipe, IonHeader, IonToolbar, IonContent, IonButtons, 
    IonMenuButton, IonIcon, IonBadge, IonAvatar, IonButton, 
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, 
    IonCardContent, IonTitle, IonSpinner, IonModal, IonList, IonItem,
    FincaMinimapComponent
  ],
})
export class HomePage implements ViewWillEnter {
  farmService = inject(FarmService);
  contextService = inject(ContextService);
  notificationService = inject(NotificationService);
  taskService = inject(TaskService);
  userService = inject(UserService);
  cdr = inject(ChangeDetectorRef);
  router = inject(Router);
  
  fincas: Finca[] = [];
  isLoading = true;
  usuarioNombre = '';
  errorMessage = '';

  isNotificacionesModalOpen = false;
  cargandoNotificaciones = false;
  tareasPendientes: Tarea[] = [];

  constructor() {
    addIcons({ 
      notificationsOutline, locationOutline, cloudOutline, waterOutline,
      closeOutline, checkmarkCircleOutline, alertCircleOutline, calendarOutline,
      businessOutline
    });
  }

  ionViewWillEnter() {
    // Asegurar que limpiamos el contexto de finca al volver al dashboard
    this.contextService.clearFarmContext();
    this.notificationService.loadGlobalPendingCounts();
    this.notificationService.syncFarmTaskSubscriptions();
    this.cargarUsuario();
    this.cargarFincas();
  }

  obtenerNombreFinca(tarea: Tarea): string {
    if (tarea.finca && tarea.finca.trim() !== '' && tarea.finca !== tarea.fincaId) {
      return tarea.finca;
    }
    if (tarea.fincaId) {
      const finca = this.fincas.find((f) => String(f.id) === String(tarea.fincaId));
      if (finca?.name) return finca.name;
    }
    return 'Finca';
  }

  abrirModalNotificaciones() {
    this.isNotificacionesModalOpen = true;
    this.cargandoNotificaciones = true;
    this.taskService.getMyAssignedTasks().subscribe({
      next: (tareas) => {
        this.tareasPendientes = (tareas || []).filter(
          (t) => t.rawStatus === 'CREATED'
        );
        this.cargandoNotificaciones = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoNotificaciones = false;
        this.cdr.detectChanges();
      },
    });
  }

  cerrarModalNotificaciones() {
    this.isNotificacionesModalOpen = false;
  }

  marcarNotificacionesLeidas() {
    this.notificationService.resetTasksCount();
    this.notificationService.resetCount();
    this.cerrarModalNotificaciones();
  }

  async abrirTareaDesdeNotificacion(tarea: Tarea) {
    this.cerrarModalNotificaciones();
    if (tarea.fincaId) {
      const fincaEncontrada = this.fincas.find(
        (f) => String(f.id) === String(tarea.fincaId)
      );
      if (fincaEncontrada) {
        this.contextService.setFarmContext(fincaEncontrada);
      } else {
        try {
          const finca = await firstValueFrom(
            this.farmService.getFincaById(tarea.fincaId)
          );
          if (finca) {
            this.contextService.setFarmContext(finca);
          }
        } catch (e) {
          console.warn('No se pudo establecer el contexto de la finca', e);
        }
      }
    }
    this.router.navigate(['/tareas', tarea.id]);
  }

  cargarUsuario() {
    this.userService.getCurrentUser().subscribe({
      next: (user) => {
        this.usuarioNombre = user.name;
        this.cdr.detectChanges(); // Forzar renderizado
      },
      error: (err) => {
        console.error('Error cargando usuario:', err);
        this.cdr.detectChanges();
      }
    });
  }

  cargarFincas() {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();
    
    this.farmService.getFincas().subscribe({
      next: (fincas) => {
        this.fincas = fincas;
        this.isLoading = false;
        this.cdr.detectChanges(); // Forzar renderizado
      },
      error: (err) => {
        console.error('Error cargando fincas:', err);
        this.errorMessage = err.message || 'Error al conectar con el servidor';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  seleccionarFinca(finca: Finca) {
    this.contextService.setFarmContext(finca);
    this.router.navigate(['/mapa']);
  }
}
