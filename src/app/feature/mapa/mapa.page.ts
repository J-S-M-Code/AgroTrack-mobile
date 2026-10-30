import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { 
  IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, 
  IonContent, IonFab, IonFabButton, IonIcon, IonFabList, 
  IonModal, IonButton, IonList, IonListHeader, IonItem, 
  IonLabel, IonRadioGroup, IonRadio, IonToggle, IonTextarea, 
  IonInput, IonSelect, IonSelectOption, IonCheckbox,
  ViewDidEnter, ViewWillLeave
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  layers, analyticsOutline, optionsOutline, checkmarkOutline, close, closeOutline,
  scanOutline, prismOutline, earthOutline, shapesOutline, squareOutline,
  ellipseOutline, arrowUndoOutline, refreshOutline, checkmarkCircle,
  pawOutline, layersOutline
} from 'ionicons/icons';

import * as L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';

import { ContextService } from '../../core/services/context.service';
import { LotService } from '../../core/services/lot.service';
import { SpectralMapService } from '../../core/services/spectral-map.service';
import { environment } from '../../../environments/environment';

import { Finca } from '../../core/models/finca.model';
import { Lot } from '../../core/models/lot.model';
import { SpectralMap } from '../../core/models/spectral-map.model';

@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.page.html',
  styleUrls: ['./mapa.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, 
    IonContent, IonFab, IonFabButton, IonIcon, IonFabList, 
    IonModal, IonButton, IonList, IonListHeader, IonItem, 
    IonLabel, IonRadioGroup, IonRadio, IonToggle, IonTextarea, 
    IonInput, IonSelect, IonSelectOption, IonCheckbox
  ]
})
export class MapaPage implements OnInit, ViewDidEnter, ViewWillLeave, OnDestroy {
  contextService = inject(ContextService);
  lotService = inject(LotService);
  spectralMapService = inject(SpectralMapService);
  cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();
  private initTimeout: ReturnType<typeof setTimeout> | null = null;
  private enterTimeout: ReturnType<typeof setTimeout> | null = null;
  private isViewActive = false;

  private map: L.Map | undefined;
  fincaActiva: Finca | null = null;
  
  // Capas
  private capaFondoSatelite!: L.TileLayer;
  private capaFondoTopografico!: L.TileLayer;
  capaFondoActiva: 'satelite' | 'topografico' = 'satelite';
  
  private fincaPolygonLayer: L.Polygon | undefined;
  private lotesGroup: L.FeatureGroup = L.featureGroup();
  private mapaLayers = new Map<string, L.TileLayer>();

  // Estado UI y Modales independientes
  isFiltrosOpen = false;
  isAnimalesOpen = false;
  isLoteInfoOpen = false;
  isGuardarLoteOpen = false;
  
  // Datos
  lotes: Lot[] = [];
  mapasDisponibles: SpectralMap[] = [];
  indicesDisponibles: string[] = [];
  
  // Filtros
  verLimitesFincas = true;
  indiceActivo: string | null = null;

  // Categorías de animales (SENASA)
  categoriasSenasa: string[] = [
    'Terneros/as',
    'Novillitos',
    'Novillos',
    'Vaquillonas',
    'Vacas',
    'Toros',
    'Toritos'
  ];
  categoriasSeleccionadas: Set<string> = new Set(this.categoriasSenasa);

  // Lote seleccionado para info
  selectedLote: Lot | null = null;

  // Dibujo (Geoman)
  isDrawingMode = false;
  dibujoFinalizado = false;
  formaActual: 'Polygon' | 'Rectangle' | 'Circle' = 'Polygon';
  puntosDibujados: L.LatLng[] = [];
  private currentDrawLayer: L.Polygon | L.Circle | null = null;

  // Formulario nuevo lote
  nuevoLoteNombre = '';
  nuevoLoteHectareas = 0;
  nuevoLoteTipo = 'PASTURE';
  nuevoLoteSuelo = 'UNKNOWN';
  nuevoLoteDescripcion = '';
  guardandoLote = false;
  errorGuardandoLote: string | null = null;

