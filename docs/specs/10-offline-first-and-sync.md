# Spec 10: Arquitectura Online-First, Caché de Lectura y Cola de Sincronización Offline (Outbox Pattern)

**Status:** Review  
**Date:** 2026-11-12  
**Target Repository:** `AgroTrack Mobile`  
**Target Branch:** `feature/offline-sync`

## 1. Objetivo
Consolidar la arquitectura **Online-First con Operación Offline Garantizada** en toda la aplicación móvil de AgroTrack, asegurando que el sistema priorice siempre los datos actualizados del servidor cuando exista señal, pero permanezca 100% operativo en zonas rurales sin cobertura:
1. **Detección de Conectividad en Tiempo Real (`NetworkService`):** Monitoreo nativo de red mediante `@capacitor/network` (con fallback a `navigator.onLine` en entorno web) exponiendo estado reactivo (`isOnline$`) y lectura síncrona (`isOnlineSnapshot`).
2. **Caché Read-Through Online-First Unificada (`OfflineStorageService`):** Estandarización del almacenamiento local en `@capacitor/preferences` para todos los módulos operativos de campo (`Fincas`, `Lotes`, `Cultivos`, `Tareas`, `Novedades/Alertas` y `Animales`), complementando lo ya implementado en `UserService` y `CollarService`.
3. **Cola de Operaciones Diferidas — Outbox Pattern (`SyncService`):** Encolado persistente y ordenado (FIFO) de mutaciones realizadas sin internet (creación de novedades con evidencia fotográfica, creación/edición de tareas, cambio de estado de labores, registro de avances, alta/edición de cultivos y lotes).
4. **Actualización Optimista en UI:** Toda operación encolada offline actualiza inmediatamente la caché local de lectura y marca el elemento como *"Pendiente de sincronización"*, permitiendo al usuario seguir trabajando con fluidez sin bloquear flujos de campo.
5. **Sincronización Automática y Centro de Control:** Procesamiento automático de la cola al recuperar conectividad o al regresar la app a primer plano, junto con un indicador global de estado offline/pendientes y un panel para reintentar o descartar operaciones con error.

---

## 2. Dependencias, Modelos y Servicios en la App Móvil

### 2.1. Dependencias Nativas
- Instalar `@capacitor/network` compatible con Capacitor 8 y sincronizar en Android (`npx cap sync android`).

### 2.2. Modelos (`src/app/core/models/`)
- `sync.model.ts`:
  - `SyncEntityType`: `'TASK' | 'ALERT' | 'CROP' | 'LOT' | 'COMMENT'`.
  - `SyncOperationType`: `'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELETE'`.
  - `SyncItemStatus`: `'PENDING' | 'SYNCING' | 'FAILED'`.
  - `OutboxOperation`:
    - `id: string` (UUID local temporal)
    - `entity: SyncEntityType`
    - `operation: SyncOperationType`
    - `endpoint: string`
    - `method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'`
    - `payload: any` (incluyendo adjuntos serializados en base64 si aplica)
    - `farmId: string`
    - `description: string` (resumen legible para el usuario, ej. *"Nueva novedad: Falla de riego"*)
    - `localRefId?: string` (ID temporal usado en caché optimista para reemplazarlo al sincronizar)
    - `createdAt: string` (ISO 8601)
    - `retryCount: number`
    - `status: SyncItemStatus`
    - `lastError?: string`

### 2.3. Servicios (`src/app/core/services/`)
- `network.service.ts`:
  - Inicializa listener de `Network.addListener('networkStatusChange', ...)` al arrancar la app.
  - Expone `isOnline$: Observable<boolean>` y `isOnlineSnapshot: boolean`.
- `offline-storage.service.ts`:
  - Métodos genéricos tipados `setCache<T>(key: string, data: T)`, `getCache<T>(key: string)`, `removeCache(key: string)` y `clearUserCaches()` sobre `@capacitor/preferences`.
  - Almacena metadato `savedAt` junto al payload para trazabilidad de frescura de datos.
- `sync.service.ts`:
  - Mantiene la cola persistente en `@capacitor/preferences` bajo clave `agrotrack_outbox_queue`.
  - `enqueue(op)`: Agrega una operación pendiente y actualiza `pendingCount$` / `operations$`.
  - `processQueue()`: Ejecuta en orden FIFO las operaciones `PENDING` cuando `networkService.isOnlineSnapshot` es `true`, evitando ejecuciones concurrentes mediante un lock (`isSyncing`).
  - `retryAll()` / `retryOperation(id)` / `discardOperation(id)`.
  - Escucha reconexiones en `networkService.isOnline$` y transiciones `appStateChange` (`@capacitor/app`) para disparar sincronización automática silenciosa.
