# Spec 01: Initial Setup & Base Architecture

**Status:** Finished
**Date:** 2026-09-21
**Target Branch:** `chore/initial-setup`

## 1. Overview
El objetivo de esta especificación es establecer las bases arquitectónicas y visuales del proyecto móvil AgroTrack (Ionic + Angular). Esto incluye la migración de un patrón obsoleto (NgModules) al estándar actual de Angular (Standalone Components) para mantener paridad con el desarrollo web, la estructuración del caparazón de navegación y la inyección de la identidad de marca (colores).

## 2. Context & Rationale
El proyecto fue inicializado en blanco y trajo por defecto módulos clásicos. Para evitar deuda técnica y simplificar la carga perezosa (lazy loading) a futuro, se opta por **Standalone Components**.
Adicionalmente, se importarán los colores primarios detectados en el frontend web para mantener consistencia visual. El modo oscuro se deshabilita temporalmente por requerimiento explícito, garantizando una visualización consistente en modo claro (Light Mode).

## 3. Acceptance Criteria (Requisitos)
1. **No NgModules:** Los archivos `app.module.ts`, `app-routing.module.ts`, `home.module.ts` y `home-routing.module.ts` deben ser removidos.
2. **Standalone Bootstrap:** `main.ts` debe usar `bootstrapApplication` y proveer el enrutador y Ionic de forma nativa.
3. **Componentes Standalone:** `AppComponent` y `HomePage` deben tener el flag `standalone: true` e importar sus propias dependencias.
4. **Enrutamiento Funcional:** `app.routes.ts` debe proveer la ruta por defecto hacia el componente `HomePage`.
5. **Navegación Mixta (Shell):** El `app.component.html` debe declarar la estructura básica para una navegación mediante `ion-menu` y un área de contenido principal (`ion-router-outlet`).
6. **Tematización (Theming):** El archivo `variables.scss` debe utilizar estrictamente los siguientes colores:
   - Primary: `#0d8a5c`
   - Success: `#4ade80`
   - Warning: `#fbd350`
   - Danger: `#ef4444`
   - Base Background: `#f4f7f6`
7. **Restricción de Light Mode:** El archivo `variables.scss` no debe contener reglas `@media (prefers-color-scheme: dark)` que alteren los colores por defecto en caso de que el sistema operativo esté en modo oscuro.

## 4. Technical Implementation Details
- **Archivos a Crear:** 
  - `src/app/app.routes.ts`
- **Archivos a Modificar:** 
  - `src/main.ts`
  - `src/app/app.component.ts`
  - `src/app/app.component.html`
  - `src/app/home/home.page.ts`
  - `src/theme/variables.scss`
- **Dependencias (Providers) en main.ts:**
  - `provideIonicAngular()`
  - `provideRouter(routes, withPreloading(PreloadAllModules))`

## 5. Verification Plan
- Ejecutar el comando `ionic serve`.
- Comprobar que no existan errores de compilación por falta de módulos o declaraciones.
- Inspeccionar las variables CSS generadas para asegurar que el tema actual refleja la paleta de AgroTrack.
- Validar el funcionamiento cambiando la preferencia del OS a modo oscuro (no debería cambiar los colores principales).
