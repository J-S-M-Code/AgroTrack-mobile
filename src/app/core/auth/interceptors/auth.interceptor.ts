import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { NetworkService } from '../../services/network.service';
import { EMPTY, TimeoutError, catchError, from, switchMap, tap, throwError, timeout } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const networkService = inject(NetworkService);

  const sendWithTimeout = (request: HttpRequest<unknown>, isPublicRequest = false) => {
    const requestTimeoutMs = request.url.includes('/images') ? 7000 : 3500;
    return next(request).pipe(
      timeout(requestTimeoutMs),
      tap(() => networkService.reportNetworkSuccess()),
      catchError((err) => {
        if (
          err instanceof TimeoutError ||
          err?.name === 'TimeoutError' ||
          (err?.status ?? 0) === 0
        ) {
          networkService.reportNetworkFailure();
          if (err instanceof TimeoutError || err?.name === 'TimeoutError') {
            return throwError(
              () =>
                new HttpErrorResponse({
                  error: err,
                  status: 0,
                  statusText: 'Gateway Timeout / Offline',
                  url: request.url,
                })
            );
          }
        }
        if (!isPublicRequest && err?.status === 401) {
          void authService.logout();
        }
        return throwError(() => err);
      })
    );
  };

  const isAuthPublic =
    req.url.includes('/auth/login') || req.url.includes('/auth/register');

  if (isAuthPublic) {
    return sendWithTimeout(req, true);
  }

  const isRefreshEndpoint = req.url.includes('/auth/refresh');
  const tokenPromise = isRefreshEndpoint
    ? authService.getToken()
    : authService.refreshTokenIfNeeded();

  return from(tokenPromise).pipe(
    switchMap((token) => {
      if (!token) {
        return EMPTY;
      }
      const cloned = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
      return sendWithTimeout(cloned, false);
    })
  );
};
