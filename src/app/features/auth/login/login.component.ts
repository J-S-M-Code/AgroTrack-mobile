import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonItem, IonInput, IonButton, IonIcon, IonLabel, IonList, IonSpinner, IonBadge } from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/services/auth.service';
import { NetworkService } from '../../../core/services/network.service';
import { addIcons } from 'ionicons';
import { warningOutline, mailOutline, lockClosedOutline, arrowForwardOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonContent, IonItem, IonInput, IonButton, IonIcon, IonLabel, IonList, IonSpinner, IonBadge],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private networkService = inject(NetworkService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  credentials = {
    email: '',
    password: ''
  };
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  constructor() {
    addIcons({
      warningOutline, mailOutline, lockClosedOutline, arrowForwardOutline, eyeOutline, eyeOffOutline
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
    this.cdr.detectChanges();
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
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();
    
    this.authService.login(this.credentials).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
        this.router.navigate(['/home'], { replaceUrl: true });
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = this.resolveLoginErrorMessage(err);
        console.error('Error en login:', err);
        this.cdr.detectChanges();
      }
    });
  }

  private resolveLoginErrorMessage(err: any): string {
    if (!this.networkService.isOnlineSnapshot || !err?.status || err.status === 0) {
      return 'Sin conexión o servidor inaccesible. Verificá tu red e intentá nuevamente.';
    }
    if (err.status === 429) {
      return 'Demasiados intentos de inicio de sesión. Esperá un minuto antes de reintentar.';
    }
    if (err.status === 401 || err.status === 403 || err.status === 400) {
      return 'Correo electrónico o contraseña incorrectos.';
    }
    return err?.error?.message || err?.error?.error || 'No se pudo iniciar sesión. Intentá nuevamente.';
  }
}