- **Extensión Online-First en Servicios de Dominio:**
  - `farm.service.ts`, `lot.service.ts`, `crop.service.ts`, `task.service.ts`, `alert.service.ts`, `animal.service.ts`:
    - **Lecturas (`GET`):** Intentan consultar al backend cuando hay red y persisten el resultado en `OfflineStorageService`. Ante falla de red o modo offline, devuelven inmediatamente la última caché válida.
    - **Escrituras (`POST`/`PUT`/`PATCH`):** Si el dispositivo está offline (o falla por error de red sin respuesta HTTP `status === 0`), encolan la operación en `SyncService`, aplican cambio optimista en la caché local y retornan confirmación controlada para que la vista muestre el mensaje de guardado offline.

---

## 3. UI, Experiencia Móvil e Interfaces de Usuario

### 3.1. Indicador Global de Conectividad (`app.component.html / .ts / .scss`)
- **Banner Superior Discreto:**
  - Visible únicamente cuando el dispositivo está **Sin conexión** (barra ámbar/oscura compacta: *"Sin conexión · Modo offline activo"*) o cuando hay **Sincronización en curso** (*"Sincronizando X cambios pendientes..."*).
- **Menú Lateral (`ion-menu`):**
  - Ítem / Badge de **Sincronización** mostrando el contador de operaciones pendientes (`pendingCount`) o fallidas (`failedCount`) para acceso inmediato.

### 3.2. Panel / Modal de Cola de Sincronización (`SyncQueueModal` o sección en `Configuración` / componente compartido)
- Accesible al tocar el indicador del menú lateral o el banner de pendientes:
  - Resumen de estado de red actual (Online / Offline) y última sincronización exitosa.
  - Listado de operaciones en cola con:
    - Ícono por módulo (`Tareas`, `Novedades`, `Cultivos`, `Lotes`).
    - Descripción legible y fecha/hora de creación local.
    - Badge de estado (`Pendiente`, `Sincronizando`, `Error` con detalle del motivo).
    - Botón individual de reintento o descarte (para operaciones con error definitivo).
  - Botón principal **"Sincronizar Ahora"** (habilitado cuando hay conexión y elementos pendientes).

### 3.3. Feedback en Módulos Operativos (`Tareas`, `Novedades`, `Cultivos`, `Lotes`)
- Al guardar una entidad o cambio de estado sin internet:
  - Toast informativo diferenciado (color `warning` o `tertiary`): *"Guardado sin conexión. Se enviará automáticamente al recuperar internet."*
  - Las tarjetas creadas localmente muestran una etiqueta sutil *"Pendiente de envío"* hasta que el `SyncService` complete la subida y refresque la caché desde el backend.

---

## 4. Integraciones Transversales y Restricciones Técnicas
- **Prioridad Online-First Estricta:** Ninguna vista debe quedarse con datos viejos si hay conexión; siempre se intenta red primero (o snapshot inmediato + revalidación) y se actualiza la caché con la respuesta real del servidor.
- **Manejo de Adjuntos Offline:** Las fotografías capturadas en `Novedades` sin conexión se serializan de forma liviana (comprimidas en canvas/DataURL dentro de la operación encolada) y el `SyncService` reconstruye el `FormData` / `Blob` al momento de sincronizar con el backend.
- **Prevención de Condiciones de Carrera:** `SyncService` utiliza un semáforo interno (`syncInProgress`) para no duplicar envíos si llegan eventos simultáneos de red y `appStateChange`.
- **Arquitectura Angular 22 Zoneless:** Todos los observables de estado (`NetworkService`, `SyncService`) y actualizaciones en componentes deben invocar `ChangeDetectorRef.detectChanges()` cuando corresponda.
- **Presupuesto SCSS:** Mantener todos los componentes modificados dentro del límite estricto de compilación (`< 4.00 kB`).

---

## 5. Plan de Implementación
- [x] Crear el archivo de especificación `docs/specs/10-offline-first-and-sync.md`.
- [x] Instalar `@capacitor/network` y sincronizar con Android (`npx cap sync android`).
- [x] Crear `src/app/core/models/sync.model.ts`.
- [x] Implementar `NetworkService` (`src/app/core/services/network.service.ts`) y `OfflineStorageService` (`src/app/core/services/offline-storage.service.ts`).
- [x] Implementar `SyncService` (`src/app/core/services/sync.service.ts`) con cola FIFO persistente, reintentos y triggers automáticos.
- [x] Extender los servicios de dominio (`farm`, `lot`, `crop`, `task`, `alert`, `animal`) con caché Read-Through Online-First y soporte Outbox para mutaciones offline.
- [x] Incorporar el banner global de conectividad y el modal/panel de Cola de Sincronización en `app.component` y `configuracion` (o componente compartido).
- [x] Actualizar las vistas operativas principales para mostrar feedback de guardado offline y etiquetas de pendiente de sincronización.
- [x] Validar compilación (`npm run build`), presupuesto SCSS (`< 4.00 kB`), sincronización Android (`npx cap sync android`) y pruebas funcionales con modo avión en dispositivo físico.
- [x] Actualizar `MEMORY.md`.
