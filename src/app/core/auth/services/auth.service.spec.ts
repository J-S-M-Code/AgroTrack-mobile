import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextService } from '../../services/context.service';
import { NetworkService } from '../../services/network.service';
import { AuthService } from './auth.service';

function encodeBase64Url(obj: Record<string, unknown>): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createJwt(expEpochSeconds: number, sub = 'user-123'): string {
  const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeBase64Url({ sub, exp: expEpochSeconds });
  return `${header}.${payload}.signature`;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;
  let contextServiceMock: { clearFarmContext: ReturnType<typeof vi.fn> };
  let networkServiceMock: { isOnlineSnapshot: boolean };

  beforeEach(async () => {
    localStorage.clear();
    await Preferences.clear();

    contextServiceMock = {
      clearFarmContext: vi.fn(),
    };
    networkServiceMock = {
      isOnlineSnapshot: true,
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ContextService, useValue: contextServiceMock },
        { provide: NetworkService, useValue: networkServiceMock },
      ],
    });

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AuthService);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  afterEach(async () => {
    service.ngOnDestroy();
    httpMock.verify();
    vi.useRealTimers();
    localStorage.clear();
    await Preferences.clear();
  });

  it('logs out, clears farm context and redirects to /login when stored token is expired even offline', async () => {
    const expiredToken = createJwt(Math.floor(Date.now() / 1000) - 60);
    await Preferences.set({ key: 'agrotrack_token', value: expiredToken });
    networkServiceMock.isOnlineSnapshot = false;

    const authStates: boolean[] = [];
    const sub = service.authStatus$.subscribe((status) => authStates.push(status));

    const result = await service.refreshTokenIfNeeded();
    sub.unsubscribe();

    expect(result).toBeNull();
    expect(contextServiceMock.clearFarmContext).toHaveBeenCalled();
    expect(authStates[authStates.length - 1]).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
    expect(await service.getToken()).toBeNull();
  });

  it('automatically logs out and redirects to /login when expiration timer reaches exp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));

    const expInFiveSeconds = Math.floor(Date.now() / 1000) + 5;
    const shortToken = createJwt(expInFiveSeconds);

    await service.setToken(shortToken);
    vi.mocked(router.navigate).mockClear();
    contextServiceMock.clearFarmContext.mockClear();

    await vi.advanceTimersByTimeAsync(5500);
    await Promise.resolve();
    await Promise.resolve();

    expect(contextServiceMock.clearFarmContext).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
    expect(await service.getToken()).toBeNull();
  });

  it('logs out when silent refresh returns 401 Unauthorized', async () => {
    const expiringSoonToken = createJwt(Math.floor(Date.now() / 1000) + 3600);
    await service.setToken(expiringSoonToken);
    vi.mocked(router.navigate).mockClear();
    contextServiceMock.clearFarmContext.mockClear();

    const refreshPromise = service.refreshTokenIfNeeded();
    await Promise.resolve();
    await Promise.resolve();

    const req = httpMock.expectOne((r) => r.url.endsWith('/auth/refresh'));
    expect(req.request.method).toBe('POST');
    req.flush(
      { message: 'Token expirado' },
      { status: 401, statusText: 'Unauthorized' }
    );

    const result = await refreshPromise;

    expect(result).toBeNull();
    expect(contextServiceMock.clearFarmContext).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
    expect(await service.getToken()).toBeNull();
  });
});
