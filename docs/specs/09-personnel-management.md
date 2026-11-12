# Spec 09: Módulo de Gestión de Personas y Equipo de Trabajo de Campo

**Status:** Implement
**Date:** 2026-11-11  
**Target Repository:** `AgroTrack Mobile`  
**Target Branch:** `feature/personnel`  

## 1. Objetivo
Implementar el módulo completo de **Gestión de Personas / Equipo de Trabajo (`Personnel Management`)** en la aplicación móvil con paridad funcional frente a la plataforma Web y arquitectura **Online-First con Resiliencia Offline**:
1. **Nómina de Personal por Finca:** Visualización táctil del equipo asignado a la finca activa (`GET /api/v1/users/farm/{farmId}`), con búsqueda en tiempo real, filtro rápido por rol, avatares diferenciados y accesos directos de comunicación en campo (llamada `tel:` y correo `mailto:`).
2. **Jerarquía y Roles Agrícolas:** Identificación clara de permisos y roles del sistema (`OWNER`, `FOREMAN`, `AGRONOMIST`, `VETERINARIAN`, `APPLICATOR`, `WORKER`) con badges visuales estandarizados.
3. **Flujo Dual de Incorporación de Miembros (Solo `OWNER`):**
   - **Modalidad A — Asignar Usuario Existente:** Vinculación directa mediante correo electrónico registrado y rol asignado (`POST /api/v1/users/assign`).
   - **Modalidad B — Registrar Nuevo Colaborador:** Alta integral de datos (nombre, apellido, DNI, teléfono, dirección, correo, contraseña inicial) e invitación directa a la finca (`POST /api/v1/farms/{farmId}/users`).
4. **Edición de Permisos y Roles (Solo `OWNER`):** Actualización dinámica del rol de un integrante en el establecimiento activo (`PUT /api/v1/users/{id}/assignments`).
5. **Revocación Segura de Acceso (Solo `OWNER`):** Desvinculación de un miembro de la finca (`DELETE /api/v1/farms/{farmId}/users/{userId}`) con diálogo de confirmación obligatoria escribiendo el nombre del colaborador para prevenir revocaciones accidentales en campo.
6. **Resiliencia Offline y Rendimiento:** Persistencia local del personal por establecimiento (`agrotrack_personnel_{farmId}` en `@capacitor/preferences`) y actualización instantánea de la UI mediante `ChangeDetectorRef` para Angular 22 Zoneless.

---

## 2. Dependencias, Modelos y Servicios en la App Móvil

### 2.1. Modelos (`src/app/core/models/`)
- `person.model.ts`:
  - `UserRole`: `'OWNER' | 'FOREMAN' | 'AGRONOMIST' | 'VETERINARIAN' | 'APPLICATOR' | 'WORKER'`.
  - `ROLES_OPTIONS`: Constante con etiquetas en español, descripciones breves y colores distintivos para cada rol.
  - `Persona`:
    - `id: string`
    - `nombre: string`
    - `email: string`
    - `telefono?: string`
    - `direccion?: string`
    - `rol: UserRole`
    - `rolLabel: string`
    - `estado: 'Activo' | 'Pendiente'`
    - `fincasAsignadas?: string[]`
  - `AssignUserDto`: `{ email: string; role: UserRole; farmIds: string[] }`.
  - `CreatePersonnelDto`: `{ name: string; lastName: string; dni: string; phone: string; address: string; email: string; password?: string; role: UserRole; sendEmail: boolean }`.
  - `UpdateAssignmentDto`: `{ role: UserRole; farmIds: string[] }`.

### 2.2. Servicios (`src/app/core/services/`)
- Extender `user.service.ts`:
  - `getPersonnelByFarm(farmId: string): Observable<Persona[]>`:
    - Consulta `GET /api/v1/users/farm/{farmId}`.
    - Guarda en caché local de `@capacitor/preferences` (`agrotrack_personnel_{farmId}`).
    - Si no hay conexión o la red falla, emite inmediatamente la nómina en caché.
  - `assignUserToFarm(dto: AssignUserDto): Observable<void>`: `POST /api/v1/users/assign`.
  - `inviteUserToFarm(farmId: string, dto: CreatePersonnelDto): Observable<void>`: `POST /api/v1/farms/{farmId}/users`.
  - `updateUserAssignment(userId: string, role: UserRole, farmIds: string[]): Observable<void>`: `PUT /api/v1/users/{userId}/assignments`.
  - `removeUserFromFarm(farmId: string, userId: string): Observable<void>`: `DELETE /api/v1/farms/{farmId}/users/{userId}`.

