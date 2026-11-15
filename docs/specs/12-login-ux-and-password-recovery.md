# Spec 12: Pulido UX de Login Directo y Flujo Visual de Recuperación de Contraseña (Beta)

**Status:** Finished  
**Date:** 2026-11-14  
**Target Repository:** `AgroTrack Mobile`  
**Base Branch:** `develop` (`9fc7735`, alineada con `origin/develop`)  
**Target Branch:** `feature/auth-recovery-ui`  
**Alcance Backend:** Sin cambios en servidor durante esta iteración. La UI funcionará en modo simulación Beta y el contrato REST para futura integración queda definido en la Sección 5.

---

## 1. Objetivo y Contexto de Producto

Consolidar la experiencia de acceso de AgroTrack Mobile manteniendo el **login directo** como única pantalla de entrada (orientada a productores y personal que ya cuentan con el servicio contratado o asignado, dejando la demo y contratación comercial en la Web), elevando el estándar de usabilidad y completando visualmente el flujo de recuperación de contraseña:

1. **Paridad visual estricta:** Conservar exactamente la estética, paleta Light Mode (`#0d8a5c` primario, `#f4f7f6` fondo), logo AgroTrack + badge `BETA`, subtítulo *"Gestión Agrícola Inteligente"*, tipografía y estructura de formulario actual de `LoginComponent`.
2. **Pulido UX del Login directo:** Sumar control de visibilidad de contraseña (toggle ojito), atributos de teclado/autocompletado nativo, mensajes de error diferenciados (sin conexión vs. rate limit vs. credenciales inválidas) sin borrar los datos tipeados, y navegación funcional desde *"¿Olvidaste tu contraseña?"*.
3. **Flujo visual completo de Recuperación de Contraseña (`/forgot-password`):** Experiencia en 3 pasos + confirmación final con **simulación Beta guiada** (código demo `482910`, sin envío de correos reales) y **checklist en vivo** alineado con las reglas reales de `Password.java` del backend.
4. **Replicabilidad entre versiones:** Diseño desacoplado de URLs de entorno para poder replicarlo posteriormente sobre `develop` (red local) y `feature/cloudflare-tunnel` (`agrotrackapp.com.ar`).

---

## 2. Arquitectura, Rutas y Reglas de Navegación

### 2.1. Rutas (`src/app/app.routes.ts`)
- Mantener la redirección raíz `''` → `'login'`.
- Agregar la ruta pública protegida por `noAuthGuard`:
  - `path: 'forgot-password'`
  - `loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)`
  - `canActivate: [noAuthGuard]`

### 2.2. Visibilidad del Menú Lateral (`src/app/app.component.html`)
- `app.component.html` ya deshabilita el menú lateral mediante `[disabled]="(authService.authStatus$ | async) === false"`.
- Al permanecer `authStatus$` en `false` durante `/login` y `/forgot-password`, el `ion-menu` continuará oculto y bloqueado hasta completar una autenticación real.

### 2.3. Estructura de Archivos (Standalone Components)
Siguiendo `AGENTS.md` y la organización actual de `src/app/features/auth/`:
- `src/app/features/auth/login/` *(existente — actualización UX)*:
  - `login.component.ts`
  - `login.component.html`
  - `login.component.scss`
- `src/app/features/auth/forgot-password/` *(nuevo)*:
  - `forgot-password.component.ts` (`standalone: true`)
  - `forgot-password.component.html`
  - `forgot-password.component.scss`
- `src/app/core/auth/utils/password-policy.util.ts` *(nuevo — helper puro reutilizable para evaluar las reglas de `Password.java` y facilitar tests unitarios)*.

---

## 3. Especificación Funcional y Visual

### 3.1. Mejoras en `LoginComponent` (Misma Visual Actual)
Manteniendo la estructura actual (`.login-container`, `.logo-section`, `ion-list lines="full"`, `.error-msg`, `.form-actions`, `.login-footer`), se incorporan:

