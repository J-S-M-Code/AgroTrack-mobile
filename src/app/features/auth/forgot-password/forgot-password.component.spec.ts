import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_RECOVERY_CODE } from '../../../core/auth/utils/password-policy.util';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideIonicAngular(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('starts on EMAIL step and rejects invalid email addresses', () => {
    expect(component.step).toBe('EMAIL');

    component.email = 'correo-invalido';
    component.requestCode();

    expect(component.step).toBe('EMAIL');
    expect(component.errorMessage).toBe('Ingresá un correo electrónico válido.');
  });

  it('advances from EMAIL to OTP and starts 60s resend countdown for valid email', () => {
    component.email = 'productor@agrotrack.com';
    component.requestCode();

    expect(component.isLoading).toBe(true);
    vi.advanceTimersByTime(450);

    expect(component.isLoading).toBe(false);
    expect(component.step).toBe('OTP');
    expect(component.resendCountdown).toBe(60);
  });

  it('rejects wrong OTP codes and advances to NEW_PASSWORD with demo code', () => {
    component.step = 'OTP';
    component.otpDigits = ['1', '1', '1', '1', '1', '1'];
    component.verifyCode();

    expect(component.step).toBe('OTP');
    expect(component.errorMessage).toContain(DEMO_RECOVERY_CODE);

    component.fillDemoCode();
    expect(component.otpDigits.join('')).toBe(DEMO_RECOVERY_CODE);

    component.verifyCode();
    vi.advanceTimersByTime(350);

    expect(component.step).toBe('NEW_PASSWORD');
    expect(component.errorMessage).toBe('');
  });

  it('validates backend password rules live and completes recovery on SUCCESS step', () => {
    component.step = 'NEW_PASSWORD';
    component.newPassword = 'Agro12345';
    component.confirmPassword = 'Agro12345';

    expect(component.policy.noIncreasingNumbers).toBe(false);
    expect(component.policy.isAllValid).toBe(false);

    component.newPassword = 'AgroTrack951';
    component.confirmPassword = 'AgroTrack951';

    expect(component.policy.isAllValid).toBe(true);

    component.submitNewPassword();
    vi.advanceTimersByTime(450);

    expect(component.step).toBe('SUCCESS');
    expect(component.isLoading).toBe(false);
  });
});
