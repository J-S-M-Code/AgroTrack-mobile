import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, IonToolbar, IonContent, IonButtons, IonMenuButton, 
  IonIcon, IonBadge, IonAvatar, IonButton, IonCard, IonCardHeader, 
  IonCardTitle, IonCardSubtitle, IonCardContent, IonTitle, IonSpinner, ViewWillEnter
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { notificationsOutline, locationOutline, cloudOutline, waterOutline } from 'ionicons/icons';
import { FarmService } from '../core/services/farm.service';
import { ContextService } from '../core/services/context.service';
import { Finca } from '../core/models/finca.model';
import { UserService } from '../core/services/user.service';

import { FincaMinimapComponent } from '../shared/components/finca-minimap/finca-minimap.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, IonHeader, IonToolbar, IonContent, IonButtons, 
    IonMenuButton, IonIcon, IonBadge, IonAvatar, IonButton, 
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, 
    IonCardContent, IonTitle, IonSpinner, FincaMinimapComponent
  ],
})
export class HomePage implements ViewWillEnter {
  farmService = inject(FarmService);
  contextService = inject(ContextService);
  userService = inject(UserService);
  cdr = inject(ChangeDetectorRef);
  router = inject(Router);
  
  fincas: Finca[] = [];
  isLoading = true;
  usuarioNombre = '';
  errorMessage = '';

  constructor() {
    addIcons({ notificationsOutline, locationOutline, cloudOutline, waterOutline });
  }

  ionViewWillEnter() {
    // Asegurar que limpiamos el contexto de finca al volver al dashboard
    this.contextService.clearFarmContext();
    this.cargarUsuario();
    this.cargarFincas();
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
