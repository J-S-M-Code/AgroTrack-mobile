# Project Memory & Status (AgroTrack Mobile)

Registro dinámico para mantener el contexto técnico, decisiones y tareas pendientes entre distintas sesiones y agentes de IA.

## 📌 Estado Actual
- **Fase:** Fase 9 (Spec 09) - Módulo de Gestión de Personas y Equipo de Trabajo de Campo (Online-First) — **Completado**.
- **Rama Activa:** `feature/personnel`.

## 🚀 Progreso Reciente
- [x] Migración a Standalone Components y configuración del Shell mixto (Spec 01).
- [x] Implementación completa de Autenticación con `@capacitor/preferences`, interceptor funcional y guards (Spec 02).
- [x] Dashboard dinámico con `ContextService`, menú lateral contextual por rol y Leaflet Minimaps en Fincas (Spec 03).
- [x] Mapa Principal Interactivo con `@geoman-io/leaflet-geoman-free`, capas satelitales/espectrales, filtros SENASA y alta/detalle de lotes mediante Bottom Sheets (Spec 04).
- [x] Módulo completo de Cultivos con paridad Web, Bottom Sheets nativos y análisis satelital del lote (Spec 05 integrada en `develop`).
- [x] Implementación completa del Módulo de Novedades con sensores nativos (`@capacitor/camera`, `@capacitor/geolocation`), STOMP WebSockets e integraciones contextuales (Spec 06).
- [x] Implementación completa del Módulo de Tareas Operativas (`Task`), Renovación Silenciosa de Sesión JWT (`< 24h`) y Notificaciones Nativas del Sistema (`@capacitor/local-notifications`) (Spec 07).
- [x] Implementación completa del Módulo de Ajustes (`Perfil`, `Ajustes y Sensores`, `Fincas` y `Collares IoT`) con respuesta instantánea 0ms en Angular 22 Zoneless y caché Online-First (Spec 08).
- [x] Implementación completa del Módulo de Gestión de Personas / Equipo de Trabajo de Campo con alta dual, edición de roles y revocación segura (Spec 09).

## 🧠 Decisiones de Diseño Vigentes
1. **Arquitectura Base y Angular 22 Zoneless:** **Standalone Components** estrictos, **Light Mode** exclusivo, estilos por componente `< 4.00 kB`, uso obligatorio de `ChangeDetectorRef.detectChanges()` tras callbacks asíncronos y persistencia nativa con `@capacitor/preferences`.
2. **Estrategia Online-First con Resiliencia Offline:**
   - La nómina del equipo por finca se consulta mediante `GET /api/v1/users/farm/{farmId}` y se respalda en `@capacitor/preferences` (`agrotrack_personnel_{farmId}`). Si el dispositivo se encuentra sin cobertura en campo, la pantalla muestra la nómina en caché sin bloquear la interacción.
3. **Jerarquía y Clasificación de Roles Agrícolas (`ROLES_OPTIONS`):**
   - **Gestión:** `OWNER` (Dueño/Propietario) y `FOREMAN` (Capataz).
   - **Técnicos:** `AGRONOMIST` (Agrónomo) y `VETERINARIAN` (Veterinario).
   - **Operativos:** `APPLICATOR` (Aplicador) y `WORKER` (Operario de Campo).
   - Cada rol cuenta con color representativo en avatares y badges.
4. **Paridad de Operaciones con la Plataforma Web (para `OWNER`):**
   - **Flujo Dual de Alta:**
     - *(A) Asignar Existente:* Búsqueda por email y asignación directa a la finca activa (`POST /api/v1/users/assign`).
     - *(B) Registrar Nuevo:* Creación de colaborador completo (DNI, teléfono, dirección, correo, contraseña) e incorporación automática (`POST /api/v1/farms/{farmId}/users`).
   - **Edición de Rol:** Modificación de permisos en la finca (`PUT /api/v1/users/{id}/assignments`).
   - **Revocación Segura de Acceso:** Remoción del miembro (`DELETE /api/v1/farms/{farmId}/users/{userId}`) con confirmación obligatoria escribiendo el nombre exacto del integrante.
5. **Comunicación Directa en Campo:**
   - Accesos directos táctiles para llamada telefónica nativa (`tel:`) y correo electrónico (`mailto:`).

## 📋 Tareas Completadas en Spec 09 (`feature/personnel`)
- [x] Crear y actualizar `docs/specs/09-personnel-management.md`.
- [x] Crear el modelo `person.model.ts` con tipado de roles, DTOs y metadatos.
- [x] Extender `UserService` con `getPersonnelByFarm` (Online-First + caché local), `assignUserToFarm`, `inviteUserToFarm`, `updateUserAssignment` y `removeUserFromFarm`.
- [x] Construir la página `PersonasPage` (`personas.page.ts / .html / .scss`) con búsqueda en tiempo real, filtro por categoría de roles, modal de alta dual, edición de roles y confirmación de baja.
- [x] Registrar la ruta `/personas` en `app.routes.ts` y enlazar navegación en `app.component.html`.
- [x] Validar compilación (`npm run build`, `3.93 kB` < `4.00 kB`), sincronizar activos Android (`npx cap sync android`) y desplegar/ejecutar en el dispositivo físico `ZT322CPB75`.


## Spec 10: Arquitectura Online-First, Caché de Lectura y Cola Outbox (`feature/offline-sync`)
- [x] `NetworkService` (`@capacitor/network` + fallback navegador) y `OfflineStorageService` (`@capacitor/preferences`).
- [x] `SyncService` con cola FIFO persistente (`agrotrack_outbox_queue`), reconstrucción de adjuntos en base64 y sincronización automática al recuperar red o volver a primer plano.
- [x] Extensión Online-First en `FarmService`, `LotService`, `CropService`, `TaskService`, `AlertService` y `AnimalService`.
- [x] Soporte offline con adjuntos en `novedad-form`, `tarea-form` y `tarea-detalle`.
- [x] Indicador global de conectividad (`.net-pill`), ítem en menú lateral y modal de **Estado de Sincronización** en `AppComponent`.

## Spec 11: Conexión Productiva vía Cloudflare Tunnel (`feature/cloudflare-tunnel`)
- [x] `environment.ts` y `environment.prod.ts` configurados con `https://agrotrackapp.com.ar/api/v1`, `/ws` y `/storage/devstoreaccount1/agrotrack-files/`.
- [x] Bypass de cabecera `Authorization` en `auth.interceptor.ts` para rutas de `/storage/`, `blob.core.windows.net` y `:10000/devstoreaccount1`.
- [x] Reescritura de URLs internas de Docker/Azurite hacia `/storage/` en `AlertService.resolveImageUrl`, `TaskService.resolveImageUrl`, `mapa.page.ts` y `cultivo-detalle.page.ts`.
