# Spec 06: Módulo de Novedades, Sensores (Cámara y GPS) y Tiempo Real

**Status:** Finished  
**Date:** 2026-10-31  
**Completed Date:** 2026-11-06  
**Target Branch:** `feature/alerts`

## 1. Objetivo
Implementar el módulo completo de **Centro de Novedades (`Alert`)** en la aplicación móvil asegurando paridad funcional con el frontend Web y el Backend, e incorporando por primera vez el uso nativo de **sensores del dispositivo** (`@capacitor/camera` para captura/compresión de evidencia fotográfica múltiple y `@capacitor/geolocation` para georreferenciación GPS puntual y auto-detección de lote) junto con **notificaciones en tiempo real** vía STOMP WebSockets (`/topic/farms/{farmId}/alerts`).

## 2. Dependencias, Modelos, Servicios y Estructura de Archivos

### Dependencias a Instalar (`package.json`)
- `@capacitor/camera` (`^8.0.0`): Captura desde cámara nativa y selección desde galería con compresión (`quality: 80`).
- `@capacitor/geolocation` (`^8.0.0`): Obtención de coordenadas GPS de alta precisión (`enableHighAccuracy: true`) y gestión de permisos nativos.
- `@stomp/rx-stomp` y `sockjs-client` (`+ @types/sockjs-client` en `devDependencies`): Suscripción reactiva STOMP sobre SockJS hacia `${environment.wsUrl}`.

### Modelos (`src/app/core/models/`)
- `novedad.model.ts`:
  - Tipos alineados con Backend:
    - `AlertType`: `'MANUAL_NOTE' | 'SYSTEM_AUTOMATIC'`.
    - `RecordType`: `'NOTE' | 'ALERT'`.
    - `AlertPriority`: `'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'`.
  - Interfaces `RelacionNovedad` y `Novedad` preservando tanto los IDs y valores crudos (`relatedLotId`, `relatedCropId`, `relatedAnimalId`, `rawPriority`, `rawRecordType`) como las etiquetas en español (`tipo: 'Alerta' | 'Nota'`, `prioridad: 'Baja' | 'Media' | 'Alta' | 'Crítica'`), las URLs resueltas de `imagenes`, el `poligono` (`[lat, lng][]`) y el `centroide` puntual (`[lat, lng]`).
- `animal.model.ts`:
  - Modelo liviano `Animal` (`id`, `caravanaVisual`, `caravanaSenasa`, `especie`, `raza`, `sexo`, `categoria`, `loteAsignado`, `loteId`, `fincaId`, `active`) para habilitar la vinculación de novedades ganaderas.

### Servicios (`src/app/core/services/`)
- `alert.service.ts`:
  - `getAlertsByFarm(farmId: string)` → `GET /alerts/farm/{farmId}` (con mapeo GeoJSON `[lng, lat]` → Leaflet `[lat, lng]`).
  - `getAlertById(id: string, farmId: string)` → `GET /alerts/{id}?farmId={farmId}`.
  - `uploadAlertImage(blob: Blob, ext: 'jpg' | 'png' | 'webp', farmId: string)` → `POST /alerts/images?farmId={farmId}` enviando `FormData` con tercer argumento obligatorio (`evidencia_${i}.${ext}`) y MIME tipado (`image/jpeg`, `image/png`, `image/webp`) sin forzar `Content-Type` en [`authInterceptor`](../../src/app/core/auth/interceptors/auth.interceptor.ts).
  - `createAlert(alertDto: any, farmId: string)` → `POST /alerts?farmId={farmId}` enviando coordenadas en orden GeoJSON `[lng, lat]` y `createdAt` en formato `yyyy-MM-ddTHH:mm:ss` (sin `'Z'`).
  - `deleteAlert(id: string, farmId: string)` → `DELETE /alerts/{id}?farmId={farmId}`.
  - `resolveImageUrl(imagePath: string)` → Resuelve claves relativas `novedades/{farmId}/{uuid}.{ext}` contra `environment.minioBaseUrl` manteniendo retrocompatibilidad con URLs absolutas (`http://`, `https://`, `data:`, `blob:`).
