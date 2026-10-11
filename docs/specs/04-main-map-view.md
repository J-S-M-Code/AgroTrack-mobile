# Spec 04: Mapa Principal de la Finca (Full Parity con Web)

**Status:** Implementing  
**Date:** 2026-10-10  
**Target Branch:** `feature/main-map`

## 1. Objetivo
Implementar la vista central de mapa para la aplicación móvil, asegurando que tenga un alcance funcional completo e idéntico al visor de la versión Web (visualización de lotes, mapas espectrales y herramientas de dibujo), pero adaptando estrictamente la UI y UX para pantallas móviles utilizando componentes nativos de Ionic (FABs, Bottom Sheets y Modals).

## 2. Dependencias y Modelos a Crear
- **Dependencias NPM:**
  - Instalar `@geoman-io/leaflet-geoman-free` para replicar las herramientas de trazado (polígonos, círculos, rectángulos) utilizadas en la web.
- **Modelos (`src/app/core/models/`):**
  - `lote.model.ts`
  - `spectral-map.model.ts`
- **Servicios (`src/app/core/services/`):**
  - `lot.service.ts`: Endpoints para obtener y crear lotes.
  - `spectral-map.service.ts`: Endpoints para obtener mapas espectrales disponibles por finca.

## 3. UI y Componentes Móviles (Ionic)
En lugar de utilizar barras flotantes rígidas como en la web, la organización espacial será orientada a móviles:

1. **Visor de Mapa (`<div id="map">`)**: Ocupará el 100% del espacio disponible de la pantalla (`ion-content` con scroll deshabilitado).
2. **Botones de Acción Flotantes (FABs)**:
   - Se utilizará un `ion-fab` (ej. en la esquina inferior derecha) para desplegar opciones clave o un botón central para "Acciones del Mapa".
3. **Bottom Sheets (Hojas Inferiores de Ionic)**:
   - *Panel de Capas e Índices:* Un modal que emerge desde abajo (`initialBreakpoint: 0.5`) para alternar entre "Satélite/Topográfico" y elegir/apagar los índices espectrales (NDVI, etc.) obtenidos desde MinIO.
   - *Barra de Dibujo:* Al querer crear un lote, las herramientas (Libre, Rectángulo, Círculo) se activarán para interactuar con Geoman.
4. **Detalle del Lote (Bottom Sheet)**:
   - Al tocar un lote existente (polígono), no se usará el popup clásico de Leaflet, sino que emergerá un `ion-modal` (Bottom Sheet) desde abajo con la información (Nombre, Hectáreas, Tipo de suelo) coloreado según su tipo, junto a un botón para navegar a su vista de detalles completa.
5. **Formulario de Nuevo Lote (`ion-modal` de pantalla completa o center)**:
   - Al confirmar un trazado en el mapa, se abre un formulario nativo superpuesto para cargar el Nombre, validar el cálculo de Hectáreas, el Tipo de Suelo y Observaciones, conectándose al backend para guardar.

## 4. Lógica Funcional y Flujo de Datos
- **Inicialización:** Al entrar en `mapa.page.ts`, se leerá el `fincaId` activo desde `ContextService`. Se solicitarán los polígonos de la finca, los lotes (`lotService.getLotsByFarm`) y los índices espectrales disponibles (`spectralMapService.getMapsByFarm`).
- **Renderizado de Lotes:** Se utilizará la misma lógica de colores por tipo (WATER_ZONE, AGRICULTURAL, etc.) que la web.
- **Trazado Geomético:** Geoman interceptará los eventos de dibujo (`pm:create`). Leaflet calculará automáticamente el área en hectáreas basado en la geometría resultante, preparándolo para el modal de guardado.

## 5. Pasos de Implementación Recomendados
1. Instalar `leaflet-geoman-free`.
2. Crear los modelos y servicios (`LotService`, `SpectralMapService`).
3. Construir la estructura principal del mapa en `mapa.page.html` e integrarlo en `mapa.page.ts` leyendo el contexto.
4. Desarrollar el *Bottom Sheet* para Capas y Mapas Espectrales.
5. Implementar el renderizado de Lotes y su *Bottom Sheet* de información.
6. Integrar Geoman, las herramientas de dibujo móvil (FABs) y el Modal final de guardado de Lotes.
