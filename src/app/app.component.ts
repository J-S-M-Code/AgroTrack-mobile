import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonLabel, IonMenuToggle, IonBadge } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  homeOutline, gridOutline, mapOutline, layersOutline, 
  notificationsOutline, clipboardOutline, leafOutline, 
  pawOutline, settingsOutline, peopleOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonLabel, IonMenuToggle, IonBadge],
})
export class AppComponent {
  constructor() {
    addIcons({
      homeOutline, gridOutline, mapOutline, layersOutline, 
      notificationsOutline, clipboardOutline, leafOutline, 
      pawOutline, settingsOutline, peopleOutline
    });
  }
}
