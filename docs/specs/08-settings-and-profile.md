# Spec 08: Módulo de Ajustes, Perfil de Usuario, Diagnóstico de Dispositivo, Gestión de Fincas y Collares IoT

**Status:** Finished  
**Date:** 2026-11-11  
**Target Repository:** `AgroTrack Mobile`  
**Target Branch:** `feature/configuracion`  

## 1. Objetivo
Implementar el módulo completo de **Ajustes y Configuración (`Settings & Profile`)** en la aplicación móvil con paridad funcional frente a la plataforma Web y arquitectura **Online-First con Resiliencia Offline**:
1. **Perfil de Usuario y Credenciales (Carga Instantánea 0ms):** Snapshot en memoria RAM (`currentUserSnapshot`) y caché local (`agrotrack_user_profile` en `@capacitor/preferences`) combinados con revalidación en segundo plano (`GET /api/v1/users/me`), modo edición explícito (`PUT /api/v1/users/me`), cambio seguro de contraseña (`PUT /api/v1/users/me/password`) y detección de cambios explícita (`ChangeDetectorRef.detectChanges()`) para Angular 22 Zoneless.
2. **Preferencias de Campo y Auditoría de Sensores Nativos:** Configuración persistente de unidades agronómicas (`ha`/`ac`, `°C`/`°F`), modo de alto contraste para lectura bajo luz solar directa, y diagnóstico en vivo de permisos nativos (`@capacitor/camera`, `@capacitor/geolocation` y `@capacitor/local-notifications`).
3. **Gestión de Fincas:** Listado de establecimientos vinculados a la cuenta con edición de datos legales/agronómicos (`PUT /api/v1/farms/{id}`) y baja segura con confirmación de CUIT y motivo obligatorio (`DELETE /api/v1/farms/{id}`) para usuarios `OWNER`.
4. **Gestión de Collares IoT:** Inventario de collares de monitoreo por establecimiento (`GET /api/v1/farms/{farmId}/collars` con respaldo en caché local), registro de nuevo hardware (`POST /api/v1/farms/{farmId}/collars`), edición (`PUT /api/v1/collars/{id}`) y baja con advertencia de caravana asignada y confirmación por código RFID (`DELETE /api/v1/collars/{id}`) para roles `OWNER` y `FOREMAN`.
5. **Cierre de Sesión Seguro:** Logout con confirmación nativa (`AlertController`), limpieza de tokens en memoria/preferencias y reseteo del contexto activo.

---

## 2. Dependencias, Modelos y Servicios en la App Móvil

### 2.1. Modelos (`src/app/core/models/`)
- `user.model.ts`:
  - `UpdateProfileDto`: `{ name: string; lastName: string; phone?: string; address?: string }`.
  - `UpdatePasswordDto`: `{ currentPassword: string; newPassword: string }`.
  - `UserPreferences`: `{ unidadSuperficie: 'ha' | 'ac'; unidadTemperatura: 'C' | 'F'; altoContraste: boolean; notificacionesLocales: boolean }`.
- `collar.model.ts`:
  - `CollarEstadoLabel`: `'Disponible' | 'Asignado' | 'En Reparación'`.
  - `CollarStateBackend`: `'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE'`.
  - `Collar`: `{ id, rfid, modelo, estado, rawState, bateria, assignedAnimalCaravan }`.

### 2.2. Servicios (`src/app/core/services/`)
- `auth.service.ts`:
  - Caché en memoria (`memoryToken`, `memoryUserId`) para evitar llamadas repetitivas al puente nativo de `@capacitor/preferences` en cada petición interceptada por `authInterceptor`.
- `user.service.ts` (Online-First + Snapshot Instantáneo):
  - `currentUserSnapshot`: Devuelve inmediatamente el perfil en memoria (0ms) para evitar esperas al abrir la vista de Perfil.
  - `getCurrentUser()`: Petición a `GET /api/v1/users/me` que actualiza RAM y `@capacitor/preferences`, haciendo fallback transparente a la caché si no hay red.
  - `updateMyProfile(data)` y `updateMyPassword(data)`.
