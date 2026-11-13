import { Component, ChangeDetectorRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonApp,
  IonRouterOutlet,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonMenuToggle,
  IonBadge,
  IonModal,
  IonButtons,
  IonButton,
  IonSpinner,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  gridOutline,
  mapOutline,
  layersOutline,
  notificationsOutline,
  clipboardOutline,
  leafOutline,
  pawOutline,
  settingsOutline,
  peopleOutline,
  logOutOutline,
  warningOutline,
  documentTextOutline,
  cloudOfflineOutline,
  cloudDoneOutline,
  syncOutline,
  refreshOutline,
  trashOutline,
  checkmarkCircleOutline,
  closeOutline,
} from 'ionicons/icons';
import { AuthService } from './core/auth/services/auth.service';
import { ContextService } from './core/services/context.service';
import { NotificationService } from './core/services/notification.service';
import { NetworkService } from './core/services/network.service';
import { SyncService } from './core/services/sync.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonApp,
    IonRouterOutlet,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonMenuToggle,
    IonBadge,
    IonModal,
    IonButtons,
    IonButton,
    IonSpinner,
  ],
})
export class AppComponent {
  @ViewChild('syncModal') syncModal?: IonModal;

  authService = inject(AuthService);
  contextService = inject(ContextService);
  notificationService = inject(NotificationService);
  networkService = inject(NetworkService);
  syncService = inject(SyncService);
  private cdr = inject(ChangeDetectorRef);

  syncModalAbierto = false;

  constructor() {
    addIcons({
      homeOutline,
      gridOutline,
      mapOutline,
      layersOutline,
      notificationsOutline,
      clipboardOutline,
      leafOutline,
      pawOutline,
      settingsOutline,
      peopleOutline,
      logOutOutline,
      warningOutline,
      documentTextOutline,
      cloudOfflineOutline,
      cloudDoneOutline,
      syncOutline,
      refreshOutline,
      trashOutline,
      checkmarkCircleOutline,
      closeOutline,
    });
  }

  goToFincas() {
    this.contextService.clearFarmContext();
  }

  abrirModalSync() {
    this.syncModalAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalSync() {
    this.syncModalAbierto = false;
    this.cdr.detectChanges();
    void this.syncModal?.dismiss();
  }

  sincronizarAhora() {
    void this.syncService.processQueue();
  }

  reintentarOperacion(id: string) {
    void this.syncService.retryOperation(id);
  }

  descartarOperacion(id: string) {
    void this.syncService.discardOperation(id);
  }

  logout() {
    this.contextService.clearFarmContext();
    this.authService.logout();
  }
}
