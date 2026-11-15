import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  arrowForwardOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  ellipseOutline,
  eyeOffOutline,
  eyeOutline,
  keyOutline,
  lockClosedOutline,
  mailOutline,
  refreshOutline,
  warningOutline,
} from 'ionicons/icons';
import {
  DEMO_RECOVERY_CODE,
  PasswordChecklistState,
  evaluatePasswordPolicy,
} from '../../../core/auth/utils/password-policy.util';

type RecoveryStep = 'EMAIL' | 'OTP' | 'NEW_PASSWORD' | 'SUCCESS';

interface ChecklistViewItem {
  label: string;
  met: boolean;
}

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonContent,
    IonItem,
    IonInput,
    IonButton,
    IonIcon,
    IonLabel,
    IonList,
    IonSpinner,
    IonBadge,
  ],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
})
export class ForgotPasswordComponent implements OnDestroy {
  @ViewChildren('otpBox') otpInputs?: QueryList<ElementRef<HTMLInputElement>>;

  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  step: RecoveryStep = 'EMAIL';
  email = '';
  otpDigits: string[] = ['', '', '', '', '', ''];
  readonly demoCode = DEMO_RECOVERY_CODE;
  resendCountdown = 0;

  newPassword = '';
  confirmPassword = '';
  showNewPassword = false;
  showConfirmPassword = false;

  isLoading = false;
  errorMessage = '';
  infoMessage = '';

