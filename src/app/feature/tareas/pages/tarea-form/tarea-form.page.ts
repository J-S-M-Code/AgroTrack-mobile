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
import {
  Observable,
  Subject,
  forkJoin,
  from,
  of,
  takeUntil,
  switchMap,
  catchError,
} from 'rxjs';
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
  IonLabel,
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
  clipboardOutline,
  personOutline,
  locationOutline,
  navigateOutline,
  createOutline,
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

import { TaskService } from '../../../../core/services/task.service';
import { LotService } from '../../../../core/services/lot.service';
import { UserService } from '../../../../core/services/user.service';
import { ContextService } from '../../../../core/services/context.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { NetworkService } from '../../../../core/services/network.service';
import { SyncService } from '../../../../core/services/sync.service';
import { OutboxAttachment } from '../../../../core/models/sync.model';
import {
  ACCION_TYPE_OPTIONS,
  AccionType,
  TASK_PRIORITY_OPTIONS,
  TaskPriority,
} from '../../../../core/models/tarea.model';
import { Lot } from '../../../../core/models/lot.model';
import { User } from '../../../../core/models/user.model';

interface FotoTareaAdjunta {
  blob: Blob;
  ext: 'jpg' | 'png' | 'webp';
  previewUrl: string;
  sizeBytes: number;
}

