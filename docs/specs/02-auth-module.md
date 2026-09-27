# Spec 02: Autenticación y Estructura Base (Mobile)

## 1. Objetivo
Establecer la estructura de directorios principal (`core/`, `shared/`, `features/`) de acuerdo al estándar utilizado en el proyecto web de AgroTrack, y desarrollar la primera funcionalidad funcional: el Login (Autenticación), adaptado a la experiencia móvil utilizando los componentes UI de Ionic.

## 2. Estructura de Directorios a Crear
Se implementará la siguiente estructura física dentro de `src/app/`:

- `core/`: 
  - `services/`: Para servicios singleton como `AuthService`.
  - `interceptors/`: Para `auth.interceptor.ts`.
  - `guards/`: Para proteger rutas (ej. `auth-guard.ts`).
- `shared/`: Para componentes de UI genéricos, pipes o directivas que se usarán en toda la app móvil.
- `features/auth/` (o respetando la ruta web `core/auth/pages/login` si prefieres idéntica estructura): Contendrá el componente visual de Login.

## 3. Módulo de Autenticación (Login)
- **Servicio (`AuthService`):**
  - Mantener la misma interfaz del frontend web: métodos `login()`, `logout()`, `hasToken()`, `getToken()`.
  - Uso de `HttpClient` y `BehaviorSubject` para propagar el estado de autenticación de forma reactiva.
- **Componente Visual (`LoginComponent`):**
  - Refactorizar el HTML para reemplazar las etiquetas estándar de HTML por componentes Ionic: `ion-content`, `ion-item`, `ion-input`, `ion-button`, `ion-icon`.
  - Simplificar la UI móvil para enfocar exclusivamente en el formulario (eliminando el banner dividido de la web).
- **Gestión de Estado y Rutas:**
  - Integrar el componente a las rutas (`app.routes.ts`).
  - Redirección automática hacia `/dashboard` (o inicio) tras la autenticación exitosa, al igual que en la web.

## 4. Pasos de Implementación
1. Crear el árbol de carpetas.
2. Adaptar el `AuthService` al entorno móvil.
3. Crear el `LoginComponent` Standalone con diseño Ionic.
4. Ajustar el sistema de rutas para que el login sea la vista inicial si no hay token activo.
