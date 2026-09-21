# Project Memory & Status (AgroTrack Mobile)

Registro dinámico para mantener el contexto técnico, decisiones y tareas pendientes entre distintas sesiones y agentes de IA.

## Estado Actual
- **Fase:** Inicialización del proyecto y configuración de herramientas y normativas (AGENTS.md).

## Progreso Reciente
- [x] Generación de proyecto Ionic + Angular (blank template).
- [x] Inicialización del repositorio Git y configuración remota (`main`).
- [x] Establecimiento de reglas de IA en `AGENTS.md`.
- [x] Creación del sistema de persistencia en `MEMORY.md`.
- [x] Creación de la rama base `develop`.

## Decisiones de Diseño Tomadas
1. **Guía Base:** Uso estricto de la documentación oficial de Ionic Angular para cualquier implementación visual o de comportamiento (ej. Routing, Lifecycle hooks).
2. **Estructura Arquitectónica:** Se replicará la organización de la aplicación web de AgroTrack para mantener cohesión (Core, Shared, Features).
3. **Control de Versiones:** Ramas `feature/*` partiendo siempre de `develop`. Commits manuales por parte del usuario mediante resúmenes autogenerados por la IA.

## Tareas Pendientes (Backlog)
- [ ] Revisar el frontend web actual de AgroTrack para replicar la estructura de carpetas (Core, Auth, etc.).
- [ ] Recibir la primera Spec del usuario para empezar la implementación base.
- [ ] Iniciar el desarrollo del primer módulo en una rama `feature/<nombre>`.
