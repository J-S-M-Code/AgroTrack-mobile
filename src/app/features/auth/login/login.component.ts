import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonItem, IonInput, IonButton, IonIcon, IonLabel, IonList, IonSpinner, IonBadge } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/services/auth.service';
import { addIcons } from 'ionicons';
import { warningOutline, mailOutline, lockClosedOutline, arrowForwardOutline } from 'ionicons/icons';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonItem, IonInput, IonButton, IonIcon, IonLabel, IonList, IonSpinner, IonBadge],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  credentials = {
    email: '',
    password: ''
  };
  isLoading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({
      warningOutline, mailOutline, lockClosedOutline, arrowForwardOutline
    });
  }

  async ngOnInit() {
    const hasToken = await this.authService.hasToken();
    if (hasToken) {
      this.router.navigate(['/home'], { replaceUrl: true });
    }
  }

  onSubmit() {
    if (!this.credentials.email || !this.credentials.password) {
      this.errorMessage = 'Por favor, completa todos los campos.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    
    this.authService.login(this.credentials).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/home'], { replaceUrl: true });
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Credenciales inválidas o error de conexión.';
        console.error('Error en login:', err);
      }
    });
  }
}
