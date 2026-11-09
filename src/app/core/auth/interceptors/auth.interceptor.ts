import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { from, switchMap } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const isAuthPublic =
    req.url.includes('/auth/login') || req.url.includes('/auth/register');

  if (isAuthPublic) {
    return next(req);
  }

  const isRefreshEndpoint = req.url.includes('/auth/refresh');
  const tokenPromise = isRefreshEndpoint
    ? authService.getToken()
    : authService.refreshTokenIfNeeded();

  return from(tokenPromise).pipe(
    switchMap((token) => {
      if (token) {
        const cloned = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        });
        return next(cloned);
      }
      return next(req);
    })
  );
};
