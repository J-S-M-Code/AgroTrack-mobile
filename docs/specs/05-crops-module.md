# Spec 05: Módulo de Cultivos (Full Parity con Web y UX Móvil)

**Status:** In Progress  
**Date:** 2026-10-30  
**Target Branch:** `feature/cultivos`

## 1. Objetivo
Implementar el módulo completo de **Gestión de Cultivos** en la aplicación móvil asegurando paridad funcional con el frontend Web y el Backend (listado activo y huérfano, filtros, detalle con cuaderno de campo y análisis satelital del lote, alta/edición, registro de cosecha, cambio de estado fenológico y baja lógica), adaptando la interfaz a patrones nativos de Ionic con componentes Standalone.

## 2. Modelos, Servicios y Estructura de Archivos

### Modelos (`src/app/core/models/`)
- `cultivo.model.ts`:
  - Enums/Tipos alineados con Backend:
    - `TypeCrop`: `'FRUIT' | 'CEREAL' | 'OILSEED' | 'FORAGE' | 'HORTICULTURAL' | 'INDUSTRIAL'`.
    - `PhenologicalState`: `'GERMINATION' | 'VEGETATIVE_GROWTH' | 'FLOWERING' | 'MATURITY' | 'HARVESTED'`.
  - Interfaces `EventoCampo` y `Cultivo` preservando tanto los valores crudos del backend (`typeCrop`, `phenologicalState`, `isPerennial`, `loteId`, `fincaId`) como las etiquetas traducidas al español (`estado`, `tipoCultivoLabel`) para evitar sobrescrituras al editar.

### Servicios (`src/app/core/services/`)
- `crop.service.ts`:
  - `getCropsByFarm(farmId: string)` → `GET /crops/farm/{farmId}`.
  - `getUnassignedCrops()` → `GET /crops/unassigned`.
  - `getCropById(id: string, farmId: string)` → `GET /crops/{id}?farmId={farmId}`.
  - `registerCrop(lotId: string, cropDto: any, farmId: string)` → `POST /lots/{lotId}/crops?farmId={farmId}`.
  - `updateCrop(id: string, cropDto: any, farmId: string)` → `PUT /crops/{id}?farmId={farmId}`.
  - `updatePhenologicalState(id: string, state: PhenologicalState, farmId: string)` → `PUT /crops/{id}/phenological-state?state={state}&farmId={farmId}`.
  - `registerHarvest(id: string, farmId: string, actualHarvestDateIso: string)` → `POST /crops/{id}/harvest?farmId={farmId}&actualHarvestDate={YYYY-MM-DDTHH:mm:ss}`.
  - `deleteCrop(id: string, farmId: string, reason: string)` → `DELETE /crops/{id}?farmId={farmId}&reason={reason}`.

### Páginas Standalone (`src/app/feature/cultivos/`)
- `cultivos.page.ts / .html / .scss` → Listado principal (`/cultivos`).
- `pages/cultivo-detalle/cultivo-detalle.page.ts / .html / .scss` → Vista de detalle (`/cultivos/:id`).
- `pages/cultivo-form/cultivo-form.page.ts / .html / .scss` → Formulario de alta y edición (`/cultivos/nuevo` con soporte opcional `?lotId=...` y `/cultivos/editar/:id`).

### Rutas e Integraciones Globales
- `src/app/app.routes.ts`: Registro lazy-load (`loadComponent`) de `/cultivos`, `/cultivos/nuevo`, `/cultivos/editar/:id` y `/cultivos/:id` protegidas por `authGuard`.
- `src/app/app.component.html`: Enlace `routerLink="/cultivos" routerDirection="root"` en el ítem **Cultivos** del menú lateral contextual (visible para `OWNER`, `FOREMAN` y `AGRONOMIST`).
- `src/app/feature/mapa/mapa.page.ts / .html`: Vinculación contextual en el Bottom Sheet **Detalle del Lote** cuando el lote seleccionado es `AGRICULTURAL`.

## 3. UI y Experiencia Móvil (Ionic)

### 3.1. Listado de Cultivos (`/cultivos`)
1. **Header y Controles Superiores:**
   - `ion-toolbar` con `ion-menu-button`, título *Gestión de Cultivos* y botón de filtros avanzados con `ion-badge` indicando la cantidad de filtros activos.
   - `ion-searchbar` reactivo para buscar por **especie** o **variedad**.
   - `ion-segment` con tres vistas rápidas: **Todos**, **Activos** (de la finca en contexto) y **Sin Lote** (huérfanos).
2. **Listado y Pull-to-Refresh:**
   - `ion-refresher` para recargar datos desde la API.
   - Tarjetas `ion-card` táctiles por cultivo mostrando: Especie, `ion-badge` de variedad, lote asignado (o indicador *Sin lote asignado*), estado fenológico, barra de progreso porcentual del ciclo (`fechaPlantacion` → `fechaCosecha`) y estado sanitario/alertas.
3. **Bottom Sheet de Filtros (`ion-modal` con `breakpoints`):**
   - Selectores por **Lote** (extraídos dinámicamente) y **Estado Fenológico**, más botón para limpiar filtros.
4. **Acción Flotante (`ion-fab`):**
   - Botón `+` en esquina inferior derecha (visible para `OWNER`, `FOREMAN` y `AGRONOMIST`) hacia `/cultivos/nuevo`.

