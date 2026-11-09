# Spec 07: Módulo de Tareas Operativas de Campo, Renovación de Sesión y Notificaciones Nativas

**Status:** Approved  
**Date:** 2026-11-09  
**Target Repository:** `AgroTrack Mobile`  
**Target Branch:** `feature/tasks`

## 1. Objetivo
Implementar el módulo completo de **Gestión de Tareas Operativas de Campo (`Task`)** en la aplicación móvil asegurando paridad funcional con la plataforma Web e incorporando capacidades nativas para el trabajo en terreno:
1. **Flujo Completo de Estados (`Pendiente` → `En Progreso` → `Completada`):** Registro de inicio de labor (`IN_PROGESS`) y cierre de tarea (`FINISH`) con observaciones finales y evidencia fotográfica múltiple capturada con `@capacitor/camera`, reflejada también en el **Cuaderno de Campo** del cultivo/lote.
2. **Asistencia Geoespacial GPS en Campo:** Botón *"Ubicarme en el Lote (GPS)"* en el detalle de la tarea para comparar la ubicación en vivo del operario frente al polígono asignado (indicando si se encuentra dentro del área de trabajo o a cuántos metros de distancia está), y modo dual (GPS + `Leaflet-Geoman`) al crear tareas.
3. **Notificaciones Nativas del Dispositivo (`@capacitor/local-notifications`) + WebSockets:** Recepción en vivo de eventos en `/topic/farms/{farmId}/tasks` y `/topic/farms/{farmId}/alerts` que dispara notificaciones en la barra de estado de Android con navegación directa al detalle (`/tareas/:id` o `/novedades/:id`) al tocarlas.
4. **Renovación Silenciosa de Sesión JWT:** Verificación preventiva de la expiración del token en el cliente móvil y renovación automática en segundo plano (`POST /api/v1/auth/refresh`) cuando le resten menos de 24 horas de vigencia.

---

## 2. Dependencias, Modelos y Servicios en la App Móvil

### 2.1. Dependencias y Permisos Nativos
- `package.json`:
  - `@capacitor/local-notifications` (`^8.0.0`): Notificaciones locales nativas en la bandeja del sistema Android.
- `android/app/src/main/AndroidManifest.xml` (documentado al regenerar la plataforma nativa):
  - `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`.
- `src/app/core/services/permission.service.ts`:
  - Método `ensureNotificationPermission(): Promise<boolean>` para gestionar el permiso de notificaciones en Android 13+.

### 2.2. Renovación Silenciosa de Sesión (`AuthService` + `authInterceptor`)
- `src/app/core/auth/services/auth.service.ts`:
  - Decodificación del claim `exp` del token almacenado en `@capacitor/preferences`.
  - Método `refreshTokenIfNeeded(): Promise<string | null>`:
    - Si el token es válido y le restan menos de **24 horas (`86400` s)** para expirar, invoca `POST /api/v1/auth/refresh` (con control de concurrencia para evitar llamadas duplicadas) y actualiza `auth-token` en `@capacitor/preferences`.
    - Si el token ya expiró (`exp <= now`), limpia la sesión y redirige a `/login`.
- `src/app/core/auth/interceptors/auth.interceptor.ts`:
  - Verifica y refresca preventivamente el token antes de adjuntar el header `Authorization: Bearer <token>` (excluyendo las rutas `/auth/login`, `/auth/register` y `/auth/refresh`).

### 2.3. Modelos (`src/app/core/models/`)
- `tarea.model.ts`:
  - Tipos:
    - `AccionType`: `'MAINTENANCE' | 'FERTILIZATION' | 'FUMIGATION' | 'HARVEST' | 'IRRIGATION' | 'PRUNING'`.
    - `TaskStatus`: `'CREATED' | 'IN_PROGESS' | 'FINISH'`.
    - `TaskPriority`: `'LOW' | 'MEDIUM' | 'HIGH'`.
  - Constante `ACCION_TYPE_OPTIONS` con etiquetas e íconos de Ionicons para cada tipo de labor.
  - Interfaz `Tarea`:
    - `id`, `titulo`, `descripcion`, `accionType`, `accionLabel`, `accionIcon`, `rawStatus`, `estado` (`'Pendientes' | 'En Progreso' | 'Completadas'`), `rawPriority`, `prioridad` (`'Baja' | 'Media' | 'Alta'`), `creadorId`, `creador`, `responsableId`, `responsable`, `fincaId`, `finca`, `loteId`, `lote`, `fechaCreacion`, `fechaVencimiento`, `fechaFinalizacion`, `imagenes` (URLs resueltas), `poligono` (`[lat, lng][]`), `centroide` (`[lat, lng]`), `observacionCierre`, `imagenesCierre` (URLs resueltas).