- `animal.service.ts`:
  - Servicio liviano con `getAnimalsByFarm(farmId: string)` → `GET /animals/farm/{farmId}` para poblar el selector de animales en el alta de novedades.
- `websocket.service.ts` y `notification.service.ts`:
  - Conexión STOMP sobre SockJS (`${environment.wsUrl}`) inyectando dinámicamente `Authorization: Bearer <token>` desde `AuthService.getToken()` (vía `@capacitor/preferences`, nunca `localStorage`).
  - Suscripción reactiva a `ContextService.selectedFarm$` en `/topic/farms/{farmId}/alerts`: incrementa el contador `unreadCount$`, emite `incomingAlert$` para refrescar el listado en vivo y dispara un `ion-toast` informativo cuando ingresa una nueva novedad en la finca activa.

### Páginas Standalone (`src/app/feature/novedades/`)
- `novedades.page.ts / .html / .scss` → Listado principal (`/novedades`).
- `pages/novedad-detalle/novedad-detalle.page.ts / .html / .scss` → Vista de detalle (`/novedades/:id`).
- `pages/novedad-form/novedad-form.page.ts / .html / .scss` → Formulario de registro con sensores (`/novedades/nueva` soportando query params opcionales `?lotId=...` y `?cropId=...`).

### Rutas e Integraciones Globales
- `src/app/app.routes.ts`: Registro lazy-load (`loadComponent`) de `/novedades`, `/novedades/nueva` y `/novedades/:id` protegidas por `authGuard`.
- `src/app/app.component.html` y `src/app/home/home.page.html`: Enlace `routerLink="/novedades" routerDirection="root"` en el menú lateral contextual con `ion-badge` reactivo a `notificationService.unreadCount$` (reemplazando también el badge estático de ejemplo en `home.page.html`).
- `src/app/feature/mapa/mapa.page.ts / .html`: Acción rápida *"Reportar Novedad en este Lote"* en el Bottom Sheet **Detalle del Lote** que navega a `/novedades/nueva?lotId={selectedLote.id}`.
- `src/app/feature/cultivos/pages/cultivo-detalle/cultivo-detalle.page.ts / .html`: Botón contextual *"+ Novedad"* en la sección **Cuaderno de Campo** que navega a `/novedades/nueva?cropId={cultivo.id}`, e integración de las novedades vinculadas al cultivo (`relatedCropId` / `relatedLotId`) dentro del Cuaderno de Campo.

## 3. UI, Sensores y Experiencia Móvil (Ionic)

### 3.1. Listado de Novedades (`/novedades`)
1. **Header y Controles Superiores:**
   - `ion-toolbar` con `ion-menu-button`, título *Centro de Novedades* y botón de filtro por prioridad/entidad con `ion-badge` cuando hay filtro activo.
   - Al ingresar a `/novedades`, se resetea `notificationService.resetCount()`.
   - `ion-searchbar` reactivo para buscar por **título**, **descripción**, **autor/origen** o **entidad vinculada**.
   - `ion-segment` con tres vistas rápidas: **Todas**, **Alertas** (`ALERT`) y **Notas** (`NOTE`).
2. **Listado, Tiempo Real y Pull-to-Refresh:**
   - `ion-refresher` para recargar desde el backend y actualización automática cuando `notificationService.incomingAlert$` emite un nuevo registro de la finca activa.
   - Tarjetas táctiles diferenciadas visualmente entre *Alerta* y *Nota*, mostrando: ícono de tipo, autor/origen, fecha (`dd/MM/yy HH:mm hs`), badge de prioridad (*Baja, Media, Alta, Crítica*), extracto de descripción e indicador/miniatura cuando posee evidencia fotográfica o ubicación GPS.