### 3.2. Detalle del Cultivo (`/cultivos/:id`)
1. **Header y Menú de Acciones:**
   - `ion-back-button` (`defaultHref="/cultivos"`) y botón de opciones (`ellipsis-vertical`) que abre un `ion-action-sheet` (para roles `OWNER`, `FOREMAN`, `AGRONOMIST`) con 4 acciones:
     - **Registrar Cosecha** (habilitado si `phenologicalState !== 'HARVESTED'`): abre `ion-modal` con selección de fecha de cosecha real (formateada a `LocalDateTime`), contemplando reciclo anual automático en cultivos perennes y mostrando errores de validación de negocio del backend.
     - **Cambiar Estado Fenológico**: abre `ion-modal` con radio group de los 5 estados (`GERMINATION` a `HARVESTED`) consumiendo `PUT /phenological-state`.
     - **Editar Cultivo**: redirige a `/cultivos/editar/:id`.
     - **Eliminar Cultivo** (rol destructivo): abre `ion-modal` de confirmación exigiendo escribir el **Nº RENSPA exacto** del cultivo y un **motivo obligatorio** (`reason`).
2. **Secciones de Información (`ion-card`):**
   - **Resumen Principal:** Especie, variedad, badges de Estado Fenológico, condición *Perenne* (si aplica) y Lote asignado.
   - **Registro Productor (SENASA):** Nº RENSPA, Tipo de Cultivo traducido y Superficie Implantada (ha).
   - **Ciclo del Cultivo:** Línea de tiempo visual entre *Plantación / Siembra* y *Cosecha Estimada*.
   - **Cuaderno de Campo:** Filtro por `ion-segment` (`Todos`, `Alerta`, `Tarea`, `Comentario`) con lista de eventos o estado vacío.
   - **Análisis Satelital del Lote:** Mapa Leaflet (`#mapa-cultivo`) encuadrado sobre el polígono del lote (`LotService`), con chips/botones para alternar entre `Normal` y los índices espectrales `READY` (`SpectralMapService`) recortados mediante máscara invertida (`maskLayer`).

### 3.3. Formulario de Alta y Edición (`/cultivos/nuevo` y `/cultivos/editar/:id`)
1. **Datos de la Planta:**
   - Selector `ion-select` de **Tipo de Cultivo (`TypeCrop`)**: *Frutal* (`FRUIT`, por defecto), *Cereal* (`CEREAL`), *Oleaginosa* (`OILSEED`), *Forrajero* (`FORAGE`), *Hortícola* (`HORTICULTURAL`) e *Industrial* (`INDUSTRIAL`).
   - `ion-input` de **Especie** acompañado de `ion-chip` de autocompletado rápido (*Vid, Nogal, Olivo, Almendro, Pistacho, Ciruelo, Durazno*).
   - `ion-input` de **Variedad**.
   - Campos de fecha para **Plantación / Siembra** y **Cosecha Estimada** (validando `fechaCosecha >= fechaPlantacion`).
   - `ion-toggle` para **¿Es perenne?**.
2. **Asignación Territorial y SENASA:**
   - `ion-select` de **Lote / Cuartel Asignado** listando únicamente lotes `AGRICULTURAL` (o `CROP`) de la finca activa; soporta preselección por query param `?lotId=...` y queda bloqueado en modo edición.
   - `ion-input` numérico de **Superficie Implantada (ha)** autocompletado al elegir el lote, validando `> 0` y `<= hectareasDelLote`.
   - `ion-input` de **Nº RENSPA (SENASA)**.
   - **Vista Previa del Polígono:** Minimapa Leaflet (`#mapa-form`) que dibuja y centra el polígono del lote seleccionado.
3. **Integridad en Edición:** Al actualizar se conservan el `phenologicalState`, `typeCrop` e `isPerennial` actuales del cultivo sin sobrescribirlos con valores fijos.

### 3.4. Integración desde el Mapa Principal (`/mapa`)
- Al abrir el Bottom Sheet **Detalle del Lote** en `mapa.page` sobre un lote de tipo `AGRICULTURAL`:
  - Si existe un cultivo activo vinculado (`loteId === selectedLote.id`), se muestra una tarjeta de resumen (*Especie - Variedad* + *Estado*) con acceso directo a `/cultivos/:id`.
  - Si el lote agrícola está libre y el usuario posee rol autorizado (`OWNER`, `FOREMAN`, `AGRONOMIST`), se muestra un botón de acción rápida *"Registrar Cultivo en este Lote"* que navega a `/cultivos/nuevo?lotId={selectedLote.id}`.

## 4. Permisos, Contexto y Ciclo de Vida
- **Persistencia Nativa:** Lectura reactiva de `selectedFarm$` y `userRole$` desde `ContextService` (`@capacitor/preferences`), sin usar `localStorage`.
- **Roles Autorizados:** Acceso y mutaciones habilitados para `OWNER`, `FOREMAN` y `AGRONOMIST` en concordancia con `CustomPermissionEvaluator` del Backend.
- **Ciclo de Vida Leaflet y RxJS:** Suscripciones gestionadas con `takeUntil(destroy$)`, recálculo `invalidateSize()` en `ionViewDidEnter` y destrucción limpia de mapas (`map.remove()`) en `ngOnDestroy`.

## 5. Plan de Implementación
- [ ] Crear modelo `src/app/core/models/cultivo.model.ts` y servicio `src/app/core/services/crop.service.ts`.
- [ ] Implementar listado `cultivos.page` con búsqueda, segmentos, pull-to-refresh, Bottom Sheet de filtros y FAB de alta.
- [ ] Implementar formulario `cultivo-form.page` (alta, edición, selector `TypeCrop`, chips de especies, validaciones de superficie/fechas y minimapa Leaflet).
- [ ] Implementar vista `cultivo-detalle.page` (tarjetas SENASA/Ciclo, Cuaderno de Campo, mapa satelital con máscara espectral y modales de Cosecha, Estado Fenológico y Eliminación con RENSPA).
- [ ] Conectar rutas en `app.routes.ts`, enlace en menú lateral (`app.component.html`) y acceso contextual desde lotes agrícolas en `mapa.page`.
