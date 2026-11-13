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
  catchError,
  switchMap,
} from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonButton,
  IonIcon,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardContent,
  IonSpinner,
  IonModal,
  IonList,
  IonItem,
  IonTextarea,
  ToastController,
  ViewDidEnter,
  ViewWillLeave,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  trashOutline,
  clipboardOutline,
  constructOutline,
  flaskOutline,
  bugOutline,
  leafOutline,
  waterOutline,
  cutOutline,
  timeOutline,
  calendarOutline,
  personOutline,
  locationOutline,
  chevronForwardOutline,
  imagesOutline,
  expandOutline,
  mapOutline,
  navigateOutline,
  locateOutline,
  playOutline,
  checkmarkDoneOutline,
  checkmarkCircleOutline,
  cameraOutline,
  closeCircle,
  close,
  closeOutline,
  chevronBackOutline,
  refreshOutline,
  warningOutline,
  documentTextOutline,
} from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import * as L from 'leaflet';

import { TaskService } from '../../../../core/services/task.service';
import { ContextService } from '../../../../core/services/context.service';
import { LotService } from '../../../../core/services/lot.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { NetworkService } from '../../../../core/services/network.service';
import { SyncService } from '../../../../core/services/sync.service';
import { OutboxAttachment } from '../../../../core/models/sync.model';
import { Tarea } from '../../../../core/models/tarea.model';
import { Lot } from '../../../../core/models/lot.model';

interface FotoCierreAdjunta {
  blob: Blob;
  ext: 'jpg' | 'png' | 'webp';
  previewUrl: string;
  sizeBytes: number;
}