1. **Botón mostrar/ocultar contraseña (ojito):**
   - `ion-button` transparente (`fill="clear"`, `type="button"`, `slot="end"`) dentro del `ion-item` de contraseña para alternar `showPassword` (`type="password"` ↔ `type="text"`).
   - Íconos `eye-outline` / `eye-off-outline` con `aria-label` accesible y tamaño táctil cómodo sin interferir con autofill nativo del sistema operativo.
2. **Teclado y autocompletado móvil:**
   - Correo: `type="email"`, `inputmode="email"`, `autocomplete="email"`, `autocapitalize="off"`.
   - Contraseña: `autocomplete="current-password"`.
3. **Feedback de errores claro y preservación de entrada:**
   - Ante error HTTP en `onSubmit()`, **no limpiar** `credentials.email` ni `credentials.password`.
   - Diferenciar el mensaje mostrado en `.error-msg`:
     - **Offline / Timeout (`status === 0` o `!networkService.isOnlineSnapshot`):** *"Sin conexión o servidor inaccesible. Verificá tu red e intentá nuevamente."*
     - **Demasiados intentos (`status === 429`):** *"Demasiados intentos de inicio de sesión. Esperá un minuto antes de reintentar."*
     - **Credenciales incorrectas (`status === 401` / `403`):** *"Correo electrónico o contraseña incorrectos."*
     - **Otro error inesperado:** mensaje informativo del servidor (si viene estructurado) o fallback claro.
4. **Enlace activo de recuperación:**
   - Reemplazar `<a href="#" class="forgot-password">` por navegación con `routerLink="/forgot-password"`.

---

### 3.2. Nuevo Módulo Visual `ForgotPasswordComponent` (`/forgot-password`)

Reutiliza la misma línea estética de `LoginComponent` (`.login-container`, `.logo-section` con logo + badge `BETA`, campos en `ion-list` con `labelPlacement="floating"`, botones `expand="block"` en color `primary` `#0d8a5c` y enlaces en `--ion-color-primary`).

#### Máquina de estados de la vista
`step: 'EMAIL' | 'OTP' | 'NEW_PASSWORD' | 'SUCCESS'`

#### Paso 1 — Solicitud por Correo (`EMAIL`)
- **Contenido:**
  - Título/subtítulo breve indicando el paso (*"Recuperar contraseña"* / *"Ingresá tu correo electrónico para recibir un código de verificación."*).
  - Campo de correo electrónico (`type="email"`, `inputmode="email"`, `autocapitalize="off"`, validación de formato al enviar o al salir del campo).
  - Botón primario `"Enviar código"` con `ion-spinner` breve simulado (`~450 ms`) para emular el feedback real de carga.
  - Enlace al pie `"Volver a iniciar sesión"` (`routerLink="/login"`).
- **Transición:** al enviar un correo con formato válido, avanza a `OTP` e inicia el temporizador de reenvío (`60 s`).

#### Paso 2 — Código de Verificación de 6 Dígitos (`OTP`)
- **Simulación Beta Guiada (sin correo real):**
  - Banner informativo discreto en la vista (y opcional toast inicial) explicando claramente:  
    *"Modo Beta: el envío de correos está deshabilitado. Usá el código demo **`482910`** para continuar."*
  - Posibilidad de autocompletar el código demo con un toque desde un botón sutil dentro del aviso o tipearlo manualmente.
- **Entrada OTP de 6 casillas:**
  - Fila centrada de **6 casillas numéricas individuales** (`inputmode="numeric"`, `maxlength="1"`), visualmente limpias y con foco resaltado en `#0d8a5c`.
  - **Auto-avance** al casillero siguiente al escribir un dígito.
  - **Retroceso con `Backspace`** hacia el casillero anterior cuando la casilla actual está vacía.
  - **Soporte de pegado (`paste`)** para pegar los 6 dígitos de una vez.
