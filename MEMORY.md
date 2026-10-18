# Project Memory & Status (AgroTrack Mobile)

Registro dinámico para mantener el contexto técnico, decisiones y tareas pendientes entre distintas sesiones y agentes de IA.

## 🟢 Estado Actual
- **Fase:** Fase 2 (Spec 02) - Configuración Base completada. Módulo de Autenticación implementado.

## 🚀 Progreso Reciente
- [x] Establecimiento de reglas de IA en `AGENTS.md`.
- [x] Creación de `docs/specs/01-initial-setup.md` aplicando el estándar SDD.
- [x] Migración del proyecto a **Standalone Components** (eliminación de `NgModules`).
- [x] Configuración de caparazón (Shell) mixto y Theming (Light Mode).
- [x] Creación de `docs/specs/02-auth-module.md`.
- [x] Creación de la rama `feature/auth` (basada en las modificaciones de la Spec 01).
- [x] Implementación del `AuthService`, interceptor, guards y `LoginComponent`.

## 📐 Decisiones de Diseño Tomadas
1. **Guía Base:** Uso estricto de documentación oficial de Ionic Angular.
2. **Arquitectura:** **Standalone Components**. Eliminar uso de `NgModule` para modernizar el proyecto y agilizar la carga.
3. **Navegación Móvil:** Patrón Mixto (Menú Hamburguesa para configuraciones/perfil + Tabs para vistas rápidas).
4. **Theming:** Exclusivamente *Light Mode* por ahora.
5. **Autenticación (Mobile):** Vistas en `features/auth/`, servicios/guards en `core/auth/`. Persistencia nativa con `Capacitor Preferences`.
6. **UI Login:** Diseño de un solo panel centrado para dispositivos móviles (logo superior y formulario debajo).

## 📝 Tareas Pendientes (Backlog)
- [x] Crear la Spec 02: Módulo de Autenticación.
- [x] Implementar la estructura base de directorios (Core, Shared, Features) dentro de `src/app`.
- [x] Desarrollar servicio `AuthService` utilizando `Capacitor Preferences` y el API backend.
- [x] Construir la interfaz móvil para el `LoginComponent` con componentes de Ionic.
- [x] Configurar el sistema de ruteo para redirigir según el estado del token.
- [ ] Construir la interfaz para los `ion-tabs` inferiores y enlazarlos al `router-outlet` principal.