3. **Acción Flotante (`ion-fab`):**
   - Botón `+` en esquina inferior derecha habilitado para cualquier rol con acceso a la finca (`ANY`) que navega a `/novedades/nueva`.

### 3.2. Detalle de Novedad (`/novedades/:id`)
1. **Header y Eliminación:**
   - `ion-back-button` (`defaultHref="/novedades"`) y botón de eliminar (`trash-outline`) visible únicamente para roles `OWNER` y `FOREMAN` (conforme a `@PreAuthorize("hasPermission(#farmId, 'FOREMAN')")` en Backend), con `ion-modal` de confirmación antes de ejecutar `DELETE /alerts/{id}`.
2. **Secciones de Información (`ion-card`):**
   - **Cabecera del Evento:** Título, tipo (*Alerta* / *Nota*), badge de Prioridad, fecha/hora exacta y autor (`origen`).
   - **Detalle del Evento:** Descripción completa registrada en campo.
   - **Entidades Relacionadas:** Lista enriquecida resolviendo el nombre del Lote (`LotService`), Cultivo (`CropService`) o Animal (`AnimalService`), con acceso directo a la ficha correspondiente (`/mapa` o `/cultivos/:id`).
   - **Evidencia Fotográfica:** Grilla de miniaturas resueltas desde Azurite/Blob Storage (`resolveImageUrl`); al tocar una foto se abre un visor `ion-modal` a pantalla completa para inspeccionarla en detalle.
   - **Ubicación y Perímetro Afectado:** Minimapa satelital Leaflet (`#mapa-novedad-detalle`) que renderiza el polígono afectado (`poligono`, si existe) y/o un marcador destacado en la coordenada GPS exacta (`centroide`), ajustando el encuadre automáticamente.

### 3.3. Formulario de Alta con Sensores (`/novedades/nueva`)
1. **Detalles Principales:**
   - `ion-input` de **Título** obligatorio.
   - Selector de **Tipo de Registro**: *Nota / Comentario* (`NOTE`) o *Alerta* (`ALERT`).
   - Selector de **Prioridad**: *Baja* (`LOW`), *Media* (`MEDIUM`), *Alta* (`HIGH`) o *Crítica* (`CRITICAL`).
   - Selector/campo de **Fecha y Hora** inicializado con la hora local actual del dispositivo (formateado a `yyyy-MM-ddTHH:mm:ss` sin `'Z'`).
   - `ion-textarea` de **Descripción detallada** obligatoria.
2. **Vinculación Filtrada por Rol:**
   - Nivel de vinculación (`Lote`, `Cultivo`, `Animal`) adaptado al rol activo en `ContextService`:
     - `AGRONOMIST`: `Lote` y `Cultivo`.
     - `VETERINARIAN`: `Animal`.
     - Resto de roles (`OWNER`, `FOREMAN`, `WORKER`, `APPLICATOR`): `Lote`, `Cultivo` y `Animal`.
   - Preselección automática si ingresa mediante `?lotId=...` o `?cropId=...`.
3. **Modo Dual Geoespacial (`@capacitor/geolocation` + Leaflet-Geoman):**
   - **Acción 1 — *"Usar mi ubicación GPS"*:** Solicita permisos nativos con `Geolocation.checkPermissions()` / `requestPermissions()`, obtiene `Geolocation.getCurrentPosition({ enableHighAccuracy: true })`, coloca un Pin GPS exacto en el minimapa (`centroid: [coords.longitude, coords.latitude]`) y ejecuta validación *point-in-polygon* contra `lotesDisponibles` para **auto-seleccionar el lote** (o el cultivo implantado en ese lote) donde se encuentra parado el usuario.
   - **Acción 2 — *"Dibujar Sub-Zona"*:** Permite delimitar manualmente un sub-polígono sobre el lote/cultivo con `@geoman-io/leaflet-geoman-free` (`polygonLimit` cerrado en orden `[lng, lat]`) o limpiar la sub-zona para volver al punto GPS / polígono base.