### 2.4. Servicios (`src/app/core/services/`)
- `task.service.ts`:
  - `getTasksForCurrentContext(farmId: string, role: string | null)` → Si `role` es `'OWNER'` o `'FOREMAN'`, consume `GET /tasks/farm/{farmId}`; para el resto de los roles (`AGRONOMIST`, `VETERINARIAN`, `WORKER`, `APPLICATOR`), consume `GET /tasks/assigned` filtrando por `relatedFarmId === farmId`.
  - `getTasksByFarm(farmId: string)` → `GET /tasks/farm/{farmId}`.
  - `getTaskById(taskId: string)` → `GET /tasks/{taskId}`.
  - `createTask(dto: any)` → `POST /tasks`.
  - `updateTaskStatus(taskId: string, newStatus: TaskStatus, completionData?: { completionNotes?: string; completionImages?: string[] })` → `PATCH /tasks/{taskId}/status?newStatus={newStatus}`.
  - `deleteTask(taskId: string, farmId: string, reason: string)` → `DELETE /tasks/{taskId}?farmId={farmId}&reason={reason}`.
  - `uploadTaskImage(blob: Blob, ext: 'jpg' | 'png' | 'webp', farmId: string)` → `POST /tasks/images?farmId={farmId}`.
  - `resolveImageUrl(imagePath: string)` → Resuelve claves relativas `tareas/{farmId}/{uuid}.{ext}` contra `environment.minioBaseUrl`.
- `user.service.ts`:
  - `getUsersByFarm(farmId: string): Observable<any[]>` → `GET /users/farm/{farmId}` para poblar el selector de personal de la finca.
- `websocket.service.ts` y `notification.service.ts`:
  - `watchTasks(farmId: string): Observable<any>` suscripto a `/topic/farms/${farmId}/tasks`.
  - `incomingTask$` en `NotificationService` para refrescar en vivo el listado y detalle de tareas.
  - Disparo de notificaciones nativas en la barra de estado de Android (`LocalNotifications.schedule` con el ícono oficial de AgroTrack `smallIcon: 'ic_stat_agrotrack'` y `largeIcon: 'ic_agrotrack_logo'`) **únicamente cuando la aplicación no está abierta en primer plano** (`@capacitor/app` `appStateChange` / `document.visibilityState`), y en el caso de tareas **exclusivamente cuando la tarea está asignada al usuario autenticado** (`responsableId === currentUserId` y `rawStatus === 'CREATED'`), con listener `localNotificationActionPerformed` que navega directamente a `/novedades/:id` o `/tareas/:id`.

---

## 3. Páginas Standalone (`src/app/feature/tareas/`)

### 3.1. Listado Principal (`tareas.page.ts / .html / .scss` — Ruta `/tareas`)
- **Buscador y Filtros:** Búsqueda en tiempo real por título, responsable o lote + modal de filtros por Prioridad (`Todas`, `Baja`, `Media`, `Alta`) y Tipo de Acción.
- **Segmentos (`ion-segment`):** `Pendientes` | `En Progreso` | `Completadas` | `Todas`.
- **Tarjetas de Tarea:**
  - Badges de Tipo de Acción, Prioridad y Estado.
  - Lote asignado (o *"Finca General"*), responsable asignado, fecha límite (destacada en rojo si está vencida o próxima) e indicador de fotos/ubicación en mapa.
- **FAB `+` (Nueva Tarea):** Visible para `OWNER`, `FOREMAN`, `AGRONOMIST` y `VETERINARIAN` (oculto para `WORKER` y `APPLICATOR`).
- **Pull-to-Refresh (`ion-refresher`)** y sincronización en tiempo real vía `incomingTask$`.

### 3.2. Detalle de Tarea y Ejecución en Campo (`pages/tarea-detalle/tarea-detalle.page.ts / .html / .scss` — Ruta `/tareas/:id`)
- **Ficha Técnica:** Título, estado, prioridad, tipo de acción, chip navegable al lote, creador, responsable asignado, fecha límite y galería de imágenes de referencia (con visor modal `Safe Area`).
- **Flujo de Ejecución:**
  - Botón **"Iniciar Tarea (En Progreso)"** cuando `rawStatus === 'CREATED'`.
  - Botón **"Finalizar Tarea"** cuando `rawStatus !== 'FINISH'`, abriendo un modal de cierre con:
    - Campo de **Observaciones, insumos o notas de cierre**.
    - Captura de **Evidencia Fotográfica** (`@capacitor/camera`: Cámara / Galería) con subida paralela (`forkJoin`).
  - Bloque **"Reporte de Finalización"** (visible cuando `rawStatus === 'FINISH'`) mostrando fecha de cierre, observaciones finales y galería de evidencia fotográfica tomada al completar.
  - Botón **"Eliminar Tarea"** (solo `OWNER` y `FOREMAN`) con modal de motivo de eliminación obligatorio.
