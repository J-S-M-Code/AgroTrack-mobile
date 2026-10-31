import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './core/auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'mapa',
    loadComponent: () => import('./feature/mapa/mapa.page').then(m => m.MapaPage),
    canActivate: [authGuard]
  },
  {
    path: 'cultivos',
    loadComponent: () => import('./feature/cultivos/cultivos.page').then(m => m.CultivosPage),
    canActivate: [authGuard]
  },
  {
    path: 'cultivos/nuevo',
    loadComponent: () => import('./feature/cultivos/pages/cultivo-form/cultivo-form.page').then(m => m.CultivoFormPage),
    canActivate: [authGuard]
  },
  {
    path: 'cultivos/editar/:id',
    loadComponent: () => import('./feature/cultivos/pages/cultivo-form/cultivo-form.page').then(m => m.CultivoFormPage),
    canActivate: [authGuard]
  },
  {
    path: 'cultivos/:id',
    loadComponent: () => import('./feature/cultivos/pages/cultivo-detalle/cultivo-detalle.page').then(m => m.CultivoDetallePage),
    canActivate: [authGuard]
  }
];