- **Acciones y validaciones:**
  - Si se ingresa un código de 6 dígitos distinto a `482910`, mostrar `.error-msg` con texto claro: *"Código incorrecto. En esta Beta podés usar el código demo 482910."*
  - **Temporizador de reenvío:** muestra `"Reenviar código en Xs"` mientras corre la cuenta regresiva; al llegar a `0`, habilita el enlace/botón `"Reenviar código"` (reinicia los `60 s` y vuelve a notificar el código demo `482910`).
  - Botón `"Verificar código"` y acciones secundarias para `"Cambiar correo"` (vuelve a `EMAIL`) o `"Volver a iniciar sesión"`.

#### Paso 3 — Nueva Contraseña + Checklist en Vivo (`NEW_PASSWORD`)
- **Campos:**
  - `"Nueva contraseña"` (con botón ojito `eye-outline` / `eye-off-outline`).
  - `"Confirmar contraseña"` (con botón ojito independiente).
- **Checklist en vivo (paridad 1:1 con `Password.java` en Backend):**
  Debajo de los campos se muestran los requisitos evaluados en tiempo real al escribir:
  1. **Mínimo 9 caracteres** (`password.length >= 9`)
  2. **Al menos una letra mayúscula** (`/[A-Z]/`)
  3. **Al menos una letra minúscula** (`/[a-z]/`)
  4. **Al menos un número** (`/[0-9]/`)
  5. **Sin secuencias numéricas crecientes** (ej. `123`, `456`: verifica que no existan 3 dígitos consecutivos donde `d2 === d1 + 1 && d3 === d2 + 1`, replicando `hasIncreasingNumberSequence` de `Password.java`)
  6. **Las contraseñas coinciden** (`confirmPassword.length > 0 && password === confirmPassword`)
- Cada ítem cambia dinámicamente su estado visual (ícono neutral en gris cuando falta → `checkmark-circle` verde `#0d8a5c` cuando cumple).
- El botón primario `"Actualizar contraseña"` solo se habilita cuando los 6 ítems están cumplidos y simula brevemente el guardado (`~500 ms`) antes de pasar a `SUCCESS`.

#### Estado Final — Confirmación (`SUCCESS`)
- Tarjeta/sección limpia con ícono de éxito en verde primario, título *"¡Contraseña actualizada!"*.
- Nota breve y honesta para entorno Beta: *"Simulación visual completada. En esta versión Beta el cambio no modifica tu contraseña actual del servidor."* (evita confusión de QA al volver a ingresar).
- Botón primario `"Ir a iniciar sesión"` que redirige a `/login` (`replaceUrl: true`) limpiando el estado temporal del flujo.

---

## 4. Restricciones Técnicas de Implementación (Mobile)

- **Angular 22 + Zoneless / Change Detection:** invocar `ChangeDetectorRef.detectChanges()` tras callbacks asíncronos (simulaciones de envío, listeners de OTP, `setInterval` del temporizador de reenvío) y liberar timers en `ngOnDestroy()`.
- **Standalone Components:** prohibido usar `NgModule`; declarar explícitamente imports de Ionic y registrar nuevos íconos con `addIcons(...)` desde `ionicons/icons`.
- **Presupuesto de estilos (`angular.json`):** respetar estrictamente el límite `anyComponentStyle` (`maximumWarning: 2kb`, `maximumError: 4kb`) manteniendo cada `.scss` por debajo de `2 kB` (y siempre `< 4.00 kB`).
- **Light Mode obligatorio:** no agregar soporte ni overrides para Dark Mode; usar variables de `src/theme/variables.scss` para mantener contraste en exteriores bajo luz solar.

---

## 5. Contrato API Documentado para Futura Integración con Backend

Cuando se habilite la recuperación real contra Spring Boot, no será necesario rediseñar la UI ni el flujo: bastará reemplazar las simulaciones locales por llamadas HTTP en `AuthService` respetando el siguiente contrato y consideraciones detectadas en el repositorio `Backend/AgroTrack`.

### 5.1. Endpoints REST propuestos (`AuthController` — `/api/v1/auth`)