---

## 3. UI, Experiencia Móvil e Interfaces de Usuario (`src/app/feature/personas/`)

### 3.1. Página Principal de Equipo (`personas.page.ts / .html / .scss` — Ruta `/personas`)
- **Header y Barra de Búsqueda:**
  - `ion-header` con `ion-menu-button`, título *Equipo de Trabajo*, contador de miembros y botón flotante/toolbar *"+ Nuevo Miembro"* (visible para `OWNER`).
  - `ion-searchbar` reactivo para filtrar por nombre, apellido, correo o rol.
  - Segmento / Filtro rápido de categorías: `Todos` | `Operativos` (`WORKER`, `APPLICATOR`) | `Técnicos` (`AGRONOMIST`, `VETERINARIAN`) | `Gestión` (`OWNER`, `FOREMAN`).
- **Lista de Tarjetas Táctiles (`ion-card`):**
  - **Cabecera del Miembro:**
    - Avatar circular con iniciales y color de fondo temático según el rol.
    - Nombre y apellido completos.
    - Badges de Rol (ej. *Dueño*, *Capataz*, *Agrónomo*, *Veterinario*, *Aplicador*, *Operario*) y Estado (*Activo* en verde o *Pendiente* en amarillo).
  - **Cuerpo con Acciones de Contacto Rápido:**
    - Fila de correo con enlace nativo `mailto:`.
    - Fila de teléfono con botón directo de llamada `tel:`.
  - **Controles de Administración (Solo `OWNER`):**
    - Botón *"Editar Rol"* que abre modal de selección de nuevo rol.
    - Botón *"Revocar Acceso"* que abre modal de confirmación por nombre.
- **Acceso Restringido y Estado Vacío:**
  - Si no hay finca activa: mensaje informativo con botón para seleccionar finca en `/home`.
  - Si el usuario no tiene permisos (`OWNER` o `FOREMAN`): aviso de permisos insuficientes.
  - `ion-refresher` para recarga manual Online-First en campo.

### 3.2. Modal de Alta / Invitación de Miembro
- **Selector de Pestaña de Flujo:**
  - `Asignar Registrado`: Campo de email existente y selector de rol.
  - `Crear Nuevo`: Formulario completo adaptado a pantalla móvil (Nombre, Apellido, DNI, Teléfono, Dirección, Email, Contraseña temporal y selector de Rol).

### 3.3. Modal de Cambio de Rol
- Selector desplegable (`ion-select`) con los 6 roles y confirmación rápida.

### 3.4. Modal de Revocación de Acceso
- Diálogo de seguridad con advertencia clara de pérdida de acceso a la finca, input donde se debe tipear el nombre exacto del integrante y botón de confirmación en color `danger`.

---

## 4. Integraciones Transversales y Restricciones Técnicas
- **Menú Lateral (`app.component.html`):** Configurar `routerLink="/personas" routerDirection="root"` en el ítem de Personas (ya condicionado a `OWNER` y `FOREMAN`).
- **Rutas (`app.routes.ts`):** Registrar la ruta lazy-loaded `/personas` protegida por `authGuard`.
- **Presupuesto SCSS Estricto:** El archivo `personas.page.scss` debe mantenerse compilado por debajo de **4.00 kB**.
- **Arquitectura:** Componentes Standalone estrictos, inyección con `inject()`, `ChangeDetectorRef` para refresco garantizado y tipado riguroso con TypeScript.

---

## 5. Plan de Implementación
- [x] Crear el archivo de especificación `docs/specs/09-personnel-management.md`.
- [x] Crear el modelo `person.model.ts` con tipos de roles, etiquetas y DTOs.
- [x] Extender `user.service.ts` con `getPersonnelByFarm` (Online-First + caché local), `assignUserToFarm`, `inviteUserToFarm`, `updateUserAssignment` y `removeUserFromFarm`.
- [x] Construir la página `personas.page.ts / .html / .scss` con búsqueda, filtros, modal de alta dual, edición de roles y confirmación de baja.
- [x] Registrar la ruta en `app.routes.ts` y enlazar en `app.component.html`.
- [x] Validar compilación con `npm run build` (< 4.00 kB en SCSS) y sincronizar activos con `npx cap sync android`.
- [x] Actualizar `MEMORY.md`.
