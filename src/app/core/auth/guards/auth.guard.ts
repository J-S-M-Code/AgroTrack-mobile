import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const hasToken = await authService.hasToken();
  if (!hasToken) {
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  }
  return true;
};

export const noAuthGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const hasToken = await authService.hasToken();
  if (hasToken) {
    router.navigate(['/home'], { replaceUrl: true });
    return false;
  }
  return true;
};