1. **`POST /api/v1/auth/forgot-password`** (Público)
   - **Request (`ForgotPasswordRequest`):**
     ```json
     {
       "email": "usuario@agrotrack.com.ar"
     }
     ```
   - **Response `200 OK`:**
     ```json
     {
       "message": "Si existe una cuenta asociada a ese correo, te enviamos un código de verificación."
     }
     ```
   - **Notas Backend:**
     - Responder siempre `200 OK` con mensaje neutro aunque el email no exista (anti-enumeración).
     - Generar código numérico de 6 dígitos con `SecureRandom`, almacenarlo con expiración corta (`10-15 minutos`), límite de intentos fallidos e invalidación de códigos previos del usuario.
     - Ejecutar el envío vía `EmailService` en método anotado con **`@Async`** para responder de inmediato y evitar que el SMTP exceda el timeout del cliente móvil.

2. **`POST /api/v1/auth/reset-password/verify`** (Público — opcional si se valida antes del Paso 3)
   - **Request (`VerifyResetCodeRequest`):**
     ```json
     {
       "email": "usuario@agrotrack.com.ar",
       "code": "482910"
     }
     ```
   - **Response `200 OK`:** `{ "valid": true }`
   - **Response `400 Bad Request` / `410 Gone`:** `{ "message": "El código es inválido o expiró." }`

3. **`POST /api/v1/auth/reset-password`** (Público)
   - **Request (`ResetPasswordRequest`):**
     ```json
     {
       "email": "usuario@agrotrack.com.ar",
       "code": "482910",
       "newPassword": "NuevaPassword9"
     }
     ```
   - **Response `200 OK`:**
     ```json
     {
       "message": "Contraseña actualizada correctamente."
     }
     ```
   - **Errores esperados:**
     - `400 Bad Request`: código inválido o contraseña rechazada por `Password.java`.
     - `410 Gone`: código expirado.
     - `429 Too Many Requests`: límite de intentos excedido.

### 5.2. Consideraciones de Seguridad y Red al Conectar
- **Mobile (`src/app/core/auth/interceptors/auth.interceptor.ts`):** agregar `/auth/forgot-password` y `/auth/reset-password` en `isAuthPublic` (actualmente solo incluye `/auth/login` y `/auth/register`) y verificar el timeout de `3500 ms` si algún endpoint no responde asíncronamente.
- **Backend (`SecurityConfig.java`):** `/api/v1/auth/**` ya cuenta con `.permitAll()`.
- **Backend (`RateLimitingFilter.java`):** extender el filtro Bucket4j (actualmente aplicado solo a `/api/v1/auth/login` y `/api/v1/auth/register` con 5 req/min) para proteger los endpoints de recuperación contra spam SMTP y fuerza bruta sobre códigos de 6 dígitos.

---

## 6. Plan de Implementación y Verificación

- [x] Alinear `develop` local con `origin/develop` (`9fc7735`), crear rama `feature/auth-recovery-ui` y redactar `docs/specs/12-login-ux-and-password-recovery.md`.
- [x] Crear `src/app/core/auth/utils/password-policy.util.ts` con la lógica exacta de validación de `Password.java` y sus pruebas unitarias (`password-policy.util.spec.ts`).
- [x] Mejorar `LoginComponent` (`login.component.html/.ts/.scss`): toggle ojito, teclado email, errores diferenciados sin borrar datos, link a `/forgot-password` y pruebas unitarias (`login.component.spec.ts`).
- [x] Implementar `ForgotPasswordComponent` (`EMAIL` → `OTP` 6 casillas con simulación Beta `482910` → `NEW_PASSWORD` con checklist en vivo → `SUCCESS`), registrar `/forgot-password` en `app.routes.ts` y agregar pruebas unitarias (`forgot-password.component.spec.ts`).
- [x] Verificar build de producción (`npm run build`), cumplimiento de presupuestos SCSS (`< 2.00 kB`), suite de tests (`ng test`) y revisión de cambios.
- [x] Actualizar `MEMORY.md` con el cierre de la Spec 12.
- [ ] *(Posterior a revisión)* Replicar los cambios de UI en `develop` y en `feature/cloudflare-tunnel` preservando la configuración específica del túnel.
