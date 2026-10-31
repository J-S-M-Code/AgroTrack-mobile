import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, filter, take } from 'rxjs';
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
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonProgressBar,
  IonSpinner,
  IonModal,
  IonList,
  IonItem,
  IonInput,
  IonTextarea,
  IonRadioGroup,
  IonRadio,
  ToastController,
  ViewWillEnter,
  ViewDidEnter,
  ViewWillLeave,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  ellipsisVertical,
  locationOutline,
  documentTextOutline,
  calendarOutline,
  bookOutline,
  layersOutline,
  eyeOutline,
  warningOutline,
  clipboardOutline,
  chatbubbleEllipsesOutline,
  informationCircleOutline,
  personOutline,
  syncOutline,
  leafOutline,
  pulseOutline,
  createOutline,
  trashOutline,
  close,
  refreshOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import * as L from 'leaflet';

import { CropService } from '../../../../core/services/crop.service';
import { LotService } from '../../../../core/services/lot.service';
import { SpectralMapService } from '../../../../core/services/spectral-map.service';
import { ContextService } from '../../../../core/services/context.service';
import { environment } from '../../../../../environments/environment';
import {
  Cultivo,
  EventoCampo,
  PhenologicalState,
  PHENOLOGICAL_STATE_OPTIONS,
} from '../../../../core/models/cultivo.model';
import { Lot } from '../../../../core/models/lot.model';
import { SpectralMap } from '../../../../core/models/spectral-map.model';