@Component({
  selector: 'app-tarea-detalle',
  templateUrl: './tarea-detalle.page.html',
  styleUrls: ['./tarea-detalle.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonButton,
    IonIcon,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonCard,
    IonCardContent,
    IonSpinner,
    IonModal,
    IonList,
    IonItem,
    IonTextarea,
  ],
})
export class TareaDetallePage
  implements OnInit, OnDestroy, ViewDidEnter, ViewWillLeave
{
  @ViewChild('cierreFileInputFallback')
  cierreFileInputRef?: ElementRef<HTMLInputElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private taskService = inject(TaskService);
  private networkService = inject(NetworkService);
  private syncService = inject(SyncService);
  private contextService = inject(ContextService);
  private lotService = inject(LotService);
  private permissionService = inject(PermissionService);
  private notificationService = inject(NotificationService);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();
  private readonly MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  private readonly MAX_TOTAL_BYTES = 25 * 1024 * 1024;

  tareaId = '';
  farmId = '';
  userRole = '';

  tarea: Tarea | null = null;
  loteAsociado: Lot | null = null;
  isLoading = true;
  errorMessage = '';

  // Visor de imágenes
  isImageViewerOpen = false;
  galeriaActiva: string[] = [];
  imagenActivaIndex = 0;

  // Progreso y Cierre de Tarea
  isUpdatingStatus = false;
  isCompleteModalOpen = false;
  observacionCierreInput = '';
  fotosCierreAdjuntas: FotoCierreAdjunta[] = [];
  completeError = '';

  // Eliminación de Tarea
  isDeleteModalOpen = false;
  motivoEliminacion = '';
  isDeleting = false;
  deleteError = '';

  // Mapa y GPS en Campo ("Ubicarme en el Lote")
  private mapaDetalle?: L.Map;
  private operarioMarker?: L.Marker;
  private lineaDistanciaLayer?: L.Polyline;
  isLocatingGps = false;
  estadoUbicacionOperario = '';
  estaDentroDelSector = false;

  constructor() {
    addIcons({
      trashOutline,
      clipboardOutline,
      constructOutline,
      flaskOutline,
      bugOutline,
      leafOutline,
      waterOutline,
      cutOutline,
      timeOutline,
      calendarOutline,
      personOutline,
      locationOutline,
      chevronForwardOutline,
      imagesOutline,
      expandOutline,
      mapOutline,
      navigateOutline,
      locateOutline,
      playOutline,
      checkmarkDoneOutline,
      checkmarkCircleOutline,
      cameraOutline,
      closeCircle,
      close,
      closeOutline,
      chevronBackOutline,
      refreshOutline,
      warningOutline,
      documentTextOutline,
    });
  }

  get puedeEliminar(): boolean {
    return this.userRole === 'OWNER' || this.userRole === 'FOREMAN';
  }

  get tieneGeometria(): boolean {
    if (!this.tarea) return false;
    return (
      (!!this.tarea.poligono && this.tarea.poligono.length > 0) ||
      !!this.tarea.centroide ||
      (!!this.loteAsociado?.polygon && this.loteAsociado.polygon.length > 0)
    );
  }

  ngOnInit() {
    this.tareaId = this.route.snapshot.paramMap.get('id') || '';

    this.contextService.userRole$
      .pipe(takeUntil(this.destroy$))
      .subscribe((role) => {
        this.userRole = role || '';
        this.cdr.detectChanges();
      });

    this.contextService.selectedFarm$
      .pipe(takeUntil(this.destroy$))
      .subscribe((farm) => {
        if (farm) {
          this.farmId = farm.id;
          this.cargarDetalle();
        }
      });

    this.notificationService.incomingTask$
      .pipe(takeUntil(this.destroy$))
      .subscribe((incoming) => {
        if (incoming.id === this.tareaId) {
          this.cargarDetalle();
        }
      });
  }

  ionViewDidEnter() {
    setTimeout(() => {
      if (this.mapaDetalle) {
        this.mapaDetalle.invalidateSize();
      } else if (this.tarea && this.tieneGeometria) {
        this.inicializarMapa();
      }
    }, 200);
  }

  ionViewWillLeave() {
    this.isImageViewerOpen = false;
    this.isCompleteModalOpen = false;
    this.isDeleteModalOpen = false;
  }

  ngOnDestroy() {
    this.limpiarFotosCierre();
    this.destruirMapa();
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarDetalle(refresherEvent?: any) {
    if (!this.tareaId) {
      this.isLoading = false;
      this.errorMessage = 'No se pudo identificar la tarea solicitada.';
      refresherEvent?.target?.complete();
      this.cdr.detectChanges();
      return;
    }

    if (!refresherEvent) {
      this.isLoading = true;
    }
    this.errorMessage = '';
    this.cdr.detectChanges();

    forkJoin({
      task: this.taskService.getTaskById(this.tareaId),
      lots: this.farmId
        ? this.lotService
            .getLotsByFarm(this.farmId)
            .pipe(catchError(() => of([])))
        : of([]),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ task, lots }) => {
          this.loteAsociado = task.loteId
            ? lots.find((l) => String(l.id) === String(task.loteId)) || null
            : null;

          this.tarea = {
            ...task,
            lote: this.loteAsociado?.name || task.lote || 'Finca General',
          };
          this.isLoading = false;
          refresherEvent?.target?.complete();
          this.cdr.detectChanges();

          if (this.tieneGeometria) {
            setTimeout(() => this.inicializarMapa(), 180);
          }
        },
        error: (err) => {
          console.error('Error al cargar detalle de tarea:', err);
          this.errorMessage =
            'No se pudo obtener la información de la tarea operativa.';
          this.isLoading = false;
          refresherEvent?.target?.complete();
          this.cdr.detectChanges();
        },
      });
  }

  onRefresh(event: any) {
    this.cargarDetalle(event);
  }

  irAlLoteEnMapa() {
    if (!this.tarea?.loteId) return;
    this.router.navigate(['/mapa'], {
      queryParams: { lotId: this.tarea.loteId },
    });
  }

  // =========================================================================
  // FLUJO DE ESTADOS: EN PROGRESO Y FINALIZAR CON EVIDENCIA
  // =========================================================================

  marcarEnProgreso() {
    if (!this.tarea || this.isUpdatingStatus) return;
    this.isUpdatingStatus = true;
    this.cdr.detectChanges();

    this.taskService
      .updateTaskStatus(this.tarea.id, 'IN_PROGESS')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async () => {
          this.isUpdatingStatus = false;
          await this.mostrarToast(
            'Tarea marcada En Progreso.',
            'primary'
          );
          this.cargarDetalle();
        },
        error: async () => {
          this.isUpdatingStatus = false;
          this.cdr.detectChanges();
          await this.mostrarToast(
            'No se pudo actualizar el estado de la tarea.',
            'danger'
          );
        },
      });
  }

  abrirModalFinalizar() {
    this.observacionCierreInput = '';
    this.completeError = '';
    this.limpiarFotosCierre();
    this.isCompleteModalOpen = true;
    this.cdr.detectChanges();
  }

  cerrarModalFinalizar() {
    if (this.isUpdatingStatus) return;
    this.isCompleteModalOpen = false;
    this.completeError = '';
  }

  async capturarFotoCierre(origen: 'CAMARA' | 'GALERIA') {
    this.completeError = '';
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
      await this.agregarBlobCierre(blob, rawFormat);
    } catch (err: any) {
      const msg = String(err?.message || err || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('user denied')) {
        return;
      }
      this.cierreFileInputRef?.nativeElement.click();
    }
  }

  async onArchivosCierreFallback(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    for (const file of Array.from(input.files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpeg';
      await this.agregarBlobCierre(file, ext);
    }
    input.value = '';
  }

  private async agregarBlobCierre(blob: Blob, rawFormat: string) {
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
      this.completeError = 'Solo se admiten imágenes JPG, PNG o WEBP.';
      this.cdr.detectChanges();
      return;
    }

    if (blob.size <= 0 || blob.size > this.MAX_IMAGE_BYTES) {
      this.completeError = 'Cada imagen debe pesar menos de 10 MB.';
      this.cdr.detectChanges();
      return;
    }

    const totalActual = this.fotosCierreAdjuntas.reduce(
      (sum, f) => sum + f.sizeBytes,
      0
    );
    if (totalActual + blob.size > this.MAX_TOTAL_BYTES) {
      this.completeError = 'El total de fotos no puede superar los 25 MB.';
      this.cdr.detectChanges();
      return;
    }

    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const typedBlob =
      blob.type === mime ? blob : new Blob([blob], { type: mime });
    const previewUrl = URL.createObjectURL(typedBlob);

    this.fotosCierreAdjuntas.push({
      blob: typedBlob,
      ext,
      previewUrl,
      sizeBytes: typedBlob.size,
    });
    this.cdr.detectChanges();
  }

  quitarFotoCierre(index: number) {
    if (index < 0 || index >= this.fotosCierreAdjuntas.length) return;
    URL.revokeObjectURL(this.fotosCierreAdjuntas[index].previewUrl);
    this.fotosCierreAdjuntas.splice(index, 1);
    this.cdr.detectChanges();
  }

  private limpiarFotosCierre() {
    for (const f of this.fotosCierreAdjuntas) {
      URL.revokeObjectURL(f.previewUrl);
    }
    this.fotosCierreAdjuntas = [];
  }

  confirmarFinalizarTarea() {
    if (!this.tarea || this.isUpdatingStatus) return;
    const targetFarmId = this.tarea.fincaId || this.farmId;

    this.isUpdatingStatus = true;
    this.completeError = '';
    this.cdr.detectChanges();

    const offlineMode = !this.networkService.isOnlineSnapshot;
    const prep$: Observable<string[] | OutboxAttachment[]> = offlineMode
      ? from(
          Promise.all(
            this.fotosCierreAdjuntas.map((foto, idx) =>
              this.syncService.blobToAttachment(
                foto.blob,
                `cierre_${idx + 1}.${foto.ext}`
              )
            )
          )
        )
      : this.fotosCierreAdjuntas.length > 0 && targetFarmId
        ? forkJoin(
            this.fotosCierreAdjuntas.map((foto, idx) =>
              this.taskService.uploadTaskImage(
                foto.blob,
                foto.ext,
                targetFarmId,
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
          return this.taskService.updateTaskStatus(
            this.tarea!.id,
            'FINISH',
            {
              completionNotes:
                this.observacionCierreInput.trim() || undefined,
              completionImages:
                uploadedPaths.length > 0 ? uploadedPaths : undefined,
            },
            targetFarmId,
            attachments
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          this.isUpdatingStatus = false;
          this.isCompleteModalOpen = false;
          this.limpiarFotosCierre();
          await this.mostrarToast(
            offlineMode
              ? 'Cierre guardado sin conexión. Se enviará al recuperar internet.'
              : '¡Tarea finalizada con éxito!',
            offlineMode ? 'warning' : 'success'
          );
          this.cargarDetalle();
        },
        error: (err) => {
          console.error('Error al finalizar tarea:', err);
          this.isUpdatingStatus = false;
          this.completeError =
            err?.error?.error ||
            err?.error?.message ||
            'No se pudo registrar la finalización de la tarea.';
          this.cdr.detectChanges();
        },
      });
  }

  // =========================================================================
  // MAPA SATELITAL Y ASISTENCIA GPS ("UBICARME EN EL LOTE")
  // =========================================================================

  private destruirMapa() {
    if (this.mapaDetalle) {
      this.mapaDetalle.remove();
      this.mapaDetalle = undefined;
      this.operarioMarker = undefined;
      this.lineaDistanciaLayer = undefined;
    }
  }

  private inicializarMapa() {
    const container = document.getElementById('mapa-tarea-detalle');
    if (!container || !this.tarea) return;

    this.destruirMapa();

    this.mapaDetalle = L.map('mapa-tarea-detalle', {
      zoomControl: false,
      attributionControl: false,
    }).setView([-29.161, -67.4983], 15);

    L.control.zoom({ position: 'topright' }).addTo(this.mapaDetalle);

    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 21,
      maxNativeZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(this.mapaDetalle);

    let boundsTarget: L.LatLngBounds | null = null;

    if (this.loteAsociado?.polygon && this.loteAsociado.polygon.length > 0) {
      const lotPoly = L.polygon(this.loteAsociado.polygon, {
        color: '#ffffff',
        weight: 2,
        dashArray: '5, 5',
        fillColor: '#0d8a5c',
        fillOpacity: 0.15,
      }).addTo(this.mapaDetalle);
      boundsTarget = lotPoly.getBounds();
    }

    if (this.tarea.poligono && this.tarea.poligono.length > 0) {
      const taskPoly = L.polygon(this.tarea.poligono, {
        color: '#f59e0b',
        weight: 3,
        fillColor: '#f59e0b',
        fillOpacity: 0.35,
      }).addTo(this.mapaDetalle);
      boundsTarget = taskPoly.getBounds();
    }

    if (this.tarea.centroide) {
      const [lat, lng] = this.tarea.centroide;
      const pinIcon = L.divIcon({
        className: 'task-pin-marker',
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#f59e0b;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.45);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([lat, lng], { icon: pinIcon })
        .addTo(this.mapaDetalle)
        .bindPopup(`<strong>Punto de Tarea</strong><br/>${this.tarea.titulo}`);
    }

    if (boundsTarget && boundsTarget.isValid()) {
      this.mapaDetalle.fitBounds(boundsTarget, { padding: [24, 24] });
    } else if (this.tarea.centroide) {
      this.mapaDetalle.setView(this.tarea.centroide, 17);
    }

    setTimeout(() => this.mapaDetalle?.invalidateSize(), 150);
  }

  async ubicarmeEnElLoteGps() {
    if (this.isLocatingGps || !this.tarea) return;
    this.isLocatingGps = true;
    this.estadoUbicacionOperario = '';
    this.cdr.detectChanges();

    try {
      const tienePermiso =
        await this.permissionService.solicitarPermisoUbicacion();
      if (!tienePermiso) {
        this.isLocatingGps = false;
        this.cdr.detectChanges();
        return;
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12000,
      });

      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;

      if (!this.mapaDetalle) {
        this.inicializarMapa();
      }

      if (this.mapaDetalle) {
        if (this.operarioMarker) {
          this.mapaDetalle.removeLayer(this.operarioMarker);
        }
        if (this.lineaDistanciaLayer) {
          this.mapaDetalle.removeLayer(this.lineaDistanciaLayer);
        }

        const userIcon = L.divIcon({
          className: 'user-gps-marker',
          html: `<div style="width:20px;height:20px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 5px rgba(37,99,235,0.28);"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        this.operarioMarker = L.marker([userLat, userLng], { icon: userIcon })
          .addTo(this.mapaDetalle)
          .bindPopup('Tu ubicación GPS actual')
          .openPopup();

        const targetPolygon =
          this.tarea.poligono && this.tarea.poligono.length >= 3
            ? this.tarea.poligono
            : this.loteAsociado?.polygon &&
                this.loteAsociado.polygon.length >= 3
              ? this.loteAsociado.polygon
              : null;

        if (
          targetPolygon &&
          this.puntoEnPoligono(userLat, userLng, targetPolygon)
        ) {
          this.estaDentroDelSector = true;
          this.estadoUbicacionOperario =
            'Te encuentras dentro del sector de trabajo asignado.';
        } else {
          this.estaDentroDelSector = false;
          const refPoint = this.obtenerPuntoMasCercano(
            userLat,
            userLng,
            targetPolygon
          );
          if (refPoint) {
            const distMetros = Math.round(
              this.calcularDistanciaMetros(
                userLat,
                userLng,
                refPoint[0],
                refPoint[1]
              )
            );
            this.estadoUbicacionOperario =
              distMetros > 1000
                ? `Estás a ${(distMetros / 1000).toFixed(2)} km del sector asignado.`
                : `Estás a ${distMetros} m del sector asignado.`;

            this.lineaDistanciaLayer = L.polyline(
              [
                [userLat, userLng],
                [refPoint[0], refPoint[1]],
              ],
              { color: '#2563eb', weight: 2.5, dashArray: '6, 6' }
            ).addTo(this.mapaDetalle);

            const combinedBounds = L.latLngBounds([
              [userLat, userLng],
              [refPoint[0], refPoint[1]],
            ]);
            this.mapaDetalle.fitBounds(combinedBounds, {
              padding: [36, 36],
              maxZoom: 18,
            });
          } else {
            this.estadoUbicacionOperario = `GPS activo (${userLat.toFixed(5)}, ${userLng.toFixed(5)}).`;
            this.mapaDetalle.setView([userLat, userLng], 17);
          }
        }
      }
    } catch {
      await this.mostrarToast(
        'No se pudo obtener tu posición GPS actual.',
        'warning'
      );
    } finally {
      this.isLocatingGps = false;
      this.cdr.detectChanges();
    }
  }

  private obtenerPuntoMasCercano(
    lat: number,
    lng: number,
    polygon: [number, number][] | null
  ): [number, number] | null {
    if (this.tarea?.centroide) {
      return this.tarea.centroide;
    }
    if (polygon && polygon.length > 0) {
      let best = polygon[0];
      let minDist = Infinity;
      for (const pt of polygon) {
        const d = this.calcularDistanciaMetros(lat, lng, pt[0], pt[1]);
        if (d < minDist) {
          minDist = d;
          best = pt;
        }
      }
      return best;
    }
    return null;
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

  private calcularDistanciaMetros(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // =========================================================================
  // VISOR DE FOTOS Y ELIMINACIÓN
  // =========================================================================

  abrirVisorImagen(galeria: string[], index: number) {
    this.galeriaActiva = galeria;
    this.imagenActivaIndex = index;
    this.isImageViewerOpen = true;
  }

  cerrarVisorImagen() {
    this.isImageViewerOpen = false;
  }

  imagenAnterior() {
    if (!this.galeriaActiva.length) return;
    this.imagenActivaIndex =
      (this.imagenActivaIndex - 1 + this.galeriaActiva.length) %
      this.galeriaActiva.length;
  }

  imagenSiguiente() {
    if (!this.galeriaActiva.length) return;
    this.imagenActivaIndex =
      (this.imagenActivaIndex + 1) % this.galeriaActiva.length;
  }

  abrirModalEliminar() {
    this.motivoEliminacion = '';
    this.deleteError = '';
    this.isDeleteModalOpen = true;
  }

  cerrarModalEliminar() {
    this.isDeleteModalOpen = false;
    this.deleteError = '';
  }

  confirmarEliminacion() {
    if (!this.tarea || !this.farmId || this.isDeleting) return;
    if (!this.motivoEliminacion.trim()) {
      this.deleteError = 'Ingresa un breve motivo para eliminar la tarea.';
      return;
    }

    this.isDeleting = true;
    this.deleteError = '';

    this.taskService
      .deleteTask(this.tarea.id, this.farmId, this.motivoEliminacion.trim())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async () => {
          this.isDeleting = false;
          this.isDeleteModalOpen = false;
          await this.mostrarToast('Tarea eliminada correctamente.', 'success');
          this.router.navigate(['/tareas'], { replaceUrl: true });
        },
        error: (err) => {
          this.isDeleting = false;
          this.deleteError =
            err?.error?.error ||
            'No se pudo eliminar la tarea operativa.';
          this.cdr.detectChanges();
        },
      });
  }

  private async mostrarToast(
    message: string,
    color: 'success' | 'danger' | 'warning' | 'primary'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
