# AgroTrack: decision support system for agricultural management and traceability

AgroTrack Mobile is an Android and web field-companion application that solves real-time monitoring, communication, and operational traceability gaps across agricultural and livestock farms, even in low-connectivity rural environments.

> **Web-First Onboarding:** This mobile application is designed exclusively for users who already hold an active AgroTrack Web service account. User self-registration is intentionally not available inside the mobile app; accounts and initial organization onboarding happen via the Web platform (or via API during local setup below).

---

## Features

### Screens & Navigation
The app uses a mixed navigation shell anchored by a swipe-enabled side menu (`ion-menu` with `maxEdgeStart="70"`) and guarded lazy-loaded routes:

- **Login & Password Recovery (`/login`, `/forgot-password`):** Direct login for existing Web subscribers powered by `ReactiveFormsModule` (`FormBuilder` + `Validators`), session expiration enforcement, and a multi-step visual OTP password recovery flow (without in-app account creation).
- **Dashboard & Farm Selector (`/home`):** Active farm switcher, real-time alert monitoring, quick metrics, and interactive summary modals (`ion-modal`).
- **Interactive Geospatial Map (`/mapa`):** Satellite (Google) and topographic (OpenTopoMap) base layers, spectral index overlays, SENASA livestock category filters, freehand polygon/rectangle/circle lot drawing (`@geoman-io/leaflet-geoman-free`) with a reactive creation modal form (`loteForm`), and bottom-sheet lot details (`ion-modal` with breakpoints).
- **Crops Management (`/cultivos`, `/cultivos/nuevo`, `/cultivos/editar/:id`, `/cultivos/:id`):** Crop inventory with pull-to-refresh (`ion-refresher`), reactive agronomic & RENSPA (SENASA) form (`cultivoForm`) featuring species autocomplete and a live satellite polygon preview.
- **Field News & Incidents (`/novedades`, `/novedades/nueva`, `/novedades/:id`):** Field event reporting with georeferenced GPS coordinates and camera photo evidence.
- **Operational Tasks (`/tareas`, `/tareas/nueva`, `/tareas/:id`):** Task listing with pull-to-refresh (`ion-refresher`), assignment workflows, evidence photo uploads, and completion tracking.
- **Farm Configuration & Personnel (`/configuracion`, `/personas`):** Farm profile management, IoT livestock collar pairing, personnel directory/roles, and an offline sync queue inspection modal.

### Native Capacitor Plugins
- **Camera (`@capacitor/camera`):** Captures field photo evidence directly from device camera or gallery in tasks and news reports.
- **Geolocation (`@capacitor/geolocation`):** Tags field reports and operational tasks with live GPS coordinates.
- **Local Notifications (`@capacitor/local-notifications`):** Delivers device-level alerts triggered by real-time WebSocket updates and task notifications.
- **Preferences (`@capacitor/preferences`):** Persists JWT session tokens, active farm context, offline read caches, and queued mutations.
- **Network (`@capacitor/network`):** Monitors device connectivity transitions to switch seamlessly between online API requests and offline fallback/sync.
- **App Lifecycle (`@capacitor/app`), Haptics, Keyboard & Status Bar:** Handles foreground resume (`appStateChange`) session checks, sync triggers, and native mobile ergonomics.

---

## Technologies

- **Ionic 9** (`@ionic/angular` `^9.0.0`)
- **Angular 22** (Standalone Components, `ReactiveFormsModule`, RxJS)
- **Capacitor 8** (`@capacitor/core` `8.5.2`, `@capacitor/android` `^8.5.2`)
- **Mapping & Realtime:** Leaflet `^1.9.4`, `@geoman-io/leaflet-geoman-free`, `@stomp/rx-stomp`, `sockjs-client`
- **Testing:** Vitest (`~4.0.18`) via Angular CLI (`ng test`)

---

## Requirements