@Component({
  selector: 'app-tarea-form',
  templateUrl: './tarea-form.page.html',
  styleUrls: ['./tarea-form.page.scss'],
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
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
})
export class TareaFormPage implements OnInit, OnDestroy, ViewDidEnter {
  @ViewChild('fileInputFallback') fileInputRef?: ElementRef<HTMLInputElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private taskService = inject(TaskService);
  private networkService = inject(NetworkService);
  private syncService = inject(SyncService);
  private lotService = inject(LotService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private contextService = inject(ContextService);
  private permissionService = inject(PermissionService);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  private readonly MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  private readonly MAX_TOTAL_BYTES = 25 * 1024 * 1024;

  farmId = '';
  farmName = '';
  farmPolygon: [number, number][] = [];
  creadorNombre = 'Usuario';
  currentUser: User | null = null;

  private preselectedLotId = '';

  // Campos del formulario
  titulo = '';
  accionType: AccionType = 'MAINTENANCE';
  priority: TaskPriority = 'MEDIUM';
  fechaVencimiento = '';
  loteIdSeleccionado = '';
  personalIdSeleccionado = '';
  descripcion = '';

  accionesOpciones = ACCION_TYPE_OPTIONS;
  prioridadesOpciones = TASK_PRIORITY_OPTIONS;
  lotesDisponibles: Lot[] = [];
  personalDisponible: User[] = [];

  // Mapa + GPS + Geoman
  private map?: L.Map;
  private fincaBaseLayer?: L.Polygon;
  private loteBaseLayer?: L.Polygon;
  private areaTrabajoLayer?: L.Polygon;
  private gpsMarker?: L.Marker;

  isGettingGps = false;
  isDrawingArea = false;
  gpsMensaje = '';
  gpsLatLng: [number, number] | null = null;
  centroidCoords: [number, number] | null = null; // [lng, lat]
  poligonoDibujadoCoords: [number, number][] | null = null; // [lng, lat][]

  // Evidencia fotográfica de referencia
  fotosAdjuntas: FotoTareaAdjunta[] = [];

  isLoadingData = true;
  isSubmitting = false;
  formError = '';

  constructor() {
    addIcons({
      clipboardOutline,
      personOutline,
      locationOutline,
      navigateOutline,
      createOutline,
      cameraOutline,
      imagesOutline,
      closeCircle,
      checkmarkCircleOutline,
      warningOutline,
      mapOutline,
    });
  }

  ngOnInit() {
    this.fechaVencimiento = this.obtenerFechaManana();
    this.preselectedLotId =
      this.route.snapshot.queryParamMap.get('lotId') || '';

    // El responsable NO se autoselecciona: se exige selección manual
    this.personalIdSeleccionado = '';

    this.userService
      .getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.currentUser = user;
          this.creadorNombre = user.name
            ? `${user.name}${user.lastName ? ' ' + user.lastName : ''}`
            : 'Usuario';
          if (
            user.id &&
            this.personalDisponible.length > 0 &&
            !this.personalDisponible.some(
              (u) => String(u.id) === String(user.id)
            )
          ) {
            this.personalDisponible = [user, ...this.personalDisponible];
          }
          this.cdr.detectChanges();
        },
        error: () => {},
      });

    this.contextService.selectedFarm$
      .pipe(takeUntil(this.destroy$))
      .subscribe((farm) => {
        if (farm) {
          this.farmId = farm.id;
          this.farmName = farm.name;
          this.farmPolygon = farm.polygon || [];
          this.cargarDatosFinca();
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
      this.actualizarMapaSegunLote();
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

  private obtenerFechaManana(): string {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const offsetMs = tomorrow.getTimezoneOffset() * 60000;
    return new Date(tomorrow.getTime() - offsetMs).toISOString().split('T')[0];
  }

  cargarDatosFinca() {
    if (!this.farmId) return;
    this.isLoadingData = true;

    forkJoin({
      lots: this.lotService
        .getLotsByFarm(this.farmId)
        .pipe(catchError(() => of([]))),
      users: this.userService
        .getUsersByFarm(this.farmId)
        .pipe(catchError(() => of([]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ lots, users }) => {
          this.lotesDisponibles = lots;
          let activeUsers = (users || []).filter((u) => u.active !== false);

          if (
            this.currentUser &&
            this.currentUser.id &&
            !activeUsers.some(
              (u) => String(u.id) === String(this.currentUser?.id)
            )
          ) {
            activeUsers = [this.currentUser, ...activeUsers];
          }
          this.personalDisponible = activeUsers;

          if (
            this.preselectedLotId &&
            lots.some((l) => String(l.id) === String(this.preselectedLotId))
          ) {
            this.loteIdSeleccionado = this.preselectedLotId;
          }

          this.isLoadingData = false;
          this.cdr.detectChanges();
          setTimeout(() => this.actualizarMapaSegunLote(), 150);
        },
        error: () => {
          this.isLoadingData = false;
          this.cdr.detectChanges();
        },
      });
  }

  onLoteChange() {
    this.limpiarAreaTrabajo();
    this.actualizarMapaSegunLote();
    this.cdr.detectChanges();
  }

  getRolLabel(role?: string): string {
    switch (role) {
      case 'OWNER':
        return 'Propietario';
      case 'FOREMAN':
        return 'Capataz';
      case 'AGRONOMIST':
        return 'Agrónomo';
      case 'VETERINARIAN':
        return 'Veterinario';
      case 'APPLICATOR':
        return 'Aplicador';
      case 'WORKER':
        return 'Operario';
      default:
        return role || 'Personal';
    }
  }

  // =========================================================================
  // MAPA LEAFLET + GEOMAN + SENSOR GPS
  // =========================================================================

  private iniciarMapa() {
    const el = document.getElementById('mapa-tarea-form');
    if (!el || this.map) return;

    this.map = L.map('mapa-tarea-form', {
      zoomControl: false,
      attributionControl: false,
    }).setView([-29.161, -67.4983], 14);

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 21,
      maxNativeZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(this.map);

    if (this.farmPolygon && this.farmPolygon.length >= 3) {
      this.fincaBaseLayer = L.polygon(this.farmPolygon, {
        color: '#42a5f5',
        weight: 2,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(this.map);
      this.map.fitBounds(this.fincaBaseLayer.getBounds(), {
        padding: [20, 20],
      });
    }

    const mapAny = this.map as any;
    if (mapAny.pm) {
      mapAny.pm.setLang('es');
      this.map.on('pm:create', (e: any) => {
        if (this.areaTrabajoLayer && this.map) {
          this.map.removeLayer(this.areaTrabajoLayer);
        }
        this.areaTrabajoLayer = e.layer;
        this.isDrawingArea = false;

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

        if (!this.gpsLatLng) {
          const center = e.layer.getBounds().getCenter();
          this.centroidCoords = [center.lng, center.lat];
        }

        mapAny.pm.disableDraw();
        this.cdr.detectChanges();
      });
    }
  }

  private actualizarMapaSegunLote() {
    if (!this.map) return;
    if (this.loteBaseLayer) {
      this.map.removeLayer(this.loteBaseLayer);
      this.loteBaseLayer = undefined;
    }

    if (this.loteIdSeleccionado) {
      const lote = this.lotesDisponibles.find(
        (l) => String(l.id) === String(this.loteIdSeleccionado)
      );
      if (lote?.polygon && lote.polygon.length >= 3) {
        this.loteBaseLayer = L.polygon(lote.polygon, {
          color: '#ffffff',
          weight: 2.5,
          fillColor: '#0d8a5c',
          fillOpacity: 0.25,
        }).addTo(this.map);

        if (!this.gpsLatLng) {
          this.map.fitBounds(this.loteBaseLayer.getBounds(), {
            padding: [20, 20],
          });
        }
      }
    } else if (this.fincaBaseLayer && !this.gpsLatLng) {
      this.map.fitBounds(this.fincaBaseLayer.getBounds(), {
        padding: [20, 20],
      });
    }

    setTimeout(() => this.map?.invalidateSize(), 100);
  }

  activarDibujoArea() {
    if (!this.map) return;
    const mapAny = this.map as any;
    if (mapAny.pm) {
      this.isDrawingArea = true;
      mapAny.pm.enableDraw('Polygon', {
        snappable: false,
        allowSelfIntersection: false,
        pathOptions: {
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.35,
        },
      });
    }
  }

  limpiarAreaTrabajo() {
    if (this.areaTrabajoLayer && this.map) {
      this.map.removeLayer(this.areaTrabajoLayer);
      this.areaTrabajoLayer = undefined;
    }
    this.poligonoDibujadoCoords = null;
    if (!this.gpsLatLng) {
      this.centroidCoords = null;
    }
    this.isDrawingArea = false;
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
    if (this.areaTrabajoLayer) {
      const center = this.areaTrabajoLayer.getBounds().getCenter();
      this.centroidCoords = [center.lng, center.lat];
    } else {
      this.centroidCoords = null;
    }
    this.cdr.detectChanges();
  }

  async usarUbicacionGps() {
    if (this.isGettingGps) return;
    this.isGettingGps = true;
    this.gpsMensaje = '';
    this.formError = '';
    this.cdr.detectChanges();

    try {
      const tienePermiso =
        await this.permissionService.solicitarPermisoUbicacion();
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
      this.centroidCoords = [lng, lat];

      const loteDetectado = this.detectarLotePorPunto(lat, lng);
      if (loteDetectado) {
        this.loteIdSeleccionado = String(loteDetectado.id);
        this.gpsMensaje = `GPS fijado dentro de "${loteDetectado.name}".`;
        this.actualizarMapaSegunLote();
      } else {
        this.gpsMensaje = `Ubicación GPS capturada (${lat.toFixed(5)}, ${lng.toFixed(5)}).`;
      }

      this.dibujarMarcadorGps(lat, lng);
    } catch {
      await this.mostrarToast(
        'No se pudo obtener la ubicación GPS. Verifica que el GPS esté activo.',
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
      className: 'gps-task-pin',
      html: `<div style="width:20px;height:20px;border-radius:50%;background:#f59e0b;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.45);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    this.gpsMarker = L.marker([lat, lng], { icon: pinIcon })
      .addTo(this.map)
      .bindPopup('Punto GPS de la tarea');

    this.map.setView([lat, lng], 16);
    setTimeout(() => this.map?.invalidateSize(), 120);
  }

  private detectarLotePorPunto(lat: number, lng: number): Lot | undefined {
    for (const lote of this.lotesDisponibles) {
      if (lote.polygon && lote.polygon.length >= 3) {
        let inside = false;
        const polygon = lote.polygon;
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
        if (inside) return lote;
      }
    }
    return undefined;
  }

  // =========================================================================
  // SENSOR CÁMARA (@capacitor/camera) + VALIDACIÓN MULTIPART
  // =========================================================================

  async capturarFoto(origen: 'CAMARA' | 'GALERIA') {
    this.formError = '';
    const tienePermiso =
      await this.permissionService.solicitarPermisoCamara(origen);
    if (!tienePermiso) return;

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
      const msg = String(err?.message || err || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('user denied')) {
        return;
      }
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

    if (blob.size <= 0 || blob.size > this.MAX_IMAGE_BYTES) {
      await this.mostrarToast(
        'Cada imagen debe pesar menos de 10 MB.',
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
        'El total de imágenes adjuntas no puede superar los 25 MB.',
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
  // GUARDADO DE TAREA (SUBIDA PARALELA + POST /TASKS)
  // =========================================================================

  async guardarTarea() {
    if (this.isSubmitting) return;
    this.formError = '';

    const tituloLimpio = this.titulo.trim();
    const descLimpia = this.descripcion ? this.descripcion.trim() : '';

    if (!tituloLimpio) {
      this.formError = 'El título de la tarea es obligatorio.';
      return;
    }
    if (!this.fechaVencimiento) {
      this.formError = 'Selecciona una fecha límite de ejecución.';
      return;
    }
    if (!this.farmId) {
      this.formError = 'No hay una finca activa seleccionada.';
      return;
    }

    if (!this.personalIdSeleccionado) {
      this.formError = 'Debes seleccionar obligatoriamente al integrante responsable de la tarea.';
      return;
    }

    const finalPolygon =
      this.poligonoDibujadoCoords && this.poligonoDibujadoCoords.length >= 4
        ? { type: 'Polygon', coordinates: [this.poligonoDibujadoCoords] }
        : null;

    const finalCentroid = this.centroidCoords
      ? { type: 'Point', coordinates: this.centroidCoords }
      : null;

    const now = new Date();
    const creationDateLocal = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 19);

    this.isSubmitting = true;
    this.cdr.detectChanges();

    const offlineMode = !this.networkService.isOnlineSnapshot;
    const prep$: Observable<string[] | OutboxAttachment[]> = offlineMode
      ? from(
          Promise.all(
            this.fotosAdjuntas.map((foto, idx) =>
              this.syncService.blobToAttachment(
                foto.blob,
                `tarea_${idx + 1}.${foto.ext}`
              )
            )
          )
        )
      : this.fotosAdjuntas.length > 0
        ? forkJoin(
            this.fotosAdjuntas.map((foto, idx) =>
              this.taskService.uploadTaskImage(
                foto.blob,
                foto.ext,
                this.farmId,
                idx
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
            accionType: this.accionType,
            taskStatus: 'CREATED',
            dueDate: `${this.fechaVencimiento}T23:59:59`,
            priority: this.priority,
            creationDate: creationDateLocal,
            relatedFarmId: this.farmId,
            relatedLotId: this.loteIdSeleccionado || null,
            assignedId: this.personalIdSeleccionado,
            description: descLimpia,
            images: uploadedPaths,
            polygonLimit: finalPolygon,
            centroid: finalCentroid,
          };
          return this.taskService.createTask(dto, attachments);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async (creada) => {
          this.isSubmitting = false;
          this.limpiarFotos();
          await this.mostrarToast(
            offlineMode
              ? 'Tarea guardada sin conexión. Se enviará al recuperar internet.'
              : 'Tarea operativa creada y notificada.',
            offlineMode ? 'warning' : 'success'
          );
          this.router.navigate(['/tareas', creada.id], { replaceUrl: true });
        },
        error: (err) => {
          console.error('Error al crear tarea:', err);
          this.isSubmitting = false;
          this.formError =
            err?.error?.error ||
            err?.error?.message ||
            'Ocurrió un error al guardar la tarea. Verifica los datos ingresados.';
          this.cdr.detectChanges();
        },
      });
  }

  private async mostrarToast(
    message: string,
    color: 'success' | 'danger' | 'warning'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2600,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
