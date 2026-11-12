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
  },
  {
    path: 'novedades',
    loadComponent: () => import('./feature/novedades/novedades.page').then(m => m.NovedadesPage),
    canActivate: [authGuard]
  },
  {
    path: 'novedades/nueva',
    loadComponent: () => import('./feature/novedades/pages/novedad-form/novedad-form.page').then(m => m.NovedadFormPage),
    canActivate: [authGuard]
  },
  {
    path: 'novedades/:id',
    loadComponent: () => import('./feature/novedades/pages/novedad-detalle/novedad-detalle.page').then(m => m.NovedadDetallePage),
    canActivate: [authGuard]
  },
  {
    path: 'tareas',
    loadComponent: () => import('./feature/tareas/tareas.page').then(m => m.TareasPage),
    canActivate: [authGuard]
  },
  {
    path: 'tareas/nueva',
    loadComponent: () => import('./feature/tareas/pages/tarea-form/tarea-form.page').then(m => m.TareaFormPage),
    canActivate: [authGuard]
  },
  {
    path: 'tareas/:id',
    loadComponent: () => import('./feature/tareas/pages/tarea-detalle/tarea-detalle.page').then(m => m.TareaDetallePage),
    canActivate: [authGuard]
  },
  {
    path: 'configuracion',
    loadComponent: () => import('./feature/configuraciones/configuracion.page').then(m => m.ConfiguracionPage),
    canActivate: [authGuard]
  }
];