  private actionTimer: ReturnType<typeof setTimeout> | null = null;
  private resendInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    addIcons({
      warningOutline,
      mailOutline,
      lockClosedOutline,
      arrowForwardOutline,
      arrowBackOutline,
      eyeOutline,
      eyeOffOutline,
      checkmarkCircle,
      checkmarkCircleOutline,
      ellipseOutline,
      keyOutline,
      refreshOutline,
    });
  }

  get stepSubtitle(): string {
    switch (this.step) {
      case 'EMAIL':
        return 'Recuperación de Contraseña';
      case 'OTP':
        return 'Verificación de Seguridad';
      case 'NEW_PASSWORD':
        return 'Definir Nueva Contraseña';
      case 'SUCCESS':
        return 'Gestión Agrícola Inteligente';
    }
  }

  get isOtpComplete(): boolean {
    return this.otpDigits.every((digit) => /^\d$/.test(digit));
  }

  get policy(): PasswordChecklistState {
    return evaluatePasswordPolicy(this.newPassword, this.confirmPassword);
  }

  get checklistItems(): ChecklistViewItem[] {
    const p = this.policy;
    return [
      { label: 'Mínimo 9 caracteres', met: p.minLength },
      { label: 'Al menos una letra mayúscula', met: p.hasUppercase },
      { label: 'Al menos una letra minúscula', met: p.hasLowercase },
      { label: 'Al menos un número', met: p.hasNumber },
      {
        label: 'Sin secuencias numéricas crecientes (ej. 123)',
        met: p.noIncreasingNumbers,
      },
      { label: 'Las contraseñas coinciden', met: p.passwordsMatch },
    ];
  }

  trackByIndex(index: number): number {
    return index;
  }

  requestCode(): void {
    const trimmedEmail = this.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      this.errorMessage = 'Ingresá un correo electrónico válido.';
      this.cdr.detectChanges();
      return;
    }

    this.email = trimmedEmail;
    this.isLoading = true;
    this.errorMessage = '';
    this.infoMessage = '';
    this.cdr.detectChanges();

    this.scheduleAction(() => {
      this.isLoading = false;
      this.step = 'OTP';
      this.otpDigits = ['', '', '', '', '', ''];
      this.startResendTimer();
      this.cdr.detectChanges();
      this.focusOtpBox(0);
    }, 450);
  }

  fillDemoCode(): void {
    this.applyOtpString(this.demoCode, 0);
  }

  onOtpInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');

    if (digits.length > 1) {
      this.applyOtpString(digits, index);
      return;
    }

    const digit = digits.slice(-1);
    this.otpDigits[index] = digit;
    input.value = digit;
    this.errorMessage = '';
    this.cdr.detectChanges();

    if (digit && index < 5) {
      this.focusOtpBox(index + 1);
    }
  }

  onOtpKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.otpDigits[index] && index > 0) {
      event.preventDefault();
      this.otpDigits[index - 1] = '';
      const prevEl = this.otpInputs?.get(index - 1)?.nativeElement;
      if (prevEl) {
        prevEl.value = '';
      }
      this.focusOtpBox(index - 1);
      this.cdr.detectChanges();
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') ?? '';
    const digits = pasted.replace(/\D/g, '');
    if (digits) {
      this.applyOtpString(digits, 0);
    }
  }

  resendCode(): void {
    if (this.resendCountdown > 0 || this.isLoading) {
      return;
    }
    this.errorMessage = '';
    this.infoMessage = `Nuevo código simulado listo: ${this.demoCode}`;
    this.startResendTimer();
    this.cdr.detectChanges();
  }

  verifyCode(): void {
    if (!this.isOtpComplete) {
      this.errorMessage = 'Completá los 6 dígitos del código.';
      this.cdr.detectChanges();
      return;
    }

    const entered = this.otpDigits.join('');
    if (entered !== this.demoCode) {
      this.errorMessage = `Código incorrecto. En esta Beta podés usar el código demo ${this.demoCode}.`;
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.infoMessage = '';
    this.cdr.detectChanges();

    this.scheduleAction(() => {
      this.isLoading = false;
      this.clearResendTimer();
      this.step = 'NEW_PASSWORD';
      this.cdr.detectChanges();
    }, 350);
  }

  submitNewPassword(): void {
    if (!this.policy.isAllValid || this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.scheduleAction(() => {
      this.isLoading = false;
      this.step = 'SUCCESS';
      this.cdr.detectChanges();
    }, 450);
  }

  changeEmail(): void {
    this.clearActionTimer();
    this.clearResendTimer();
    this.step = 'EMAIL';
    this.isLoading = false;
    this.errorMessage = '';
    this.infoMessage = '';
    this.cdr.detectChanges();
  }

  goToLogin(): void {
    this.clearActionTimer();
    this.clearResendTimer();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  ngOnDestroy(): void {
    this.clearActionTimer();
    this.clearResendTimer();
  }

  private applyOtpString(digits: string, startIndex: number): void {
    let lastFilled = startIndex;
    for (let offset = 0; offset < digits.length && startIndex + offset < 6; offset++) {
      const targetIndex = startIndex + offset;
      this.otpDigits[targetIndex] = digits[offset];
      const box = this.otpInputs?.get(targetIndex)?.nativeElement;
      if (box) {
        box.value = digits[offset];
      }
      lastFilled = targetIndex;
    }
    this.errorMessage = '';
    this.cdr.detectChanges();
    const nextIndex = Math.min(lastFilled + 1, 5);
    this.focusOtpBox(nextIndex);
  }

  private focusOtpBox(index: number): void {
    const target = this.otpInputs?.get(index)?.nativeElement;
    if (target) {
      target.focus();
      target.select();
    }
  }

  private scheduleAction(callback: () => void, delayMs: number): void {
    this.clearActionTimer();
    this.actionTimer = setTimeout(() => {
      this.actionTimer = null;
      callback();
    }, delayMs);
  }

  private startResendTimer(): void {
    this.clearResendTimer();
    this.resendCountdown = 60;
    this.resendInterval = setInterval(() => {
      if (this.resendCountdown > 0) {
        this.resendCountdown -= 1;
        this.cdr.detectChanges();
      }
      if (this.resendCountdown <= 0) {
        this.clearResendTimer();
      }
    }, 1000);
  }

  private clearActionTimer(): void {
    if (this.actionTimer !== null) {
      clearTimeout(this.actionTimer);
      this.actionTimer = null;
    }
  }

  private clearResendTimer(): void {
    if (this.resendInterval !== null) {
      clearInterval(this.resendInterval);
      this.resendInterval = null;
    }
  }
}