- **Node.js 22+** and **npm**
- **Docker** & **Docker Compose** (to run PostgreSQL/PostGIS, Azurite, and the Backend API locally)
- **AgroTrack Backend & Databases running:**
  - Spring Boot REST API + STOMP WebSocket service (`AgroTrack-agricultural-tracking-system`)
  - **PostgreSQL / PostGIS** database (`postgis/postgis:14-3.3`) and **Azurite** object storage (`mcr.microsoft.com/azure-storage/azurite` on port `10000`, for uploaded field photos and spectral map tiles)
  - Configure `apiUrl`, `wsUrl`, and `minioBaseUrl` in `src/environments/environment.ts` to point to your active backend/storage host.
- **Android Studio & Android SDK** (required for native Android builds and emulator/device deployment).

---

## Installation and Execution

### 1. Start the Backend and Databases (Docker)

Clone the backend repository (if `docker-compose.yml` and `Dockerfile` are not on your checked-out branch yet, switch to `deploy/version-beta-1.0` or add the compose definition below):

```bash
git clone https://github.com/J-S-M-Code/AgroTrack-agricultural-tracking-system.git
cd AgroTrack-agricultural-tracking-system
git checkout deploy/version-beta-1.0
```

Clean `docker-compose.yml` definition for local PostgreSQL/PostGIS, Azurite (Blob storage), and the Spring Boot backend:

```yaml
services:
  db-azuretest:
    image: postgis/postgis:14-3.3
    container_name: agrotrack-postgres-azuretest
    restart: always
    environment:
      POSTGRES_USER: pgadmin
      POSTGRES_PASSWORD: admin123
      POSTGRES_DB: agrotrack
    ports:
      - "5433:5432"
    volumes:
      - agrotrack_db_data:/var/lib/postgresql/data
    networks:
      - agrotrack-net

  azurite-azuretest:
    image: mcr.microsoft.com/azure-storage/azurite
    container_name: agrotrack-azurite-azuretest
    restart: always
    ports:
      - "10000:10000"
      - "10001:10001"
      - "10002:10002"
    volumes:
      - agrotrack_blob_data:/data
    networks:
      - agrotrack-net

  backend-azuretest:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: agrotrack-backend-azuretest
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SPRING_DATASOURCE_URL=jdbc:postgresql://db-azuretest:5432/agrotrack
      - SPRING_DATASOURCE_USERNAME=pgadmin
      - SPRING_DATASOURCE_PASSWORD=admin123
      - AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://azurite-azuretest:10000/devstoreaccount1;
      - AZURE_STORAGE_CONTAINER_NAME=agrotrack-files
    depends_on:
      - db-azuretest
      - azurite-azuretest
    networks:
      - agrotrack-net

networks:
  agrotrack-net:
    driver: bridge

volumes:
  agrotrack_db_data:
  agrotrack_blob_data:
```

Launch the databases and backend container:

```bash
docker compose up -d --build db-azuretest azurite-azuretest backend-azuretest
```

This exposes:
- Backend REST API & WebSockets: `http://localhost:8080`
- PostgreSQL / PostGIS: `localhost:5433` (user `pgadmin`, database `agrotrack`)
- Azurite Blob Storage: `http://localhost:10000/devstoreaccount1`

### 2. Seed an Initial User and Farm from the Console

Because the mobile app only provides direct sign-in for existing users, use the Backend REST API from your terminal to register a base account and create an initial farm before logging into the app (password must satisfy the domain policy: 9+ characters with uppercase, lowercase, digit, and no ascending 3-digit sequence):

**Bash (`curl` + `jq` / Python):**

```bash
# 1. Register user and extract the JWT token
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Joaquin",
    "lastName": "Productor",
    "dni": "35123456",
    "phone": "+5493804123456",
    "address": "Ruta 40 Km 12",
    "email": "productor@agrotrack.com",
    "password": "AgroTrack951",
    "acceptedTerms": true
  }' | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

# 2. Create the initial farm (assigns the user automatically as OWNER)
curl -X POST http://localhost:8080/api/v1/farms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Finca Los Olivos",
    "companyName": "AgroTrack Demo S.A.",
    "cuit": "30-71234567-9",
    "numberRENAPSA": "12.345.678/01",
    "productiveOrientation": "MIXED",
    "address": "Valle Antinaco, La Rioja",
    "surface": 100.0,
    "polygonLimit": {
      "type": "Polygon",
      "coordinates": [[
        [-67.50, -29.16],
        [-67.49, -29.16],
        [-67.49, -29.15],
        [-67.50, -29.15],
        [-67.50, -29.16]
      ]]
    }
  }'
```