@Component({
  selector: 'app-cultivo-detalle',
  templateUrl: './cultivo-detalle.page.html',
  styleUrls: ['./cultivo-detalle.page.scss'],
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
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonProgressBar,
    IonSpinner,
    IonModal,
    IonList,
    IonItem,
    IonInput,
    IonTextarea,
    IonRadioGroup,
    IonRadio,
  ],
})
export class CultivoDetallePage
  implements OnInit, ViewWillEnter, ViewDidEnter, ViewWillLeave, OnDestroy
{
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cropService = inject(CropService);
  private lotService = inject(LotService);
  private spectralMapService = inject(SpectralMapService);
  private contextService = inject(ContextService);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();
  private mapInitTimeout: ReturnType<typeof setTimeout> | null = null;
  private hasLoadedOnce = false;

  cropId = '';
  farmId = '';
  userRole = '';

  cultivo: Cultivo | null = null;
  loteAsignado: Lot | null = null;
  isLoading = true;
  errorMessage = '';

  // Cuaderno de Campo
  filtroEventos: 'Todos' | 'Alerta' | 'Tarea' | 'Comentario' = 'Todos';
  eventosFiltrados: EventoCampo[] = [];

  // Mapa Satelital e Índices Espectrales
  private mapaCultivo: L.Map | undefined;
  private poligonoLayer: L.Polygon | undefined;
  private capaEspectralActual: L.TileLayer | null = null;
  private maskLayer: L.Polygon | null = null;

  mapasDisponibles: SpectralMap[] = [];
  indicesDisponibles: string[] = [];
  capaActiva = 'Normal';

  // Modales de Acciones
  isMenuAccionesOpen = false;
  private accionPendienteMenu: (() => void) | null = null;
  guardandoAccion = false;

  isModalCosechaOpen = false;
  fechaCosechaSeleccionada = '';
  errorCosecha = '';

  isModalEstadoOpen = false;
  estadosDisponibles = PHENOLOGICAL_STATE_OPTIONS;
  nuevoEstadoSeleccionado: PhenologicalState = 'VEGETATIVE_GROWTH';
  errorEstado = '';

  isModalEliminarOpen = false;
  renspaConfirmacion = '';
  motivoEliminacion = '';
  errorEliminar = '';

  constructor() {
    addIcons({
      ellipsisVertical,
      locationOutline,
      documentTextOutline,
      calendarOutline,
      bookOutline,
      layersOutline,
      eyeOutline,
      warningOutline,
      clipboardOutline,
      chatbubbleEllipsesOutline,
      informationCircleOutline,
      personOutline,
      syncOutline,
      leafOutline,
      pulseOutline,
      createOutline,
      trashOutline,
      close,
      refreshOutline,
      chevronForwardOutline,
    });
  }

  get canManageCrops(): boolean {
    return ['OWNER', 'FOREMAN', 'AGRONOMIST'].includes(this.userRole);
  }

  get valorConfirmacionRequerido(): string {
    if (!this.cultivo) return '';
    return this.cultivo.renspa?.trim() ? this.cultivo.renspa.trim() : this.cultivo.especie.trim();
  }

  get isEliminacionValida(): boolean {
    return (
      !!this.cultivo &&
      this.renspaConfirmacion.trim() === this.valorConfirmacionRequerido &&
      this.motivoEliminacion.trim().length > 0
    );
  }

  ngOnInit() {
    this.cropId = this.route.snapshot.paramMap.get('id') || '';

    this.contextService.userRole$
      .pipe(takeUntil(this.destroy$))
      .subscribe((role) => {
        this.userRole = role || '';
        this.cdr.detectChanges();
      });

    this.contextService.selectedFarm$
      .pipe(
        filter((farm) => !!farm),
        take(1),
        takeUntil(this.destroy$)
      )
      .subscribe((farm) => {
        this.farmId = farm!.id;
        this.cargarTodo(true);
      });
  }

  ionViewWillEnter() {
    if (this.hasLoadedOnce && this.farmId && this.cropId) {
      this.cargarTodo(false);
    }
  }

  ionViewDidEnter() {
    if (this.mapaCultivo) {
      setTimeout(() => {
        this.mapaCultivo?.invalidateSize();
        if (this.poligonoLayer) {
          this.mapaCultivo?.fitBounds(this.poligonoLayer.getBounds(), { padding: [20, 20] });
        }
      }, 150);
    }
  }

  ionViewWillLeave() {
    this.accionPendienteMenu = null;
    this.isMenuAccionesOpen = false;
    this.isModalCosechaOpen = false;
    this.isModalEstadoOpen = false;
    this.isModalEliminarOpen = false;
  }

  cargarTodo(showSpinner = true, refresherEvent?: any) {
    if (!this.cropId || !this.farmId) {
      this.isLoading = false;
      refresherEvent?.target?.complete();
      this.cdr.detectChanges();
      return;
    }

    if (showSpinner) {
      this.isLoading = true;
    }
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.cropService
      .getCropById(this.cropId, this.farmId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (crop) => {
          this.cultivo = crop;
          this.aplicarFiltroEventos(this.filtroEventos);
          this.isLoading = false;
          this.hasLoadedOnce = true;
          refresherEvent?.target?.complete();
          this.cdr.detectChanges();

          const targetFarmId = crop.fincaId || this.farmId;
          this.cargarMapasYLote(targetFarmId, crop.loteId);
        },
        error: (err) => {
          console.error('Error cargando detalle del cultivo:', err);
          this.errorMessage = 'No se pudo obtener la información del cultivo.';
          this.isLoading = false;
          refresherEvent?.target?.complete();
          this.cdr.detectChanges();
        },
      });
  }

  handleRefresh(event: any) {
    this.cargarTodo(false, event);
  }

  private cargarMapasYLote(targetFarmId: string, loteId?: string) {
    if (!targetFarmId) return;

    this.spectralMapService
      .getMapsByFarm(targetFarmId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (maps) => {
          this.mapasDisponibles = (maps || []).filter((m) => m.mapStatus === 'READY');
          this.indicesDisponibles = Array.from(
            new Set(this.mapasDisponibles.map((m) => m.indexType))
          );
          this.cdr.detectChanges();
        },
        error: () => {
          this.mapasDisponibles = [];
          this.indicesDisponibles = [];
        },
      });

    if (!loteId) {
      this.loteAsignado = null;
      this.destruirMapa();
      this.cdr.detectChanges();
      return;
    }

    this.lotService
      .getLotsByFarm(targetFarmId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lots) => {
          this.loteAsignado = lots.find((l) => l.id === loteId) || null;
          this.cdr.detectChanges();
          if (this.loteAsignado && this.loteAsignado.polygon?.length > 0) {
            if (this.mapInitTimeout) clearTimeout(this.mapInitTimeout);
            this.mapInitTimeout = setTimeout(() => this.inicializarORefrescarMapa(), 150);
          }
        },
      });
  }

  private inicializarORefrescarMapa() {
    const container = document.getElementById('mapa-cultivo');
    if (!container || !this.loteAsignado?.polygon?.length) return;

    if (!this.mapaCultivo) {
      this.mapaCultivo = L.map('mapa-cultivo', { zoomControl: false }).setView(
        [-29.161, -67.4983],
        15
      );
      L.control.zoom({ position: 'topright' }).addTo(this.mapaCultivo);
      L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }).addTo(this.mapaCultivo);
    }

    if (this.poligonoLayer) {
      this.mapaCultivo.removeLayer(this.poligonoLayer);
    }

    this.poligonoLayer = L.polygon(this.loteAsignado.polygon as L.LatLngExpression[], {
      color: '#ffffff',
      weight: 2.5,
      fillColor: '#0d8a5c',
      fillOpacity: 0.35,
    }).addTo(this.mapaCultivo);

    this.mapaCultivo.invalidateSize();
    const bounds = this.poligonoLayer.getBounds();
    if (bounds.isValid()) {
      this.mapaCultivo.fitBounds(bounds, { padding: [20, 20], maxZoom: 18 });
    }

    if (this.capaActiva !== 'Normal') {
      this.cambiarCapa(this.capaActiva);
    }
  }

  cambiarCapa(tipo: string) {
    this.capaActiva = tipo;
    if (!this.mapaCultivo || !this.poligonoLayer) return;

    if (this.capaEspectralActual) {
      this.mapaCultivo.removeLayer(this.capaEspectralActual);
      this.capaEspectralActual = null;
    }
    if (this.maskLayer) {
      this.mapaCultivo.removeLayer(this.maskLayer);
      this.maskLayer = null;
    }

    if (tipo === 'Normal') {
      this.poligonoLayer.setStyle({
        fillColor: '#0d8a5c',
        fillOpacity: 0.35,
        weight: 2.5,
        color: '#ffffff',
      });
      return;
    }

    const mapa = this.mapasDisponibles.find((m) => m.indexType === tipo);
    if (mapa?.tilesBaseUrl) {
      let tileUrl = `${environment.minioBaseUrl}${mapa.tilesBaseUrl}{z}/{x}/{y}.png`;
      if (tileUrl.includes('azurite-azuretest')) {
        tileUrl = tileUrl.replace('azurite-azuretest', 'localhost');
      }

      this.capaEspectralActual = L.tileLayer(tileUrl, {
        minZoom: 10,
        maxZoom: 22,
        minNativeZoom: 14,
        maxNativeZoom: 20,
        tms: true,
        opacity: 1.0,
        zIndex: 10,
        bounds: this.poligonoLayer.getBounds(),
      }).addTo(this.mapaCultivo);

      const outerBounds: L.LatLngTuple[] = [
        [-90, -360],
        [90, -360],
        [90, 360],
        [-90, 360],
      ];
      const lotRings = this.poligonoLayer.getLatLngs() as any[];

      this.maskLayer = L.polygon([outerBounds, ...lotRings], {
        color: 'transparent',
        fillColor: '#000000',
        fillOpacity: 0.35,
        interactive: false,
      }).addTo(this.mapaCultivo);

      this.capaEspectralActual.bringToFront();
      this.maskLayer.bringToFront();

      this.poligonoLayer.setStyle({
        fillColor: '#ffffff',
        fillOpacity: 0,
        weight: 2.5,
        color: '#ffffff',
      });
      this.poligonoLayer.bringToFront();
    }
  }

  // --- CUADERNO DE CAMPO ---
  onSegmentEventosChange(event: any) {
    const val = event?.detail?.value;
    if (val) {
      this.aplicarFiltroEventos(val);
    }
  }

  aplicarFiltroEventos(tipo: 'Todos' | 'Alerta' | 'Tarea' | 'Comentario') {
    this.filtroEventos = tipo;
    const historial = this.cultivo?.historial || [];
    this.eventosFiltrados =
      tipo === 'Todos' ? historial : historial.filter((ev) => ev.tipo === tipo);
    this.cdr.detectChanges();
  }

  getIconoEvento(tipo: string): string {
    switch (tipo) {
      case 'Alerta':
        return 'warning-outline';
      case 'Tarea':
        return 'clipboard-outline';
      case 'Comentario':
        return 'chatbubble-ellipses-outline';
      default:
        return 'information-circle-outline';
    }
  }

  calcularProgreso(inicio: Date, fin: Date): number {
    if (!inicio || !fin) return 0;
    const inicioMs = new Date(inicio).getTime();
    const finMs = new Date(fin).getTime();
    const total = finMs - inicioMs;
    if (isNaN(total) || total <= 0) return 0;
    const actual = Date.now() - inicioMs;
    return Math.max(0, Math.min(100, Math.round((actual / total) * 100)));
  }

  getEstadoClass(state: PhenologicalState): string {
    switch (state) {
      case 'GERMINATION':
        return 'state-germination';
      case 'VEGETATIVE_GROWTH':
        return 'state-vegetative';
      case 'FLOWERING':
        return 'state-flowering';
      case 'MATURITY':
        return 'state-maturity';
      case 'HARVESTED':
        return 'state-harvested';
      default:
        return 'state-vegetative';
    }
  }

  // --- MENÚ DE ACCIONES (BOTTOM SHEET) ---
  abrirMenuAcciones() {
    if (!this.cultivo || !this.canManageCrops) return;
    this.accionPendienteMenu = null;
    this.isMenuAccionesOpen = true;
    this.cdr.detectChanges();
  }

  cerrarMenuAcciones() {
    this.accionPendienteMenu = null;
    this.isMenuAccionesOpen = false;
  }

  ejecutarAccionMenu(accion: 'cosecha' | 'estado' | 'editar' | 'eliminar') {
    this.accionPendienteMenu = () => {
      switch (accion) {
        case 'cosecha':
          this.abrirModalCosecha();
          break;
        case 'estado':
          this.abrirModalEstado();
          break;
        case 'editar':
          this.editarCultivo();
          break;
        case 'eliminar':
          this.abrirModalEliminar();
          break;
      }
    };
    this.isMenuAccionesOpen = false;
    this.cdr.detectChanges();
  }

  onMenuAccionesDismiss() {
    this.isMenuAccionesOpen = false;
    if (this.accionPendienteMenu) {
      const ejecutar = this.accionPendienteMenu;
      this.accionPendienteMenu = null;
      ejecutar();
    }
  }

  // --- ACCIÓN 1: REGISTRAR COSECHA ---
  abrirModalCosecha() {
    this.fechaCosechaSeleccionada = new Date().toISOString().split('T')[0];
    this.errorCosecha = '';
    this.isModalCosechaOpen = true;
    this.cdr.detectChanges();
  }

  cerrarModalCosecha() {
    if (this.guardandoAccion) return;
    this.isModalCosechaOpen = false;
  }

  confirmarCosecha() {
    if (!this.cultivo || !this.fechaCosechaSeleccionada || !this.farmId) return;

    this.guardandoAccion = true;
    this.errorCosecha = '';
    const targetFarm = this.cultivo.fincaId || this.farmId;
    const fechaIso = `${this.fechaCosechaSeleccionada}T23:59:59`;

    this.cropService
      .registerHarvest(this.cultivo.id, targetFarm, fechaIso)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.guardandoAccion = false;
          this.isModalCosechaOpen = false;
          this.mostrarToast(
            this.cultivo?.isPerennial
              ? 'Cosecha registrada. Ciclo perenne reprogramado.'
              : 'Cosecha registrada exitosamente.',
            'success'
          );
          this.cargarTodo(false);
        },
        error: (err) => {
          this.guardandoAccion = false;
          this.errorCosecha =
            this.extraerMensajeError(err) ||
            'El cultivo aún no está en fecha para ser cosechado según la estimación.';
          this.cdr.detectChanges();
        },
      });
  }

  // --- ACCIÓN 2: CAMBIAR ESTADO FENOLÓGICO ---
  abrirModalEstado() {
    if (!this.cultivo) return;
    this.nuevoEstadoSeleccionado = this.cultivo.phenologicalState;
    this.errorEstado = '';
    this.isModalEstadoOpen = true;
    this.cdr.detectChanges();
  }

  cerrarModalEstado() {
    if (this.guardandoAccion) return;
    this.isModalEstadoOpen = false;
  }

  confirmarCambioEstado() {
    if (!this.cultivo || !this.nuevoEstadoSeleccionado || !this.farmId) return;

    this.guardandoAccion = true;
    this.errorEstado = '';
    const targetFarm = this.cultivo.fincaId || this.farmId;

    this.cropService
      .updatePhenologicalState(this.cultivo.id, this.nuevoEstadoSeleccionado, targetFarm)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.guardandoAccion = false;
          this.isModalEstadoOpen = false;
          this.mostrarToast('Estado fenológico actualizado.', 'success');
          this.cargarTodo(false);
        },
        error: (err) => {
          this.guardandoAccion = false;
          this.errorEstado =
            this.extraerMensajeError(err) || 'No se pudo actualizar el estado fenológico.';
          this.cdr.detectChanges();
        },
      });
  }

  // --- ACCIÓN 3: EDITAR CULTIVO ---
  editarCultivo() {
    if (!this.cultivo) return;
    this.router.navigate(['/cultivos/editar', this.cultivo.id]);
  }

  // --- ACCIÓN 4: ELIMINAR CULTIVO (RENSPA + MOTIVO) ---
  abrirModalEliminar() {
    this.renspaConfirmacion = '';
    this.motivoEliminacion = '';
    this.errorEliminar = '';
    this.isModalEliminarOpen = true;
    this.cdr.detectChanges();
  }

  cerrarModalEliminar() {
    if (this.guardandoAccion) return;
    this.isModalEliminarOpen = false;
  }

  confirmarEliminacion() {
    if (!this.cultivo || !this.isEliminacionValida || !this.farmId) return;

    this.guardandoAccion = true;
    this.errorEliminar = '';
    const targetFarm = this.cultivo.fincaId || this.farmId;

    this.cropService
      .deleteCrop(this.cultivo.id, targetFarm, this.motivoEliminacion.trim())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.guardandoAccion = false;
          this.isModalEliminarOpen = false;
          this.mostrarToast('Cultivo eliminado correctamente.', 'success');
          this.router.navigate(['/cultivos'], { replaceUrl: true });
        },
        error: (err) => {
          this.guardandoAccion = false;
          this.errorEliminar =
            this.extraerMensajeError(err) || 'Ocurrió un error al intentar eliminar el cultivo.';
          this.cdr.detectChanges();
        },
      });
  }

  private extraerMensajeError(err: any): string {
    if (!err) return '';
    if (typeof err.error === 'string') return err.error;
    return err.error?.message || err.error?.detail || err.error?.error || '';
  }

  private async mostrarToast(message: string, color: 'success' | 'danger' | 'dark' = 'dark') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2400,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

  private destruirMapa() {
    if (this.mapInitTimeout) {
      clearTimeout(this.mapInitTimeout);
      this.mapInitTimeout = null;
    }
    this.poligonoLayer = undefined;
    this.capaEspectralActual = null;
    this.maskLayer = null;
    if (this.mapaCultivo) {
      this.mapaCultivo.off();
      this.mapaCultivo.remove();
      this.mapaCultivo = undefined;
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.destruirMapa();
  }
}