  constructor() {
    addIcons({
      layers, analyticsOutline, optionsOutline, checkmarkOutline, close, closeOutline,
      scanOutline, prismOutline, earthOutline, shapesOutline, squareOutline,
      ellipseOutline, arrowUndoOutline, refreshOutline, checkmarkCircle,
      pawOutline, layersOutline
    });
  }

  ngOnInit() {
    this.contextService.selectedFarm$
      .pipe(takeUntil(this.destroy$))
      .subscribe(farm => {
        if (farm) {
          const isFarmChange = this.fincaActiva?.id !== farm.id;
          this.fincaActiva = farm;
          if (isFarmChange) {
            this.limpiarCapasDeFincaAnterior();
          }
          this.cargarDatosAdicionales();
          if (this.isViewActive && this.isMapReady()) {
            this.dibujarFincaYCentrar();
            this.renderizarLotes();
            this.centrarMapa();
          }
        }
      });
  }

  ionViewDidEnter() {
    this.isViewActive = true;
    if (!this.map) {
      this.initMap();
    } else {
      if (this.enterTimeout) clearTimeout(this.enterTimeout);
      this.enterTimeout = setTimeout(() => {
        if (!this.isMapReady()) return;
        this.map!.invalidateSize();
        this.dibujarFincaYCentrar();
        this.renderizarLotes();
        this.centrarMapa();
      }, 150);
    }
  }

  ionViewWillLeave() {
    this.isViewActive = false;
    this.isFiltrosOpen = false;
    this.isAnimalesOpen = false;
    this.isLoteInfoOpen = false;
    this.isGuardarLoteOpen = false;
  }

  private isMapReady(): boolean {
    return !!(this.map && (this.map as any)._loaded && (this.map as any)._panes?.mapPane);
  }

  private limpiarCapasDeFincaAnterior() {
    if (this.indiceActivo && this.isMapReady()) {
      this.apagarIndiceActivo();
    } else {
      this.indiceActivo = null;
    }
    this.mapaLayers.forEach(layer => {
      if (this.isMapReady() && this.map!.hasLayer(layer)) {
        this.map!.removeLayer(layer);
      }
    });
    this.mapaLayers.clear();
    this.mapasDisponibles = [];
    this.indicesDisponibles = [];
    this.lotes = [];
    if (this.isMapReady()) {
      this.lotesGroup.clearLayers();
      if (this.fincaPolygonLayer) {
        this.fincaPolygonLayer.remove();
        this.fincaPolygonLayer = undefined;
      }
    }
  }

  cargarDatosAdicionales() {
    if (!this.fincaActiva) return;
    const farmId = this.fincaActiva.id;
    
    // Cargar mapas espectrales
    this.spectralMapService.getMapsByFarm(farmId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (maps) => {
          if (this.fincaActiva?.id !== farmId) return;
          this.mapasDisponibles = maps.filter(m => !m.mapStatus || m.mapStatus === 'READY');
          this.indicesDisponibles = Array.from(new Set(this.mapasDisponibles.map(m => m.indexType)));
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al cargar mapas espectrales:', err);
          this.cdr.detectChanges();
        }
      });