**PowerShell (`Invoke-RestMethod`):**

```powershell
# 1. Register user and capture the JWT token
$auth = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/v1/auth/register" `
  -ContentType "application/json" `
  -Body (@{
    name = "Joaquin"
    lastName = "Productor"
    dni = "35123456"
    phone = "+5493804123456"
    address = "Ruta 40 Km 12"
    email = "productor@agrotrack.com"
    password = "AgroTrack951"
    acceptedTerms = $true
  } | ConvertTo-Json)

# 2. Create the initial farm (assigns the user automatically as OWNER)
$headers = @{ Authorization = "Bearer $($auth.token)" }
$farmBody = @{
  name = "Finca Los Olivos"
  companyName = "AgroTrack Demo S.A."
  cuit = "30-71234567-9"
  numberRENAPSA = "12.345.678/01"
  productiveOrientation = "MIXED"
  address = "Valle Antinaco, La Rioja"
  surface = 100.0
  polygonLimit = @{
    type = "Polygon"
    coordinates = @(,@(
      @(-67.50, -29.16),
      @(-67.49, -29.16),
      @(-67.49, -29.15),
      @(-67.50, -29.15),
      @(-67.50, -29.16)
    ))
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/v1/farms" `
  -Headers $headers -ContentType "application/json" -Body $farmBody
```

You can now sign into the mobile app with `productor@agrotrack.com` / `AgroTrack951` and select **Finca Los Olivos**.

### 3. Clone and Run the Mobile App (`main` branch)

```bash
git clone -b main https://github.com/J-S-M-Code/AgroTrack-mobile.git
cd AgroTrack-mobile
npm install
```

Update `src/environments/environment.ts` to match your backend host (`localhost` for web, `10.0.2.2` for Android Emulator, or your LAN IP for a physical device):

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api/v1',
  wsUrl: 'http://localhost:8080/ws',
  minioBaseUrl: 'http://localhost:10000/devstoreaccount1/agrotrack-files/'
};
```

Run the development server and unit tests:

```bash
npm start
npx ng test --watch=false
```

---

## Native Build

```bash
npm run build
npx cap sync android
npx cap open android
```

From Android Studio, select a physical device or AVD emulator and run **Run 'app'** (or build the APK).

---

## Technical Decisions

- **Standalone Architecture & Enforced Light Theme:** Every screen is built as an Angular 22 standalone component with lazy-loaded routes protected by `authGuard`/`noAuthGuard`, avoiding `NgModule` overhead. `src/theme/variables.scss` enforces an AgroTrack Light Mode palette (`#0d8a5c` primary) alongside custom Android adaptive launcher icons and branded splash screens for outdoor field visibility.
- **Reactive Forms (`ReactiveFormsModule`) & Session Lifecycle Security:** Core forms—Authentication (`LoginComponent`), Map Lot Creation (`MapaPage`), and Crop Registration/Edition (`CultivoFormPage`)—use `FormBuilder`, `FormGroup`, and `Validators` for explicit validation rules. `AuthService` and `authInterceptor` combine expiration timers, foreground `appStateChange` validation, and automatic `401` logout so expired sessions cannot linger offline or online.
- **Online-First Offline Fallback & Outbox Queue:** `authInterceptor` enforces fast request timeouts (`3500ms` standard / `7000ms` images) to detect drops rapidly via `NetworkService`. `@capacitor/preferences` was chosen over SQLite for `OfflineStorageService` and `SyncService` to provide zero-migration JSON persistence for farm caches and a deferred outbox queue with automatic replay upon reconnection.
- **Native Sensor & Mapping Integration:** `@capacitor/camera`, `@capacitor/geolocation`, and `@capacitor/local-notifications` are wrapped with centralized runtime permission checks (`PermissionService`), while Leaflet + Geoman allow field operators to draw and inspect spatial polygons directly inside Capacitor's WebView without third-party proprietary map SDK fees.

---

## Author

- **Joaquín Suilar Murcia** — Systems Engineering
