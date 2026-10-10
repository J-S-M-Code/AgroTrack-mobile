# Project Memory & Status (AgroTrack Mobile)

Registro dinámico para mantener el contexto técnico, decisiones y tareas pendientes entre distintas sesiones y agentes de IA.

## 🟢 Estado Actual
- **Fase:** Fase 3 (Spec 03) - Navegación tipo Web (Menú contextual y Top Bar) y Dashboard de Fincas.

## 🚀 Progreso Reciente
- [x] Establecimiento de reglas de IA en `AGENTS.md`.
- [x] Migración a Standalone Components y configuración del Shell mixto.
- [x] Implementación completa de Autenticación (Spec 02) con capacitor preferences y guards.
- [x] Creación de `docs/specs/03-navigation-and-dashboard.md`.
- [x] Creación de la rama `feature/tabs-navigation` (que renombraremos internamente a enfoque de Dashboard).

## 📐 Decisiones de Diseño Tomadas
1. **Guía Base:** Uso estricto de documentación oficial de Ionic Angular.
2. **Arquitectura:** **Standalone Components**.
3. **Navegación Móvil:** Adaptación exacta de la Web. Un Menú Hamburguesa Contextual (reducido al inicio) y un Header por página con acceso a Notificaciones y Perfil. Descartamos los Bottom Tabs.
4. **Theming:** Exclusivamente *Light Mode*.
5. **Autenticación:** Interceptor HTTP y uso de Capacitor Preferences para token.

## 📝 Tareas Pendientes (Backlog)
- [x] Crear la Spec 03: Navegación y Dashboard.
- [ ] Refactorizar el menú estático en `app.component.html` para un estado "reducido".
- [ ] Construir la interfaz del Dashboard (`home.page.html`) con el Header (Notificaciones, Perfil) y las Fincas (`ion-card`).
- [ ] Conectar el listado de fincas a un servicio base (`FarmService`).
