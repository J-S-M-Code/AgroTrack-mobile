import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

@Component({
  selector: 'app-novedades',
  templateUrl: './novedades.page.html',
  styleUrls: ['./novedades.page.scss'],
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class NovedadesPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