4. **Evidencia Fotográfica Múltiple (`@capacitor/camera`):**
   - Botones claros para **Tomar Foto** (`CameraSource.Camera`) o **Galería** (`CameraSource.Photos`) con `resultType: CameraResultType.Uri` y `quality: 80` (con fallback a `<input type="file" accept="image/jpeg,image/png,image/webp">` en navegador web si aplica).
   - Conversión de `photo.webPath` a `Blob` validando en cliente:
     - Formato permitido: `.jpg`/`.jpeg` (`image/jpeg`), `.png` (`image/png`) o `.webp` (`image/webp`).
     - Tamaño individual `<= 10 MB` y acumulado `<= 25 MB`.
   - Galería en grilla de previsualización con tamaño estimado y botón para quitar cada foto antes de guardar.
   - Al confirmar **Guardar Registro**, se suben todas las fotos en paralelo con `forkJoin` (`POST /alerts/images`) y, con los `paths` devueltos, se envía el `POST /alerts`.

## 4. Permisos, Restricciones Técnicas y Ciclo de Vida
- **Directorio Nativo Android (`/android`):** La carpeta `/android/` se encuentra excluida en `.gitignore` para no subir binarios ni proyectos generados a GitHub. Al inicializar la plataforma nativa (`npx cap add android` o `npx cap sync android`), se deben declarar en `android/app/src/main/AndroidManifest.xml` los siguientes permisos:
  - Ubicación: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` y `android.hardware.location.gps`.
  - Cámara y Multimedia: `CAMERA`, `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`.
- **Persistencia Nativa:** Obtención de `farmId`, `userRole` y `userId`/`token` exclusivamente mediante `ContextService`, `AuthService` y `UserService` (`@capacitor/preferences`), sin utilizar `localStorage`.
- **Presupuesto de Estilos Angular:** Cada archivo `.scss` de componente debe mantenerse estrictamente por debajo de `4.00 kB` compilados (`anyComponentStyle` budget).
- **Ciclo de Vida Leaflet, ObjectURLs y RxJS:** Limpieza de suscripciones con `takeUntil(destroy$)`, revocación de `blob:` previews al salir, `invalidateSize()` en `ionViewDidEnter` y `map.remove()` en `ngOnDestroy`.
- **Requisito CORS WebSocket en Backend:** Para pruebas en `localhost:8100` y WebView nativo (`https://localhost`, `http://localhost`, `capacitor://localhost`), el endpoint `/ws` en `WebSocketConfig.java` debe admitir dichos orígenes.

## 5. Plan de Implementación
- [x] Instalar `@capacitor/camera`, `@capacitor/geolocation`, `@stomp/rx-stomp`, `sockjs-client` y `@types/sockjs-client` (y configurar polyfill `window.global` en `src/index.html`).
- [x] Crear modelos (`novedad.model.ts`, `animal.model.ts`) y servicios Core (`alert.service.ts`, `animal.service.ts`, `websocket.service.ts`, `notification.service.ts`).
- [x] Implementar listado `novedades.page` (búsqueda, segmentos `Todas | Alertas | Notas`, filtro de prioridad y entidad, `ion-refresher`, actualización por WebSocket y FAB `+`), conectando el menú lateral y badges de notificaciones en `app.component.html` y `home.page.html`.
- [x] Implementar vista `novedad-detalle.page` (ficha completa, relaciones navegables, galería con visor modal, mapa satelital con polígono + Pin GPS y baja lógica para `OWNER`/`FOREMAN`).
- [x] Implementar formulario `novedad-form.page` con `@capacitor/camera` (múltiples fotos + `forkJoin`), `@capacitor/geolocation` (Pin GPS + auto-detección de lote *point-in-polygon*) y dibujo de sub-zona con Leaflet-Geoman.
- [x] Conectar rutas en `app.routes.ts` y accesos rápidos contextuales desde `mapa.page` (`?lotId=`) y `cultivo-detalle.page` (`?cropId=` + Cuaderno de Campo).