- **Mapa Satelital + Botón "Ubicarme en el Lote (GPS)":**
  - Muestra el polígono del área de trabajo y/o Pin central sobre Google Satellite (`https://`).
  - Al pulsar **"Ubicarme en el Lote (GPS)"**, obtiene las coordenadas GPS actuales, dibuja el marcador del operario en el mapa y evalúa (*point-in-polygon* + distancia Haversine) si el usuario ya se encuentra dentro del sector asignado o a cuántos metros está.

### 3.3. Formulario de Creación (`pages/tarea-form/tarea-form.page.ts / .html / .scss` — Ruta `/tareas/nueva`)
- Soporta preselección mediante query params `?lotId=...` y `?cropId=...`.
- **Campos:** Título, Tipo de Acción, Prioridad, Fecha Límite, Lote asignado (opcional), Personal asignado (obligatorio, desde `UserService.getUsersByFarm`) y Descripción.
- **Evidencia Fotográfica de Referencia (`@capacitor/camera`):** Toma de fotos o selección de galería con validación (`<= 10 MB` individual / `<= 25 MB` total) y subida paralela con `forkJoin`.
- **Modo Dual Geoespacial (`@capacitor/geolocation` + `Leaflet-Geoman`):**
  - **"Usar mi ubicación GPS":** Posiciona un Pin GPS en el mapa y auto-selecciona el lote donde se encuentra el usuario (*point-in-polygon*).
  - **"Dibujar Área de Trabajo":** Permite delimitar manualmente el polígono de trabajo dentro del lote/finca con `Leaflet-Geoman`.

---

## 4. Integraciones Transversales y Restricciones Técnicas
- **Menú Lateral (`app.component.html`):** Enlazar el ítem **Tareas** a `routerLink="/tareas" routerDirection="root"`.
- **Mapa Principal (`mapa.page.html / .ts`):** Acción rápida **"Asignar Tarea en este Lote"** en el Bottom Sheet **Detalle del Lote** (visible para roles autorizados) navegando a `/tareas/nueva?lotId={selectedLote.id}`.
- **Detalle de Cultivo y Cuaderno de Campo (`cultivo-detalle.page.ts / .html`):**
  - Integrar las tareas del lote (`TaskService.getTasksByFarm`) dentro del **Cuaderno de Campo** del cultivo como eventos de tipo `'Tarea'` (incluyendo observaciones de cierre si fue completada) con navegación a `/tareas/:id`.
  - Acción rápida **"Asignar Tarea"** en el detalle del cultivo (`/tareas/nueva?lotId={cultivo.loteId}&cropId={cultivo.id}`).
- **Presupuesto de Estilos Angular:** Cada archivo `.scss` de componente debe mantenerse estrictamente por debajo de `4.00 kB` compilados (`anyComponentStyle` budget).

---

## 5. Plan de Implementación (Móvil)
- [x] Instalar `@capacitor/local-notifications` y actualizar `PermissionService` (`ensureNotificationPermission`) y `AndroidManifest.xml` (`POST_NOTIFICATIONS`).
- [x] Implementar renovación silenciosa del token JWT en `AuthService` y `authInterceptor`.
- [x] Crear `tarea.model.ts`, `task.service.ts` y extender `user.service.ts` (`getUsersByFarm`), `websocket.service.ts` (`watchTasks`) y `notification.service.ts` (notificaciones nativas Android + navegación al tocar).
- [x] Construir `tareas.page`, `tarea-detalle.page` (con *"Ubicarme en el Lote (GPS)"*, paso a *"En Progreso"* y modal de *"Finalizar Tarea"* con fotos y observaciones) y `tarea-form.page` (con `@capacitor/camera` y modo dual GPS + Geoman).
- [x] Registrar rutas en `app.routes.ts` e integrar accesos en `app.component.html`, `mapa.page` y el Cuaderno de Campo en `cultivo-detalle.page`.
- [x] Validar `npm run build`, sincronizar con `npx cap sync android` y desplegar en dispositivo físico.
