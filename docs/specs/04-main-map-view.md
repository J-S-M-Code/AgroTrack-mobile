# Spec 04: Mapa Principal de la Finca (Full Parity con Web)

**Status:** Finished  
**Date:** 2026-10-10  
**Completed Date:** 2026-10-30  
**Target Branch:** `feature/main-map`

## 1. Objetivo
Implementar la vista central de mapa para la aplicación móvil, asegurando que tenga un alcance funcional completo e idéntico al visor de la versión Web (visualización de finca y lotes, mapas espectrales, filtros de categorías animales SENASA y herramientas de dibujo), pero adaptando estrictamente la UI y UX para pantallas móviles utilizando componentes nativos de Ionic (FABs, Bottom Sheets y Modals).

## 2. Dependencias y Modelos Creados
- **Dependencias NPM:**
  - `@geoman-io/leaflet-geoman-free` instalado e integrado en `angular.json` y `src/global.scss` para habilitar las herramientas de trazado y edición geométrica.
- **Modelos (`src/app/core/models/`):**
  - `lot.model.ts`: Modelo de lotes de la finca.
  - `spectral-map.model.ts`: Modelo de mapas e índices espectrales.
- **Servicios (`src/app/core/services/`):**
  - `lot.service.ts`: Endpoints para obtener lotes por finca y crear nuevos lotes mapeando coordenadas GeoJSON a Leaflet.
  - `spectral-map.service.ts`: Endpoint para obtener mapas espectrales procesados (`READY`) por finca.
  - `context.service.ts`: Persistencia nativa de la finca activa mediante `@capacitor/preferences`.

## 3. UI y Componentes Móviles (Ionic)
Organización espacial adaptada a dispositivos móviles:

1. **Visor de Mapa (`<div id="main-map">`)**: Ocupa el 100% del área útil de `ion-content` (`[scrollY]="false"`), sin desbordes inferiores, centrando automáticamente sobre los lotes o el perímetro de la finca (sin sombreado interno en el polígono de la finca).
2. **Botones de Acción Flotantes (FABs)**:
   - `ion-fab` en la esquina inferior derecha con accesos directos independientes a **Dibujar Lote**, **Capas e Índices** y **Visualización de Animales (SENASA)**.
3. **Bottom Sheets Independientes (`ion-modal` con `initialBreakpoint: 0.8` y cierre con botón `✕`)**:
   - *Panel de Capas e Índices:* Alternancia entre capa base **Satélite (Google Maps)** y **Topográfico (OpenTopoMap)**, switch para mostrar/ocultar lotes, y switch + selector de **Mapas Espectrales** desde MinIO/Azurite (con soporte de overzoom `minNativeZoom: 14, maxNativeZoom: 20, maxZoom: 22` y remoción automática del sombreado de lotes al activar un índice).
   - *Panel de Visualización de Animales (SENASA):* Filtro independiente con las 7 categorías oficiales de SENASA, contador dinámico y acciones rápidas (*Todas* / *Ninguna*).
   - *Barra Flotante Inferior de Dibujo:* Selector de herramientas (**Libre**, **Rectángulo**, **Círculo**), botón para deshacer/borrar el último vértice, ajuste de vértices post-cierre y edición nativa por radio en círculos con recálculo de hectáreas en tiempo real.
4. **Detalle del Lote (Bottom Sheet)**:
   - Al tocar un lote existente emerge un `ion-modal` con indicador de color según categoría, nombre, descripción, hectáreas, tipo de lote y tipo de suelo traducidos al español, más acceso a detalles completos.
5. **Formulario de Nuevo Lote (`ion-modal`)**:
   - Solicita Nombre, Tipo de Lote, los 7 Tipos de Suelo y Descripción sobre las hectáreas estimadas automáticamente, mostrando errores de validación del backend y renderizando el lote creado al instante.

## 4. Lógica Funcional y Ciclo de Vida
- **Navegación e Inicialización:** Selección de finca en `HomePage` y enlace en el menú lateral (`app.component.html`) redirigen a `/mapa` protegido por `authGuard`.
- **Ciclo de Vida Seguro:** Limpieza reactiva de suscripciones con `takeUntil(destroy$)`, control de vista activa (`ionViewDidEnter` / `ionViewWillLeave`), `invalidateSize()` y destrucción limpia de la instancia de Leaflet en `ngOnDestroy`.

## 5. Estado de Implementación
- [x] Instalar y configurar `@geoman-io/leaflet-geoman-free`.
- [x] Crear modelos y servicios (`LotService`, `SpectralMapService`) y persistencia en `ContextService` con `@capacitor/preferences`.
- [x] Construir el visor principal en `mapa.page` conectado a rutas y menú contextual.
- [x] Desarrollar Bottom Sheets independientes para Capas/Índices y Categorías de Animales (SENASA).
- [x] Implementar renderizado de lotes y Bottom Sheet de Detalle del Lote.
- [x] Integrar barra flotante de dibujo Geoman (edición de vértices, círculo por radio nativo, borrar punto) y modal de guardado de lotes.
