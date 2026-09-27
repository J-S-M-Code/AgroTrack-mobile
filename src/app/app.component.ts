import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonLabel, IonMenuToggle, IonBadge } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  homeOutline, gridOutline, mapOutline, layersOutline, 
  notificationsOutline, clipboardOutline, leafOutline, 
  pawOutline, settingsOutline, peopleOutline, logOutOutline
} from 'ionicons/icons';
import { AuthService } from './core/auth/services/auth.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonLabel, IonMenuToggle, IonBadge],
})
export class AppComponent {
  authService = inject(AuthService);

  constructor() {
    addIcons({
      homeOutline, gridOutline, mapOutline, layersOutline, 
      notificationsOutline, clipboardOutline, leafOutline, 
      pawOutline, settingsOutline, peopleOutline, logOutOutline
    });
  }

  logout() {
    this.authService.logout();
  }
}
