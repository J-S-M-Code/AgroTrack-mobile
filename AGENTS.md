# AI Agent Context & Guidelines (AgroTrack Mobile)

Este archivo define el contexto, las reglas de diseño y el flujo de trabajo que cualquier agente de IA debe seguir al asistir en el proyecto AgroTrack Mobile. **Todo agente debe leer este archivo y `MEMORY.md` al inicio de cada nuevo chat.**

## Arquitectura y Diseño
1. **Stack Tecnológico:** Ionic Framework con Angular.
2. **Fuente de la Verdad:** Basarse EXCLUSIVAMENTE en las prácticas y componentes de la [documentación oficial de Ionic Angular](https://ionicframework.com/docs/angular/overview).
3. **Estructura Espejo (Web -> Mobile):** La estructura de carpetas (Core, Shared, Features/Modules), nomenclatura de servicios y estado, debe seguir fielmente la arquitectura que ya tenemos definida en el proyecto frontend web de AgroTrack.
4. **Desarrollo por Specs:** Las implementaciones se construirán módulo por módulo basándose estrictamente en las especificaciones provistas.

## Flujo de Trabajo (Git & Ramas)
1. **Gestión de Ramas:** 
   - Las funcionalidades NO se desarrollan en `main`.
   - Cada implementación o módulo nuevo se hará en una rama separada que debe salir de `develop`.
   - **Nomenclatura:** `<tipo>/<descripcion>` (ejemplo: `feature/principal-map`, `feature/login`, `fix/ui-bug`).
2. **Commits (Manejados por el Usuario):**
   - El agente de IA **NO** debe realizar commits ni interactuar con los comandos de push de forma autónoma.
   - Al finalizar una tarea o hito importante, el agente proporcionará una plantilla de commit al usuario.
   - **Regla estricta:** El **Título del commit** (Convencional) DEBE ser SIEMPRE en **inglés**. La **descripción** detallada puede ser en español.

## Gestión de Memoria (`MEMORY.md`)
- El agente es responsable de mantener actualizado el archivo `MEMORY.md`.
- Cualquier decisión técnica de peso (librerías instaladas, cambios de ruta clave), el progreso de las specs y los pendientes deben registrarse allí para que el siguiente agente tenga el contexto exacto.
