import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/auth/services/auth.service';
import { NetworkService } from '../../../core/services/network.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authServiceMock: {
    hasToken: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
  };
  let networkServiceMock: { isOnlineSnapshot: boolean };

  beforeEach(async () => {
    authServiceMock = {
      hasToken: vi.fn().mockResolvedValue(false),
      login: vi.fn(),
    };
    networkServiceMock = {
      isOnlineSnapshot: true,
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
        { provide: NetworkService, useValue: networkServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('toggles password visibility without altering typed password', () => {
    expect(component.showPassword).toBe(false);
    component.credentials.password = 'AgroTrack951';

    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(true);
    expect(component.credentials.password).toBe('AgroTrack951');

    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(false);
  });

  it('shows invalid credentials message on HTTP 401 and preserves entered inputs', () => {
    authServiceMock.login.mockReturnValue(throwError(() => ({ status: 401 })));
    component.credentials.email = 'productor@agrotrack.com';
    component.credentials.password = 'ClaveErronea9';

    component.onSubmit();

    expect(component.isLoading).toBe(false);
    expect(component.errorMessage).toBe('Correo electrónico o contraseña incorrectos.');
    expect(component.credentials.email).toBe('productor@agrotrack.com');
    expect(component.credentials.password).toBe('ClaveErronea9');
  });

  it('shows offline connectivity message when request fails with status 0', () => {
    networkServiceMock.isOnlineSnapshot = false;
    authServiceMock.login.mockReturnValue(throwError(() => ({ status: 0 })));
    component.credentials.email = 'productor@agrotrack.com';
    component.credentials.password = 'AgroTrack951';

    component.onSubmit();

    expect(component.isLoading).toBe(false);
    expect(component.errorMessage).toBe(
      'Sin conexión o servidor inaccesible. Verificá tu red e intentá nuevamente.'
    );
  });
});
