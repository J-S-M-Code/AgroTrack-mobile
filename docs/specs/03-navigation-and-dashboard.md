# Spec 03: Navegación Principal y Dashboard de Fincas

**Status:** Implementing  
**Date:** 2026-10-6  
**Target Branch:** `feature/dashboard-navigation`

## 1. Objetivo
Implementar la navegación principal móvil basada estrictamente en el diseño y comportamiento de la aplicación web: utilizando un menú lateral dinámico y un header superior con opciones clave. El objetivo central de esta fase es construir el **Dashboard de Inicio (Fincas)**, que servirá como punto de entrada al autenticarse.

## 2. Estructura de Directorios a Crear/Modificar
Se ajustará la estructura generada para albergar el Dashboard y los servicios vinculados a las fincas:

- `src/app/core/services/`: 
  - `farm.service.ts`: Para obtener el listado de fincas asignadas al usuario.
- `src/app/features/home/`:
  - `home.page.ts / html / scss`: Contendrá el Dashboard con las tarjetas de las fincas y el Header principal.
- `src/app/app.component.html / ts`:
  - Refactorización del menú lateral para que sea contextual.

## 3. Comportamiento y Diseño de Navegación (Layout Mixto)
- **Menú Lateral (`ion-menu`):**
  - **Estado Inicial (Sin Finca Seleccionada):** Mostrará un menú reducido con las opciones "Fincas" y "Configuración".
  - **Estado Futuro (Con Finca Seleccionada):** Se expandirá para mostrar Lotes, Mapa, Tareas, Cultivos, Animales. (A implementarse en la interacción de selección).
- **Barra Superior (`ion-header` en la vista):**
  - **Botón de Menú:** Hamburguesa (`ion-menu-button`) a la izquierda para abrir el menú lateral.
  - **Título:** Texto o saludo ("Hola, Usuario").
  - **Acciones Rápidas:** Iconos a la derecha para Notificaciones (`ion-icon name="notifications"`) y Avatar/Perfil.
- **Vista Principal (Dashboard - Fincas):**
  - Un listado en formato grilla o lista (`ion-card` o `ion-item`) mostrando las fincas asignadas (Nombre, ubicación, y botón "Entrar a la Finca").

## 4. Pasos de Implementación
1. Refactorizar `app.component.html` para reducir las opciones estáticas y preparar la inyección dinámica basada en estado.
2. Construir la barra superior dentro de `home.page.html` implementando el avatar, el título y los iconos de acción, asegurando que se comporte de forma responsiva.
3. Crear un mock o conexión real en `FarmService` para listar las fincas del usuario y pintarlas utilizando componentes nativos de Ionic (`ion-card`).
4. Conectar todo para que al iniciar sesión aterrice en este Dashboard con el menú lateral inicial en su estado correcto.
