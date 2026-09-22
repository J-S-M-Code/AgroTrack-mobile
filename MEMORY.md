# Project Memory & Status (AgroTrack Mobile)

Registro dinámico para mantener el contexto técnico, decisiones y tareas pendientes entre distintas sesiones y agentes de IA.

## 🟢 Estado Actual
- **Fase:** Configuración Base y Migración Arquitectónica (Spec 01 Completada).

## 🚀 Progreso Reciente
- [x] Establecimiento de reglas de IA en `AGENTS.md`.
- [x] Creación de `MEMORY.md` y rama `develop`.
- [x] Creación de `docs/specs/01-initial-setup.md` aplicando el estándar SDD.
- [x] Migración del proyecto a **Standalone Components** (eliminación de `NgModules`).
- [x] Configuración de caparazón (Shell) mixto: `ion-menu` + `ion-router-outlet`.
- [x] Forzado estricto del *Light Mode* e inyección de la paleta de colores de AgroTrack en `variables.scss`.

## 📐 Decisiones de Diseño Tomadas
1. **Guía Base:** Uso estricto de documentación oficial de Ionic Angular.
2. **Arquitectura:** **Standalone Components**. Eliminar uso de `NgModule` para modernizar el proyecto y agilizar la carga.
3. **Navegación Móvil:** Patrón Mixto (Menú Hamburguesa para configuraciones/perfil + Tabs para vistas rápidas).
4. **Theming:** Exclusivamente *Light Mode* por ahora (Modo Oscuro deshabilitado temporalmente debido a dependencias con la versión web).

## 📝 Tareas Pendientes (Backlog)
- [ ] Implementar la estructura base de directorios (Core, Shared, Features).
- [ ] Construir la interfaz para los `ion-tabs` inferiores y enlazarlos al `router-outlet` principal.
- [ ] Crear la Spec 02: Módulo de Autenticación o Dashboard principal.