    // Cargar lotes
    this.lotService.getLotsByFarm(farmId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lotes) => {
          if (this.fincaActiva?.id !== farmId) return;
          this.lotes = lotes;
          if (this.isViewActive && this.isMapReady()) {
            this.renderizarLotes();
            this.centrarMapa();
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al cargar lotes:', err);
          this.cdr.detectChanges();
        }
      });
  }

  private initMap() {
    const mapElement = document.getElementById('main-map');
    if (!mapElement) return;

    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }

    // Determinar centro inicial
    let centerLat = -29.1610;
    let centerLon = -67.4983;

    if (this.fincaActiva) {
      if (this.fincaActiva.lat !== undefined && this.fincaActiva.lon !== undefined) {
        centerLat = this.fincaActiva.lat;
        centerLon = this.fincaActiva.lon;
      } else if (this.fincaActiva.polygon && this.fincaActiva.polygon.length > 0) {
        centerLat = this.fincaActiva.polygon[0][0];
        centerLon = this.fincaActiva.polygon[0][1];
      }
    }

    this.map = L.map('main-map', {
      center: [centerLat, centerLon],
      zoom: 14,
      maxZoom: 22,
      zoomControl: false
    });

    // Capa Satélite Google (igual a la web)
    this.capaFondoSatelite = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 22,
      maxNativeZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    });

    this.capaFondoTopografico = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 22,
      maxNativeZoom: 17
    });

    this.capaFondoSatelite.addTo(this.map);
    this.map.addLayer(this.lotesGroup);

    // Dibujar finca y lotes si ya tenemos datos
    this.dibujarFincaYCentrar();
    if (this.lotes && this.lotes.length > 0) {
      this.renderizarLotes();
      this.centrarMapa();
    }

    // Invalidate size tras renderizado en DOM móvil
    if (this.initTimeout) clearTimeout(this.initTimeout);
    this.initTimeout = setTimeout(() => {
      if (!this.isMapReady()) return;
      this.map!.invalidateSize();
      this.centrarMapa();
    }, 200);

    // Geoman setup
    this.map.pm.setLang('es');
    this.map.pm.addControls({ drawMarker: false, drawPolyline: false, drawCircleMarker: false, editMode: true, dragMode: false, cutPolygon: false, removalMode: true });
    this.map.pm.removeControls();

    this.map.on('pm:create', (e: any) => {
      // Mantenemos la capa nativa (Circle, Rectangle o Polygon) para que Geoman solo muestre los controles pertinentes
      const layer = e.layer as (L.Polygon | L.Circle);
      this.habilitarEdicionCapa(layer);
    });
  }

  private habilitarEdicionCapa(layer: L.Polygon | L.Circle) {
    this.currentDrawLayer = layer;
    (layer as any).pm.enable({
      allowSelfIntersection: false,
      snappable: true,
      snapDistance: 15
    });

    const recalcularHectareas = () => {
      if (this.currentDrawLayer instanceof L.Circle) {
        const radius = this.currentDrawLayer.getRadius();
        const areaM2 = Math.PI * radius * radius;
        this.nuevoLoteHectareas = parseFloat((areaM2 / 10000.0).toFixed(2));
      } else {
        const latlngs: any = (this.currentDrawLayer as L.Polygon).getLatLngs();
        const ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
        this.nuevoLoteHectareas = parseFloat(this.calculateAreaInHectares(ring).toFixed(2));
      }
      this.cdr.detectChanges();
    };

    layer.on('pm:edit', recalcularHectareas);
    layer.on('pm:markerdragend', recalcularHectareas);
    layer.on('pm:vertexadded', recalcularHectareas);
    layer.on('pm:vertexremoved', recalcularHectareas);

    recalcularHectareas();
    this.dibujoFinalizado = true;
    (this.map as any).pm.disableDraw();
    this.cdr.detectChanges();
  }

  private createCirclePolygon(center: L.LatLng, radiusInMeters: number, points: number = 64): L.LatLng[] {
    const coords: L.LatLng[] = [];
    const earthRadius = 6378137;
    const lat = center.lat * Math.PI / 180;
    const lng = center.lng * Math.PI / 180;
    const d = radiusInMeters / earthRadius;

    for (let i = 0; i < points; i++) {
      const angle = (Math.PI * 2 * i) / points;
      const ptLat = Math.asin(Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(angle));
      const ptLng = lng + Math.atan2(Math.sin(angle) * Math.sin(d) * Math.cos(lat), Math.cos(d) - Math.sin(lat) * Math.sin(ptLat));
      coords.push(L.latLng(ptLat * 180 / Math.PI, ptLng * 180 / Math.PI));
    }
    return coords;
  }

  private dibujarFincaYCentrar() {
    if (!this.isMapReady() || !this.fincaActiva) return;

    if (this.fincaPolygonLayer) {
      this.fincaPolygonLayer.remove();
      this.fincaPolygonLayer = undefined;
    }

    if (this.fincaActiva.polygon && this.fincaActiva.polygon.length > 0) {
      this.fincaPolygonLayer = L.polygon(this.fincaActiva.polygon as L.LatLngExpression[], {
        color: '#ffffff',
        weight: 3,
        fill: false,
        fillOpacity: 0
      });
      if (this.verLimitesFincas) {
        this.fincaPolygonLayer.addTo(this.map!);
      }
    }
  }

  private centrarMapa() {
    if (!this.isMapReady()) return;
    const container = this.map!.getContainer();
    if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;

    if (this.lotesGroup.getLayers().length > 0) {
      const bounds = this.lotesGroup.getBounds();
      if (bounds.isValid()) {
        this.map!.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
        return;
      }
    }

    if (this.fincaPolygonLayer) {
      const bounds = this.fincaPolygonLayer.getBounds();
      if (bounds.isValid()) {
        this.map!.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
        return;
      }
    }

    if (this.fincaActiva && this.fincaActiva.lat !== undefined && this.fincaActiva.lon !== undefined) {
      this.map!.setView([this.fincaActiva.lat, this.fincaActiva.lon], 14);
    }
  }

  private renderizarLotes() {
    if (!this.isMapReady()) return;
    this.lotesGroup.clearLayers();

    // Ordenar de mayor a menor área para z-index correcto
    const lotesOrdenados = [...this.lotes].sort((a, b) => (b.area || 0) - (a.area || 0));

    // Si hay un índice activo, quitamos el sombreado interior de los lotes
    const fillOpacity = this.indiceActivo ? 0 : 0.4;

    lotesOrdenados.forEach(lote => {
      if (lote.polygon && lote.polygon.length > 0) {
        const colors = this.getColorByType(lote.type || 'PASTURE');
        
        const layer = L.polygon(lote.polygon as L.LatLngExpression[], {
          color: colors.border,
          weight: 3,
          fillColor: colors.fill,
          fillOpacity: fillOpacity
        });

        layer.on('click', () => {
          if (this.isDrawingMode || this.dibujoFinalizado) return;
          this.selectedLote = lote;
          this.isLoteInfoOpen = true;
          this.cdr.detectChanges();
        });

        this.lotesGroup.addLayer(layer);
      }
    });
  }

  getColorByType(type?: string) {
    switch (type) {
      case 'WATER_ZONE': return { border: '#1e88e5', fill: '#42a5f5' };
      case 'HANDLING_PEN': return { border: '#6d4c41', fill: '#8d6e63' };
      case 'FEEDING_ZONE': return { border: '#ffb300', fill: '#ffca28' };
      case 'AGRICULTURAL': return { border: '#43a047', fill: '#66bb6a' };
      case 'RESERVE': return { border: '#2e7d32', fill: '#388e3c' };
      case 'PASTURE':
      default: return { border: '#fbd350', fill: '#0d8a5c' };
    }
  }

  getTipoLoteLabel(type?: string): string {
    switch (type) {
      case 'PASTURE': return 'Pastura / Ganado';
      case 'AGRICULTURAL': return 'Agrícola / Cultivo';
      case 'WATER_ZONE': return 'Zona de Agua';
      case 'HANDLING_PEN': return 'Corral de Manejo';
      case 'FEEDING_ZONE': return 'Zona de Alimentación';
      case 'RESERVE': return 'Reserva / Bosque Nativo';
      default: return type || 'Sin definir';
    }
  }

  getTipoSueloLabel(soil?: string): string {
    switch (soil) {
      case 'CLAYEY': return 'Arcilloso';
      case 'SANDY': return 'Arenoso';
      case 'SILTY': return 'Limoso';
      case 'LOAMY': return 'Franco';
      case 'SANDY_LOAM': return 'Franco-Arenoso';
      case 'CLAY_LOAM': return 'Franco-Arcilloso';
      case 'UNKNOWN':
      default: return 'Desconocido';
    }
  }

  private calculateAreaInHectares(latlngs: L.LatLng[]): number {
    if (!latlngs || latlngs.length < 3) return 0;
    let area = 0;
    const radius = 6378137;
    for (let i = 0; i < latlngs.length; i++) {
      const p1 = latlngs[i];
      const p2 = latlngs[(i + 1) % latlngs.length];
      area += (p2.lng * Math.PI / 180 - p1.lng * Math.PI / 180) * (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
    }
    return Math.abs(area * radius * radius / 2.0) / 10000.0;
  }

  // --- BOTONES FAB ---
  abrirFiltrosCapas() {
    this.isAnimalesOpen = false;
    this.isFiltrosOpen = true;
  }

  abrirFiltrosAnimales() {
    this.isFiltrosOpen = false;
    this.isAnimalesOpen = true;
  }

  // --- FILTROS DE ANIMALES (SENASA) ---
  isCategoriaSeleccionada(cat: string): boolean {
    return this.categoriasSeleccionadas.has(cat);
  }

  toggleCategoriaAnimal(cat: string, event: any) {
    const checked = event.detail.checked;
    if (checked) {
      this.categoriasSeleccionadas.add(cat);
    } else {
      this.categoriasSeleccionadas.delete(cat);
    }
    this.cdr.detectChanges();
  }

  seleccionarTodasCategorias() {
    this.categoriasSenasa.forEach(cat => this.categoriasSeleccionadas.add(cat));
    this.cdr.detectChanges();
  }

  deseleccionarTodasCategorias() {
    this.categoriasSeleccionadas.clear();
    this.cdr.detectChanges();
  }

  iniciarModoDibujo() {
    this.activarHerramientaDibujo('Polygon');
  }

  activarHerramientaDibujo(forma: 'Polygon' | 'Rectangle' | 'Circle') {
    if (!this.map) return;
    this.formaActual = forma;
    this.isDrawingMode = true;
    this.dibujoFinalizado = false;
    this.puntosDibujados = [];

    const mapAny = this.map as any;
    mapAny.pm.disableDraw();
    if (this.currentDrawLayer) {
      this.currentDrawLayer.remove();
      this.currentDrawLayer = null;
    }

    this.map.off('pm:drawstart');
    this.map.on('pm:drawstart', (e: any) => {
      this.puntosDibujados = [];
      if (e.workingLayer) {
        e.workingLayer.on('pm:vertexadded', (v: any) => {
          this.puntosDibujados.push(v.latlng);
          this.cdr.detectChanges();
        });
      }
    });

    mapAny.pm.enableDraw(forma, {
      snappable: true,
      snapDistance: 15,
      allowSelfIntersection: false,
      pathOptions: {
        color: '#fbd350',
        weight: 3,
        fillColor: '#0d8a5c',
        fillOpacity: 0.5
      }
    });
    this.cdr.detectChanges();
  }

  deshacerUltimoPunto() {
    if (!this.map || this.puntosDibujados.length === 0) return;
    const mapAny = this.map as any;

    try {
      if (mapAny.pm.Draw && mapAny.pm.Draw.Polygon && typeof mapAny.pm.Draw.Polygon._removeLastVertex === 'function') {
        mapAny.pm.Draw.Polygon._removeLastVertex();
      }
    } catch (e) {
      console.warn('Error en _removeLastVertex de Geoman:', e);
    }

    this.puntosDibujados.pop();
    this.cdr.detectChanges();
  }

  terminarDibujoPoligono() {
    if (this.puntosDibujados.length < 3 || !this.map) return;
    const mapAny = this.map as any;
    mapAny.pm.disableDraw();

    const newPoly = L.polygon(this.puntosDibujados, {
      color: '#fbd350',
      weight: 3,
      fillColor: '#0d8a5c',
      fillOpacity: 0.5
    });
    newPoly.addTo(this.map);

    this.habilitarEdicionCapa(newPoly);
  }

  cancelarDibujo() {
    this.isDrawingMode = false;
    this.dibujoFinalizado = false;
    this.puntosDibujados = [];
    (this.map as any)?.pm.disableDraw();
    if (this.currentDrawLayer) {
      (this.currentDrawLayer as any)?.pm?.disable();
      this.currentDrawLayer.remove();
      this.currentDrawLayer = null;
    }
    this.cdr.detectChanges();
  }

  abrirModalGuardar() {
    this.errorGuardandoLote = null;
    if (this.currentDrawLayer) {
      (this.currentDrawLayer as any)?.pm?.disable();
    }
    this.isGuardarLoteOpen = true;
  }

  cancelarGuardado() {
    this.isGuardarLoteOpen = false;
    this.errorGuardandoLote = null;
    if (this.currentDrawLayer && this.dibujoFinalizado) {
      (this.currentDrawLayer as any)?.pm?.enable({
        allowSelfIntersection: false,
        snappable: true,
        snapDistance: 15
      });
    }
  }

  guardarLote() {
    if (!this.fincaActiva || !this.nuevoLoteNombre.trim() || !this.currentDrawLayer || this.guardandoLote) return;

    this.guardandoLote = true;
    this.errorGuardandoLote = null;

    let latlngs: any[] = [];

    if (this.currentDrawLayer instanceof L.Circle) {
      const center = this.currentDrawLayer.getLatLng();
      const radius = this.currentDrawLayer.getRadius();
      const circlePoints = this.createCirclePolygon(center, radius);
      latlngs = circlePoints.map(c => [c.lng, c.lat]);
    } else {
      latlngs = ((this.currentDrawLayer as L.Polygon).getLatLngs()[0] as L.LatLng[]).map(c => [c.lng, c.lat]);
    }

    if (latlngs.length > 0 && (latlngs[0][0] !== latlngs[latlngs.length-1][0] || latlngs[0][1] !== latlngs[latlngs.length-1][1])) {
      latlngs.push([...latlngs[0]]);
    }

    const nuevoLoteDto = {
      name: this.nuevoLoteNombre.trim(),
      hectares: this.nuevoLoteHectareas || 1.0,
      type: this.nuevoLoteTipo,
      soilType: this.nuevoLoteTipo === 'AGRICULTURAL' || this.nuevoLoteTipo === 'PASTURE' ? this.nuevoLoteSuelo : 'UNKNOWN',
      state: 'ACTIVE',
      description: this.nuevoLoteDescripcion,
      polygonLimit: {
        type: 'Polygon',
        coordinates: [latlngs]
      }
    };

    this.lotService.createLot(this.fincaActiva.id, nuevoLoteDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lote) => {
          this.guardandoLote = false;
          this.lotes.push(lote);
          this.renderizarLotes();
          this.centrarMapa();
          this.isGuardarLoteOpen = false;
          this.cancelarDibujo();
          
          this.nuevoLoteNombre = '';
          this.nuevoLoteDescripcion = '';
          this.nuevoLoteSuelo = 'UNKNOWN';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.guardandoLote = false;
          console.error('Error guardando lote', err);
          if (err.error && err.error.error) {
            this.errorGuardandoLote = err.error.error;
          } else if (err.error && err.error.message) {
            this.errorGuardandoLote = err.error.message;
          } else {
            this.errorGuardandoLote = 'Error al guardar el lote. Verifica que esté dentro de los límites de la finca y no se cruce sobre sí mismo.';
          }
          this.cdr.detectChanges();
        }
      });
  }

  // --- FILTROS Y CAPAS ---
  cambiarCapaFondo(event: any) {
    const tipo = event.detail.value;
    if (this.capaFondoActiva === tipo || !this.map) return;

    if (tipo === 'satelite') {
      this.map.removeLayer(this.capaFondoTopografico);
      this.capaFondoSatelite.addTo(this.map);
    } else {
      this.map.removeLayer(this.capaFondoSatelite);
      this.capaFondoTopografico.addTo(this.map);
    }
    this.capaFondoActiva = tipo;
    this.reordenarMapasEspectrales();
    this.cdr.detectChanges();
  }

  toggleLimitesFinca(event: any) {
    this.verLimitesFincas = event.detail.checked;
    if (!this.map) return;

    if (this.verLimitesFincas) {
      if (this.fincaPolygonLayer) this.fincaPolygonLayer.addTo(this.map);
      this.map.addLayer(this.lotesGroup);
    } else {
      if (this.fincaPolygonLayer) this.fincaPolygonLayer.remove();
      this.map.removeLayer(this.lotesGroup);
    }
    this.cdr.detectChanges();
  }

  private actualizarEstiloLotes() {
    const fillOpacity = this.indiceActivo ? 0 : 0.4;
    this.lotesGroup.eachLayer((layer: any) => {
      if (layer.setStyle) {
        layer.setStyle({ fillOpacity: fillOpacity });
      }
    });
  }

  toggleSwitchMapasEspectrales(event: any) {
    const isChecked = event.detail.checked;
    if (!isChecked) {
      if (this.indiceActivo) {
        this.apagarIndiceActivo();
      }
    } else {
      if (!this.indiceActivo && this.indicesDisponibles.length > 0) {
        this.activarIndice(this.indicesDisponibles[0]);
      }
    }
  }

  toggleIndice(event: any) {
    const indice = event.detail.value;
    if (!this.map || !indice) return;
    this.activarIndice(indice);
  }

  activarIndice(indice: string) {
    if (!this.map || !indice) return;
    this.apagarIndiceActivo();
    this.indiceActivo = indice;
    this.actualizarEstiloLotes();
    
    const mapasDelIndice = this.mapasDisponibles.filter(m => m.indexType === indice);
    mapasDelIndice.forEach(mapa => {
      if (mapa.idMap) {
        let layer = this.mapaLayers.get(mapa.idMap);
        if (!layer) {
          let tileUrl = `${environment.minioBaseUrl}${mapa.tilesBaseUrl}{z}/{x}/{y}.png`;
          if (tileUrl.includes('azurite-azuretest')) {
            tileUrl = tileUrl.replace('azurite-azuretest', 'localhost');
          }
          
          layer = L.tileLayer(tileUrl, { 
            minZoom: 10,
            maxZoom: 22, 
            minNativeZoom: 14,
            maxNativeZoom: 20, 
            tms: true, 
            opacity: 0.9, 
            zIndex: 10 
          });
          this.mapaLayers.set(mapa.idMap, layer);
        }
        layer.addTo(this.map!);
        layer.bringToFront();
      }
    });
    this.cdr.detectChanges();
  }

  apagarIndiceActivo() {
    if (!this.map || !this.indiceActivo) return;
    const mapasDelIndice = this.mapasDisponibles.filter(m => m.indexType === this.indiceActivo);
    mapasDelIndice.forEach(mapa => {
      if (mapa.idMap) {
        const layer = this.mapaLayers.get(mapa.idMap);
        if (layer) this.map!.removeLayer(layer);
      }
    });
    this.indiceActivo = null;
    this.actualizarEstiloLotes();
    this.cdr.detectChanges();
  }

  private reordenarMapasEspectrales() {
    if (this.indiceActivo && this.map) {
      const mapasDelIndice = this.mapasDisponibles.filter(m => m.indexType === this.indiceActivo);
      mapasDelIndice.forEach(mapa => {
        if (mapa.idMap) {
          const mLayer = this.mapaLayers.get(mapa.idMap);
          if (mLayer) mLayer.bringToFront();
        }
      });
    }
  }

  ngOnDestroy() {
    this.isViewActive = false;
    this.destroy$.next();
    this.destroy$.complete();
    if (this.initTimeout) {
      clearTimeout(this.initTimeout);
      this.initTimeout = null;
    }
    if (this.enterTimeout) {
      clearTimeout(this.enterTimeout);
      this.enterTimeout = null;
    }
    this.fincaPolygonLayer = undefined;
    this.lotesGroup.clearLayers();
    this.mapaLayers.clear();
    if (this.map) {
      this.map.off();
      this.map.remove();
      this.map = undefined;
    }
  }
}
