import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, forkJoin, from, of, takeUntil, switchMap, catchError } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonList,
  IonItem,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon,
  IonSpinner,
  ToastController,
  ViewDidEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  documentTextOutline,
  linkOutline,
  locationOutline,
  navigateOutline,
  createOutline,
  trashOutline,
  cameraOutline,
  imagesOutline,
  closeCircle,
  checkmarkCircleOutline,
  warningOutline,
  mapOutline,
} from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import * as L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';

import { AlertService } from '../../../../core/services/alert.service';
import { LotService } from '../../../../core/services/lot.service';
import { CropService } from '../../../../core/services/crop.service';
import { AnimalService } from '../../../../core/services/animal.service';
import { ContextService } from '../../../../core/services/context.service';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { UserService } from '../../../../core/services/user.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { NetworkService } from '../../../../core/services/network.service';
import { SyncService } from '../../../../core/services/sync.service';
import { OutboxAttachment } from '../../../../core/models/sync.model';
import {
  ALERT_PRIORITY_OPTIONS,
  AlertPriority,
  RecordType,
} from '../../../../core/models/novedad.model';
import { Lot } from '../../../../core/models/lot.model';
import { Cultivo } from '../../../../core/models/cultivo.model';
import { Animal } from '../../../../core/models/animal.model';

interface FotoAdjunta {
  blob: Blob;
  ext: 'jpg' | 'png' | 'webp';
  previewUrl: string;
  sizeBytes: number;
}

