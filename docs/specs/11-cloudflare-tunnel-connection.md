# Spec 11: Conexión Productiva de la App Móvil y APK mediante Cloudflare Tunnel (`agrotrackapp.com.ar`)

**Status:** Draft  
**Date:** 2026-11-13  
**Target Repository:** `AgroTrack Mobile`  
**Target Branch:** `feature/cloudflare-tunnel`

## 1. Objetivo
Configurar y adaptar la aplicación móvil de AgroTrack para que, al compilarse y empaquetarse como APK instalable en dispositivos Android, se conecte directamente a los contenedores Docker del servidor a través del **túnel seguro de Cloudflare (`https://agrotrackapp.com.ar`)** y el Reverse Proxy Nginx existente:
1. **Endpoints Productivos sobre HTTPS (`environment.ts` y `environment.prod.ts`):** Apuntar `apiUrl`, `wsUrl` y `minioBaseUrl` a `https://agrotrackapp.com.ar` aprovechando las rutas proxy ya expuestas por el contenedor `frontend-azuretest` (`/api/v1`, `/ws` y `/storage/`).
2. **Normalización y Reescritura de URLs de Almacenamiento (`Azurite / Blob Storage`):** Garantizar que cualquier URL interna devuelta por el backend con hosts locales de Docker (`azurite-azuretest:10000`, `localhost:10000`, `127.0.0.1:10000`) en imágenes de novedades, tareas o tiles de mapas espectrales se reescriba hacia el proxy público `https://agrotrackapp.com.ar/storage/...`.
3. **Bypass de Autorización JWT hacia `/storage/` (`auth.interceptor.ts`):** Evitar la inyección de la cabecera `Authorization: Bearer <JWT>` en peticiones dirigidas a `/storage/`, `blob.core.windows.net` o `10000/devstoreaccount1`, previniendo rechazos 403/400 de Azurite/Blob Storage.
4. **Compatibilidad WebSocket (SockJS / STOMP sobre TLS) y Capacitor Android:** Asegurar que la conexión en tiempo real (`/ws`) negocie `wss://` de forma transparente sobre HTTPS y que `capacitor.config.ts` mantenga la configuración adecuada para producción.

---

## 2. Dependencias, Configuración y Servicios Afectados

### 2.1. Variables de Entorno (`src/environments/`)
- `src/environments/environment.ts` y `src/environments/environment.prod.ts`:
  - `apiUrl`: `'https://agrotrackapp.com.ar/api/v1'`
  - `wsUrl`: `'https://agrotrackapp.com.ar/ws'`
  - `minioBaseUrl`: `'https://agrotrackapp.com.ar/storage/devstoreaccount1/agrotrack-files/'`

### 2.2. Interceptor HTTP (`src/app/core/auth/interceptors/auth.interceptor.ts`)
- Excluir explícitamente de la inyección del token JWT las peticiones cuya URL contenga:
  - `/storage/`
  - `blob.core.windows.net`
  - `:10000/devstoreaccount1`

### 2.3. Resolución de Imágenes y Tiles Espectrales
- `src/app/core/services/alert.service.ts` (`resolveImageUrl`):
  - Si `imagePath` es una URL absoluta (`http://` o `https://`) cuyo hostname sea `azurite-azuretest`, `localhost` o `127.0.0.1` (o puerto `10000`), reescribirla usando el origen público `/storage` derivado de `environment.minioBaseUrl` (`https://agrotrackapp.com.ar/storage${parsed.pathname}${parsed.search}`).
- `src/app/core/services/task.service.ts` (`resolveImageUrl`):
  - Aplicar la misma regla de reescritura hacia `/storage` para imágenes de tareas y evidencias de cierre.
- `src/app/feature/mapa/mapa.page.ts` y `src/app/feature/cultivos/pages/cultivo-detalle/cultivo-detalle.page.ts`:
  - Normalizar la construcción de `tileUrl` para que si `mapa.tilesBaseUrl` incluye una URL interna de `azurite-azuretest` o ruta relativa, resuelva siempre contra `environment.minioBaseUrl` sin reemplazar por `localhost`.

---

## 3. Flujo de Red a través de Cloudflare Tunnel y Nginx
1. **API REST:** `App Móvil` $\rightarrow$ `https://agrotrackapp.com.ar/api/v1/...` $\rightarrow$ `Cloudflare Tunnel` $\rightarrow$ `Nginx (frontend-azuretest:80)` $\rightarrow$ `backend-azuretest:8080/api/v1/...`.
2. **WebSockets (SockJS/STOMP):** `App Móvil` $\rightarrow$ `https://agrotrackapp.com.ar/ws` (`wss://`) $\rightarrow$ `Cloudflare Tunnel` $\rightarrow$ `Nginx (Upgrade: websocket)` $\rightarrow$ `backend-azuretest:8080/ws`.
3. **Archivos y Tiles (Azurite):** `App Móvil` $\rightarrow$ `https://agrotrackapp.com.ar/storage/devstoreaccount1/agrotrack-files/...` $\rightarrow$ `Cloudflare Tunnel` $\rightarrow$ `Nginx (rewrite ^/storage/(.*) /$1)` $\rightarrow$ `azurite-azuretest:10000`.

---

## 4. Restricciones Técnicas
- No modificar rutas ni configuraciones de Cloudflare Tunnel ni `nginx.conf` del frontend web, ya que ambos soportan actualmente `/api/`, `/ws` y `/storage/` bajo `agrotrackapp.com.ar`.
- Mantener el soporte **Online-First + Outbox (Spec 10)** intacto: los endpoints relativos almacenados en la cola Outbox se resuelven automáticamente contra el nuevo `environment.apiUrl`.
- Presupuesto SCSS estricto (`< 4.00 kB`).

---

## 5. Plan de Implementación
- [x] Crear la rama `feature/cloudflare-tunnel` y el archivo `docs/specs/11-cloudflare-tunnel-connection.md`.
- [ ] Actualizar `src/environments/environment.ts` y `src/environments/environment.prod.ts` con las URLs de `https://agrotrackapp.com.ar`.
- [ ] Agregar bypass de `/storage/` y Blob Storage en `src/app/core/auth/interceptors/auth.interceptor.ts`.
- [ ] Actualizar `resolveImageUrl` en `alert.service.ts` y `task.service.ts` para reescribir hosts internos (`azurite-azuretest`, `localhost:10000`) hacia el proxy `/storage/`.
- [ ] Ajustar la resolución de `tileUrl` en `mapa.page.ts` y `cultivo-detalle.page.ts`.
- [ ] Validar compilación (`npm run build`), sincronizar Android (`npx cap sync android`) y actualizar `MEMORY.md`.