- `collar.service.ts` (Online-First con Caché por Finca):
  - `getCollarsByFarm(farmId)`: Consulta `GET /api/v1/farms/{farmId}/collars`, guarda en `agrotrack_collars_{farmId}` y responde con la caché si el dispositivo está sin señal.
  - `createCollar(farmId, collar)` → `POST /api/v1/farms/{farmId}/collars`.
  - `updateCollar(id, farmId, updates)` → `PUT /api/v1/collars/{id}?farmId={farmId}`.
  - `deleteCollar(id, farmId, reason)` → `DELETE /api/v1/collars/{id}?farmId={farmId}`.
- `permission.service.ts` y `preferences.service.ts`:
  - Diagnóstico unificado `checkAllPermissions()` y persistencia de preferencias agronómicas.

---

## 3. UI, Experiencia Móvil e Interfaces de Usuario (`src/app/feature/configuraciones/`)

### 3.1. Página Principal de Ajustes (`configuracion.page.ts / .html / .scss` — Ruta `/configuracion`)
- **Segmentos de Navegación (`ion-segment`):**
  1. **Perfil (`perfil`)**:
     - Renderizado inmediato desde caché/snapshot + actualización silenciosa.
     - Modo lectura con botón *"Editar"* para habilitar la modificación de Nombre, Apellido, Teléfono y Dirección.
     - Sección desplegable *"Cambiar Contraseña"*.
  2. **Ajustes (`preferencias`)**:
     - Unidades de Superficie (`ha`/`ac`), Temperatura (`°C`/`°F`), Modo Alto Contraste y Notificaciones Locales.
     - Tarjeta de **Permisos del Dispositivo** (Cámara, Galería, Ubicación GPS, Notificaciones) con activación directa.
  3. **Fincas (`fincas`)**:
     - Tarjetas de todos los establecimientos vinculados al usuario.
     - Acciones para `OWNER`: Modal de edición de finca (preservando su polígono GeoJSON) y modal de eliminación con confirmación de CUIT y motivo obligatorio.
  4. **Collares (`collares`)**:
     - Selector de establecimiento activo y listado de collares IoT mostrando código RFID, estado (*Disponible*, *Asignado*, *En Reparación*), modelo, batería (`%`) y caravana vinculada.
     - Acciones para `OWNER` y `FOREMAN`: Modal de alta/edición de collar (bloqueando RFID y estado cuando se encuentra *Asignado*) y modal de baja con validación de código RFID y motivo obligatorio.

---

## 4. Integraciones Transversales y Restricciones Técnicas
- **Detección de Cambios en Angular 22 Zoneless:** Uso sistemático de `ChangeDetectorRef.detectChanges()` tras cada operación asíncrona para garantizar respuesta visual instantánea en la UI.
- **Presupuesto SCSS Estricto:** `configuracion.page.scss` compilado estrictamente por debajo de **4.00 kB**.

---

## 5. Plan de Implementación
- [x] Crear el archivo de especificación `docs/specs/08-settings-and-profile.md`.
- [x] Actualizar `user.model.ts` y crear `collar.model.ts`.
- [x] Optimizar `AuthService` y `UserService` con caché en memoria RAM + estrategia Online-First en `@capacitor/preferences`.
- [x] Crear `CollarService` con soporte Online-First y operaciones CRUD completas contra `/api/v1/farms/{farmId}/collars` y `/api/v1/collars/{id}`.
- [x] Extender `PermissionService` y `PreferencesService`.
- [x] Construir `configuracion.page.ts / .html / .scss` con las 4 pestañas (`Perfil`, `Ajustes`, `Fincas`, `Collares`), modales de gestión y `ChangeDetectorRef.detectChanges()`.
- [x] Validar presupuesto SCSS (< 4.00 kB) y compilación limpia con `npm run build`.
- [x] Actualizar `MEMORY.md`.