@Component({
  selector: 'app-novedad-form',
  templateUrl: './novedad-form.page.html',
  styleUrls: ['./novedad-form.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonCard,
    IonCardContent,
    IonList,
    IonItem,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
})
export class NovedadFormPage implements OnInit, OnDestroy, ViewDidEnter {
  @ViewChild('fileInputFallback') fileInputRef?: ElementRef<HTMLInputElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private networkService = inject(NetworkService);
  private syncService = inject(SyncService);
  private lotService = inject(LotService);
  private cropService = inject(CropService);
  private animalService = inject(AnimalService);
  private contextService = inject(ContextService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private permissionService = inject(PermissionService);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  private readonly MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
  private readonly MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB

  farmId = '';
  farmName = '';
  userRole = '';
  authorId: string | null = null;
  autorNombre = 'Usuario';

  // Preselección opcional por query params
  private preselectedLotId = '';
  private preselectedCropId = '';

  // Campos del formulario
  titulo = '';
  recordType: RecordType = 'ALERT';
  priority: AlertPriority = 'MEDIUM';
  fechaHora = '';
  descripcion = '';

  prioridadesOpciones = ALERT_PRIORITY_OPTIONS;
  tiposEntidadDisponibles: ('Lote' | 'Cultivo' | 'Animal')[] = ['Lote', 'Cultivo', 'Animal'];
  tipoEntidadSeleccionada: 'Lote' | 'Cultivo' | 'Animal' = 'Lote';
  entidadIdSeleccionada = '';

  lotesDisponibles: Lot[] = [];
  cultivosDisponibles: Cultivo[] = [];
  animalesDisponibles: Animal[] = [];

  // Sensores: GPS y Mapa
  private map?: L.Map;
  private polygonBaseLayer?: L.Polygon;
  private subZonaLayer?: L.Polygon;
  private gpsMarker?: L.Marker;

  isGettingGps = false;
  isDrawingSubZone = false;
  gpsMensaje = '';
  gpsLatLng: [number, number] | null = null; // [lat, lng] para UI/Leaflet
  centroidCoords: [number, number] | null = null; // [lng, lat] GeoJSON
  poligonoDibujadoCoords: [number, number][] | null = null; // [lng, lat][] GeoJSON

  // Sensor Cámara / Evidencia Fotográfica
  fotosAdjuntas: FotoAdjunta[] = [];

  // Estados de envío
  isLoadingData = true;
  isSubmitting = false;
  formError = '';

  constructor() {
    addIcons({
      documentTextOutline,
      linkOutline,
      locationOutline,
      navigateOutline,
      createOutline,
      trashOutline,
      cameraOutline,
      imagesOutline,
      closeCircle,
      checkmarkCircleOutline,
      warningOutline,
      mapOutline,
    });
  }

  async ngOnInit() {
    this.fechaHora = this.obtenerFechaHoraLocalActual();
    this.preselectedLotId = this.route.snapshot.queryParamMap.get('lotId') || '';
    this.preselectedCropId = this.route.snapshot.queryParamMap.get('cropId') || '';

    this.authorId = await this.authService.getUserId();

    this.userService
      .getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.autorNombre = user.name
            ? `${user.name}${user.lastName ? ' ' + user.lastName : ''}`
            : 'Usuario';
          if (user.id) {
            this.authorId = user.id;
          }
          this.cdr.detectChanges();
        },
        error: () => {},
      });

    this.contextService.userRole$
      .pipe(takeUntil(this.destroy$))
      .subscribe((role) => {
        this.userRole = role;
        this.configurarTiposEntidadPorRol(role);
        this.cdr.detectChanges();
      });

    this.contextService.selectedFarm$
      .pipe(takeUntil(this.destroy$))
      .subscribe((farm) => {
        if (farm) {
          this.farmId = farm.id;
          this.farmName = farm.name;
          this.cargarEntidadesDisponibles();
        }
      });
  }

  ionViewDidEnter() {
    setTimeout(() => {
      if (!this.map) {
        this.iniciarMapa();
      } else {
        this.map.invalidateSize();
      }
      this.actualizarMapaSegunEntidad();
    }, 220);
  }

  ngOnDestroy() {
    this.limpiarFotos();
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private obtenerFechaHoraLocalActual(): string {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  private configurarTiposEntidadPorRol(role: string) {
    if (role === 'AGRONOMIST') {
      this.tiposEntidadDisponibles = ['Lote', 'Cultivo'];
    } else if (role === 'VETERINARIAN') {
      this.tiposEntidadDisponibles = ['Animal'];
    } else {
      this.tiposEntidadDisponibles = ['Lote', 'Cultivo', 'Animal'];
    }

    if (!this.tiposEntidadDisponibles.includes(this.tipoEntidadSeleccionada)) {
      this.tipoEntidadSeleccionada = this.tiposEntidadDisponibles[0];
    }
  }

  cargarEntidadesDisponibles() {
    if (!this.farmId) return;
    this.isLoadingData = true;

    forkJoin({
      lots: this.lotService.getLotsByFarm(this.farmId).pipe(catchError(() => of([]))),
      crops: this.cropService.getCropsByFarm(this.farmId).pipe(catchError(() => of([]))),
      animals: this.animalService.getAnimalsByFarm(this.farmId).pipe(catchError(() => of([]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ lots, crops, animals }) => {
          this.lotesDisponibles = lots;
          this.cultivosDisponibles = crops;
          this.animalesDisponibles = animals;
          this.isLoadingData = false;

          // Aplicar preselección por query param si existe
          if (
            this.preselectedCropId &&
            this.tiposEntidadDisponibles.includes('Cultivo')
          ) {
            this.tipoEntidadSeleccionada = 'Cultivo';
            this.entidadIdSeleccionada = this.preselectedCropId;
          } else if (
            this.preselectedLotId &&
            this.tiposEntidadDisponibles.includes('Lote')
          ) {
            this.tipoEntidadSeleccionada = 'Lote';
            this.entidadIdSeleccionada = this.preselectedLotId;
          }

          this.cdr.detectChanges();
          setTimeout(() => this.actualizarMapaSegunEntidad(), 150);
        },
        error: () => {
          this.isLoadingData = false;
          this.cdr.detectChanges();
        },
      });
  }

  onTipoEntidadChange() {
    this.entidadIdSeleccionada = '';
    this.limpiarSubZona();
    this.limpiarPoligonoBase();
    this.cdr.detectChanges();
  }

  onEntidadEspecificaChange() {
    this.limpiarSubZona();
    this.actualizarMapaSegunEntidad();
    this.cdr.detectChanges();
  }

  // =========================================================================
  // MAPA LEAFLET + GEOMAN + SENSOR GPS (@capacitor/geolocation)
  // =========================================================================

  private iniciarMapa() {
    const el = document.getElementById('mapa-novedad-form');
    if (!el || this.map) return;

    this.map = L.map('mapa-novedad-form', {
      zoomControl: false,
      attributionControl: false,
    }).setView([-29.161, -67.4983], 13);

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
    }).addTo(this.map);

    const mapAny = this.map as any;
    if (mapAny.pm) {
      mapAny.pm.setLang('es');
      this.map.on('pm:create', (e: any) => {
        if (this.subZonaLayer && this.map) {
          this.map.removeLayer(this.subZonaLayer);
        }
        this.subZonaLayer = e.layer;
        this.isDrawingSubZone = false;

        const latlngs: any = e.layer.getLatLngs();
        const ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
        const coords: [number, number][] = ring.map((ll: any) => [
          ll.lng,
          ll.lat,
        ]);
        if (coords.length > 0) {
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coords.push([first[0], first[1]]);
          }
        }
        this.poligonoDibujadoCoords = coords;

        // Si no había GPS puntual, calculamos el centroide de la sub-zona
        if (!this.gpsLatLng) {
          const center = e.layer.getBounds().getCenter();
          this.centroidCoords = [center.lng, center.lat];
        }

        mapAny.pm.disableDraw();
        this.cdr.detectChanges();
      });
    }
  }

  private limpiarPoligonoBase() {
    if (this.polygonBaseLayer && this.map) {
      this.map.removeLayer(this.polygonBaseLayer);
      this.polygonBaseLayer = undefined;
    }
  }

  limpiarSubZona() {
    if (this.subZonaLayer && this.map) {
      this.map.removeLayer(this.subZonaLayer);
      this.subZonaLayer = undefined;
    }
    this.poligonoDibujadoCoords = null;
    if (!this.gpsLatLng) {
      this.centroidCoords = null;
    }
    this.isDrawingSubZone = false;
    const mapAny = this.map as any;
    if (mapAny?.pm) {
      mapAny.pm.disableDraw();
    }
  }

  limpiarPinGps() {
    if (this.gpsMarker && this.map) {
      this.map.removeLayer(this.gpsMarker);
      this.gpsMarker = undefined;
    }
    this.gpsLatLng = null;
    this.gpsMensaje = '';
    if (this.subZonaLayer) {
      const center = this.subZonaLayer.getBounds().getCenter();
      this.centroidCoords = [center.lng, center.lat];
    } else {
      this.centroidCoords = null;
    }
    this.cdr.detectChanges();
  }

  private actualizarMapaSegunEntidad() {
    if (!this.map) return;
    this.limpiarPoligonoBase();

    let coordsLote: [number, number][] | undefined;

    if (this.tipoEntidadSeleccionada === 'Lote' && this.entidadIdSeleccionada) {
      const lote = this.lotesDisponibles.find(
        (l) => String(l.id) === String(this.entidadIdSeleccionada)
      );
      if (lote?.polygon?.length) {
        coordsLote = lote.polygon;
      }
    } else if (
      this.tipoEntidadSeleccionada === 'Cultivo' &&
      this.entidadIdSeleccionada
    ) {
      const cultivo = this.cultivosDisponibles.find(
        (c) => String(c.id) === String(this.entidadIdSeleccionada)
      );
      if (cultivo?.loteId) {
        const lote = this.lotesDisponibles.find(
          (l) => String(l.id) === String(cultivo.loteId)
        );
        if (lote?.polygon?.length) {
          coordsLote = lote.polygon;
        }
      }
    }

    if (coordsLote && coordsLote.length > 0) {
      this.polygonBaseLayer = L.polygon(coordsLote, {
        color: '#ffffff',
        weight: 2,
        fillColor: '#0d8a5c',
        fillOpacity: 0.22,
      }).addTo(this.map);

      if (!this.gpsLatLng) {
        this.map.fitBounds(this.polygonBaseLayer.getBounds(), {
          padding: [20, 20],
        });
      }
    }

    setTimeout(() => this.map?.invalidateSize(), 100);
  }

  activarDibujoSubZona() {
    if (!this.map) return;
    const mapAny = this.map as any;
    if (mapAny.pm) {
      this.isDrawingSubZone = true;
      mapAny.pm.enableDraw('Polygon', {
        snappable: false,
        allowSelfIntersection: false,
      });
    }
  }

  async usarUbicacionGps() {
    if (this.isGettingGps) return;
    this.isGettingGps = true;
    this.gpsMensaje = '';
    this.formError = '';
    this.cdr.detectChanges();

    try {
      const tienePermiso = await this.permissionService.solicitarPermisoUbicacion();
      if (!tienePermiso) {
        this.isGettingGps = false;
        this.cdr.detectChanges();
        return;
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12000,
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      this.gpsLatLng = [lat, lng];
      this.centroidCoords = [lng, lat]; // Estándar GeoJSON [lng, lat]

      // Auto-detectar en qué lote cae la coordenada GPS (point-in-polygon)
      const loteDetectado = this.detectarLotePorPunto(lat, lng);

      if (loteDetectado) {
        if (this.tipoEntidadSeleccionada === 'Lote') {
          this.entidadIdSeleccionada = String(loteDetectado.id);
          this.gpsMensaje = `GPS fijado dentro de "${loteDetectado.name}".`;
          this.actualizarMapaSegunEntidad();
        } else if (this.tipoEntidadSeleccionada === 'Cultivo' && !this.entidadIdSeleccionada) {
          const cultivoEnLote = this.cultivosDisponibles.find(
            (c) => String(c.loteId) === String(loteDetectado.id)
          );
          if (cultivoEnLote) {
            this.entidadIdSeleccionada = String(cultivoEnLote.id);
            this.gpsMensaje = `GPS detectó el cultivo "${cultivoEnLote.especie}" en ${loteDetectado.name}.`;
            this.actualizarMapaSegunEntidad();
          } else {
            this.gpsMensaje = `Ubicación GPS capturada (${lat.toFixed(5)}, ${lng.toFixed(5)}).`;
          }
        } else {
          this.gpsMensaje = `Ubicación GPS capturada (${lat.toFixed(5)}, ${lng.toFixed(5)}).`;
        }
      } else {
        this.gpsMensaje = `Ubicación GPS capturada (${lat.toFixed(5)}, ${lng.toFixed(5)}).`;
      }

      this.dibujarMarcadorGps(lat, lng);
    } catch (err: any) {
      console.error('Error al obtener GPS:', err);
      await this.mostrarToast(
        'No se pudo obtener la ubicación GPS. Verifica que el GPS y los permisos estén activos.',
        'warning'
      );
    } finally {
      this.isGettingGps = false;
      this.cdr.detectChanges();
    }
  }

  private dibujarMarcadorGps(lat: number, lng: number) {
    if (!this.map) {
      this.iniciarMapa();
    }
    if (!this.map) return;

    if (this.gpsMarker) {
      this.map.removeLayer(this.gpsMarker);
    }

    const pinIcon = L.divIcon({
      className: 'gps-form-pin',
      html: `<div style="width:20px;height:20px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.45);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    this.gpsMarker = L.marker([lat, lng], { icon: pinIcon })
      .addTo(this.map)
      .bindPopup('Mi ubicación GPS actual');

    this.map.setView([lat, lng], 16);
    setTimeout(() => this.map?.invalidateSize(), 120);
  }

  private detectarLotePorPunto(lat: number, lng: number): Lot | undefined {
    for (const lote of this.lotesDisponibles) {
      if (lote.polygon && lote.polygon.length >= 3) {
        if (this.puntoEnPoligono(lat, lng, lote.polygon)) {
          return lote;
        }
      }
    }
    return undefined;
  }

  private puntoEnPoligono(
    lat: number,
    lng: number,
    polygon: [number, number][]
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const yi = polygon[i][0];
      const xi = polygon[i][1];
      const yj = polygon[j][0];
      const xj = polygon[j][1];

      const intersect =
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // =========================================================================
  // SENSOR CÁMARA (@capacitor/camera) + VALIDACIÓN MULTIPART
  // =========================================================================

  async capturarFoto(origen: 'CAMARA' | 'GALERIA') {
    this.formError = '';
    const tienePermiso = await this.permissionService.solicitarPermisoCamara(origen);
    if (!tienePermiso) {
      return;
    }

    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source:
          origen === 'CAMARA' ? CameraSource.Camera : CameraSource.Photos,
      });

      if (!photo.webPath) return;

      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      const rawFormat = (photo.format || 'jpeg').toLowerCase();

      await this.agregarBlobValidado(blob, rawFormat);
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (
        msg.toLowerCase().includes('cancel') ||
        msg.toLowerCase().includes('user denied')
      ) {
        return;
      }
      // Fallback al selector de archivos si el plugin falla en escritorio
      this.fileInputRef?.nativeElement.click();
    }
  }

  async onArchivosFallbackSeleccionados(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    for (const file of Array.from(input.files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpeg';
      await this.agregarBlobValidado(file, ext);
    }
    input.value = '';
  }

  private async agregarBlobValidado(blob: Blob, rawFormat: string) {
    let ext: 'jpg' | 'png' | 'webp' = 'jpg';
    if (rawFormat === 'png' || blob.type === 'image/png') {
      ext = 'png';
    } else if (rawFormat === 'webp' || blob.type === 'image/webp') {
      ext = 'webp';
    } else if (
      rawFormat === 'jpeg' ||
      rawFormat === 'jpg' ||
      blob.type === 'image/jpeg'
    ) {
      ext = 'jpg';
    } else {
      await this.mostrarToast(
        'Formato no soportado. Solo se admiten imágenes JPG, PNG o WEBP.',
        'danger'
      );
      return;
    }

    if (blob.size <= 0) {
      await this.mostrarToast('El archivo de imagen está vacío.', 'danger');
      return;
    }

    if (blob.size > this.MAX_IMAGE_BYTES) {
      await this.mostrarToast(
        'La imagen supera el límite máximo permitido de 10 MB.',
        'danger'
      );
      return;
    }

    const totalActual = this.fotosAdjuntas.reduce(
      (sum, f) => sum + f.sizeBytes,
      0
    );
    if (totalActual + blob.size > this.MAX_TOTAL_BYTES) {
      await this.mostrarToast(
        'El total de imágenes adjuntas supera el límite máximo de 25 MB.',
        'danger'
      );
      return;
    }

    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const typedBlob =
      blob.type === mime ? blob : new Blob([blob], { type: mime });
    const previewUrl = URL.createObjectURL(typedBlob);

    this.fotosAdjuntas.push({
      blob: typedBlob,
      ext,
      previewUrl,
      sizeBytes: typedBlob.size,
    });
    this.cdr.detectChanges();
  }

  quitarFoto(index: number) {
    if (index < 0 || index >= this.fotosAdjuntas.length) return;
    URL.revokeObjectURL(this.fotosAdjuntas[index].previewUrl);
    this.fotosAdjuntas.splice(index, 1);
    this.cdr.detectChanges();
  }

  private limpiarFotos() {
    for (const f of this.fotosAdjuntas) {
      URL.revokeObjectURL(f.previewUrl);
    }
    this.fotosAdjuntas = [];
  }

  // =========================================================================
  // GUARDADO (SUBIDA MULTIPART PARALELA + POST /ALERTS)
  // =========================================================================

  guardarNovedad() {
    if (this.isSubmitting) return;
    this.formError = '';

    const tituloLimpio = this.titulo.trim();
    const descLimpia = this.descripcion.trim();

    if (!tituloLimpio) {
      this.formError = 'El título de la novedad es obligatorio.';
      return;
    }
    if (!descLimpia) {
      this.formError = 'Ingresa una descripción detallada de lo observado.';
      return;
    }
    if (!this.entidadIdSeleccionada) {
      this.formError = `Debes seleccionar un ${this.tipoEntidadSeleccionada.toLowerCase()} al cual vincular la novedad.`;
      return;
    }
    if (!this.farmId) {
      this.formError = 'No hay una finca activa seleccionada.';
      return;
    }
    if (!this.authorId) {
      this.formError = 'No se pudo identificar tu usuario. Vuelve a iniciar sesión.';
      return;
    }

    let createdAtStr = this.fechaHora
      ? this.fechaHora.trim()
      : this.obtenerFechaHoraLocalActual();
    if (createdAtStr.endsWith('Z')) {
      createdAtStr = createdAtStr.slice(0, -1);
    }
    if (createdAtStr.length === 16) {
      createdAtStr += ':00';
    }

    const finalPolygon =
      this.poligonoDibujadoCoords && this.poligonoDibujadoCoords.length >= 4
        ? { type: 'Polygon', coordinates: [this.poligonoDibujadoCoords] }
        : null;

    const finalCentroid = this.centroidCoords
      ? { type: 'Point', coordinates: this.centroidCoords }
      : null;

    this.isSubmitting = true;
    this.cdr.detectChanges();

    const offlineMode = !this.networkService.isOnlineSnapshot;
    const prep$: Observable<string[] | OutboxAttachment[]> = offlineMode
      ? from(
          Promise.all(
            this.fotosAdjuntas.map((foto, i) =>
              this.syncService.blobToAttachment(
                foto.blob,
                `evidencia_${i + 1}.${foto.ext}`
              )
            )
          )
        )
      : this.fotosAdjuntas.length > 0
        ? forkJoin(
            this.fotosAdjuntas.map((foto, i) =>
              this.alertService.uploadAlertImage(
                foto.blob,
                foto.ext,
                this.farmId,
                i
              )
            )
          )
        : of([] as string[]);

    prep$
      .pipe(
        switchMap((result) => {
          const uploadedPaths = offlineMode ? [] : (result as string[]);
          const attachments = offlineMode
            ? (result as OutboxAttachment[])
            : undefined;
          const dto = {
            title: tituloLimpio,
            alertType: 'MANUAL_NOTE',
            priority: this.priority,
            recordType: this.recordType,
            description: descLimpia,
            createdAt: createdAtStr,
            authorId: this.authorId,
            images: uploadedPaths,
            relatedLotId:
              this.tipoEntidadSeleccionada === 'Lote'
                ? this.entidadIdSeleccionada
                : null,
            relatedCropId:
              this.tipoEntidadSeleccionada === 'Cultivo'
                ? this.entidadIdSeleccionada
                : null,
            relatedAnimalId:
              this.tipoEntidadSeleccionada === 'Animal'
                ? this.entidadIdSeleccionada
                : null,
            polygonLimit: finalPolygon,
            centroid: finalCentroid,
          };
          return this.alertService.createAlert(dto, this.farmId, attachments);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          this.isSubmitting = false;
          this.limpiarFotos();
          await this.mostrarToast(
            offlineMode
              ? 'Guardado sin conexión. Se enviará al recuperar internet.'
              : 'Novedad registrada exitosamente.',
            offlineMode ? 'warning' : 'success'
          );
          this.router.navigate(['/novedades'], { replaceUrl: true });
        },
        error: (err) => {
          console.error('Error al registrar novedad:', err);
          this.isSubmitting = false;
          this.formError =
            err?.error?.error ||
            err?.error?.message ||
            'Ocurrió un error al guardar la novedad.';
          this.cdr.detectChanges();
        },
      });
  }

  cancelar() {
    this.router.navigate(['/novedades']);
  }

  private async mostrarToast(
    message: string,
    color: 'success' | 'warning' | 'danger'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2800,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
