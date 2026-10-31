import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin, of, takeUntil, filter, take } from 'rxjs';
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
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonButton,
  IonIcon,
  IonSpinner,
  ToastController,
  ViewDidEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  leafOutline,
  mapOutline,
  locationOutline,
  checkmarkOutline,
  warningOutline,
  addCircleOutline,
} from 'ionicons/icons';
import * as L from 'leaflet';

import { CropService } from '../../../../core/services/crop.service';
import { LotService } from '../../../../core/services/lot.service';
import { ContextService } from '../../../../core/services/context.service';
import {
  CropUpsertDto,
  PhenologicalState,
  TypeCrop,
  TYPE_CROP_OPTIONS,
} from '../../../../core/models/cultivo.model';
import { Lot } from '../../../../core/models/lot.model';

@Component({
  selector: 'app-cultivo-form',
  templateUrl: './cultivo-form.page.html',
  styleUrls: ['./cultivo-form.page.scss'],
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
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
})
export class CultivoFormPage implements OnInit, ViewDidEnter, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private cropService = inject(CropService);
  private lotService = inject(LotService);
  private contextService = inject(ContextService);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();
  private mapTimeout: ReturnType<typeof setTimeout> | null = null;
  private map: L.Map | undefined;
  private polygonLayer: L.Polygon | undefined;

  esEdicion = false;
  cultivoId = '';
  preselectedLotId = '';
  farmId = '';
  farmName = '';

  isLoading = true;
  guardando = false;
  mensajeError = '';

  tiposCultivo = TYPE_CROP_OPTIONS;
  private readonly especiesPorTipo: Record<TypeCrop, string[]> = {
    FRUIT: ['Vid', 'Nogal', 'Olivo', 'Almendro', 'Pistacho', 'Ciruelo', 'Durazno', 'Limonero', 'Naranjo'],
    CEREAL: ['Maíz', 'Trigo', 'Cebada', 'Avena', 'Sorgo', 'Centeno'],
    OILSEED: ['Soja', 'Girasol', 'Maní', 'Colza'],
    FORAGE: ['Alfalfa', 'Avena Forrajera', 'Ryegrass', 'Trébol', 'Festuca'],
    HORTICULTURAL: ['Tomate', 'Ajo', 'Cebolla', 'Papa', 'Zapallo', 'Pimiento'],
    INDUSTRIAL: ['Algodón', 'Caña de Azúcar', 'Tabaco', 'Lavanda'],
  };
  especiesFiltradas: string[] = [];
  mostrarSugerenciasEspecie = false;
  private blurTimeout: ReturnType<typeof setTimeout> | null = null;
  lotesAgricolas: Lot[] = [];
  loteSeleccionado: Lot | null = null;
  tieneLoteOriginal = false;

  // Campos del formulario
  typeCrop: TypeCrop = 'FRUIT';
  especie = '';
  variedad = '';
  fechaPlantacion = '';
  fechaCosecha = '';
  isPerennial = false;
  selectedLotId = '';
  hectareas: number | null = null;
  renspa = '';
  phenologicalState: PhenologicalState = 'VEGETATIVE_GROWTH';

  constructor() {
    addIcons({
      leafOutline,
      mapOutline,
      locationOutline,
      checkmarkOutline,
      warningOutline,
      addCircleOutline,
    });
  }

  get defaultBackHref(): string {
    return this.esEdicion && this.cultivoId ? `/cultivos/${this.cultivoId}` : '/cultivos';
  }

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.esEdicion = true;
      this.cultivoId = idParam;
    } else {
      this.preselectedLotId = this.route.snapshot.queryParamMap.get('lotId') || '';
    }

    this.contextService.selectedFarm$
      .pipe(
        filter((farm) => !!farm),
        take(1),
        takeUntil(this.destroy$)
      )
      .subscribe((farm) => {
        this.farmId = farm!.id;
        this.farmName = farm!.name;
        this.cargarDatosIniciales();
      });
  }

  ionViewDidEnter() {
    this.programarRenderMapa();
  }

  private cargarDatosIniciales() {
    this.isLoading = true;
    this.mensajeError = '';

    const lotes$ = this.lotService.getLotsByFarm(this.farmId);
    const cultivo$ =
      this.esEdicion && this.cultivoId
        ? this.cropService.getCropById(this.cultivoId, this.farmId)
        : of(null);

    forkJoin({ lotes: lotes$, cultivo: cultivo$ })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ lotes, cultivo }) => {
          this.lotesAgricolas = (lotes || []).filter(
            (l) =>
              l.type === 'AGRICULTURAL' ||
              l.type === 'CROP' ||
              (cultivo && (l.id === cultivo.loteId || l.name === cultivo.lote))
          );

          if (this.esEdicion && cultivo) {
            this.typeCrop = cultivo.typeCrop || 'FRUIT';
            this.especie = cultivo.especie || '';
            this.variedad = cultivo.variedad || '';
            this.fechaPlantacion = this.formatearFechaInput(cultivo.fechaPlantacion);
            this.fechaCosecha = this.formatearFechaInput(cultivo.fechaCosecha);
            this.isPerennial = Boolean(cultivo.isPerennial);
            this.hectareas = cultivo.hectareas || null;
            this.renspa = cultivo.renspa || '';
            this.phenologicalState = cultivo.phenologicalState || 'VEGETATIVE_GROWTH';

            const loteMatch = this.lotesAgricolas.find(
              (l) => l.id === cultivo.loteId || l.name === cultivo.lote
            );
            if (loteMatch) {
              this.loteSeleccionado = loteMatch;
              this.selectedLotId = loteMatch.id;
              this.tieneLoteOriginal = true;
            }
          } else if (this.preselectedLotId) {
            const lotePre = this.lotesAgricolas.find((l) => l.id === this.preselectedLotId);
            if (lotePre) {
              this.aplicarSeleccionDeLote(lotePre);
            }
          }

          this.isLoading = false;
          this.cdr.detectChanges();
          this.programarRenderMapa();
        },
        error: (err) => {
          console.error('Error cargando formulario de cultivo:', err);
          this.mensajeError = 'No se pudieron cargar los datos necesarios para el formulario.';
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  onEspecieFocus() {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }
    this.mostrarSugerenciasEspecie = true;
    this.actualizarSugerenciasEspecie();
  }

  onEspecieInput(event: any) {
    this.especie = event?.detail?.value ?? '';
    this.mostrarSugerenciasEspecie = true;
    this.actualizarSugerenciasEspecie();
  }

  onEspecieBlur() {
    if (this.blurTimeout) clearTimeout(this.blurTimeout);
    this.blurTimeout = setTimeout(() => {
      this.mostrarSugerenciasEspecie = false;
      this.cdr.detectChanges();
    }, 150);
  }

  seleccionarEspecieSugerida(sp: string) {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }
    this.especie = sp;
    this.mostrarSugerenciasEspecie = false;
    this.especiesFiltradas = [];
    this.cdr.detectChanges();
  }

  actualizarSugerenciasEspecie() {
    const norm = (s: string) =>
      (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const term = norm(this.especie);
    const base = this.especiesPorTipo[this.typeCrop] || this.especiesPorTipo.FRUIT;

    if (!term) {
      this.especiesFiltradas = base.slice(0, 6);
      return;
    }

    const todas = Array.from(new Set([...base, ...Object.values(this.especiesPorTipo).flat()]));
    const coincidencias = todas.filter((sp) => {
      const n = norm(sp);
      return n.includes(term) && n !== term;
    });

    coincidencias.sort((a, b) => {
      const aStarts = norm(a).startsWith(term) ? 0 : 1;
      const bStarts = norm(b).startsWith(term) ? 0 : 1;
      return aStarts - bStarts;
    });

    this.especiesFiltradas = coincidencias.slice(0, 6);
  }

  onLoteChange(event: any) {
    const lotId = event?.detail?.value;
    const lote = this.lotesAgricolas.find((l) => l.id === lotId) || null;
    if (lote) {
      this.aplicarSeleccionDeLote(lote);
    }
  }

  private aplicarSeleccionDeLote(lote: Lot) {
    this.selectedLotId = lote.id;
    this.loteSeleccionado = lote;
    const maxHa = lote.hectares ?? lote.area ?? 0;
    this.hectareas = Math.floor(maxHa * 1000) / 1000;
    this.cdr.detectChanges();
    this.programarRenderMapa();
  }

  private programarRenderMapa() {
    if (this.mapTimeout) clearTimeout(this.mapTimeout);
    this.mapTimeout = setTimeout(() => this.inicializarORefrescarMapa(), 150);
  }

  private inicializarORefrescarMapa() {
    const el = document.getElementById('mapa-form');
    if (!el) return;

    if (!this.map) {
      this.map = L.map('mapa-form', { zoomControl: false }).setView([-29.161, -67.4983], 13);
      L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }).addTo(this.map);
    }

    this.map.invalidateSize();

    if (this.polygonLayer) {
      this.map.removeLayer(this.polygonLayer);
      this.polygonLayer = undefined;
    }

    if (this.loteSeleccionado?.polygon?.length) {
      this.polygonLayer = L.polygon(this.loteSeleccionado.polygon as L.LatLngExpression[], {
        color: '#ffffff',
        weight: 2.5,
        fillColor: '#0d8a5c',
        fillOpacity: 0.45,
      }).addTo(this.map);

      const bounds = this.polygonLayer.getBounds();
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 18 });
      }
    }
  }

  guardarCultivo() {
    this.mensajeError = '';

    if (!this.selectedLotId) {
      this.mensajeError = 'Debes seleccionar un lote agrícola válido.';
      return;
    }
    if (!this.especie.trim()) {
      this.mensajeError = 'La especie del cultivo es obligatoria.';
      return;
    }
    if (!this.variedad.trim()) {
      this.mensajeError = 'La variedad es obligatoria.';
      return;
    }
    if (!this.fechaPlantacion || !this.fechaCosecha) {
      this.mensajeError = 'Completa las fechas de plantación y cosecha estimada.';
      return;
    }
    if (this.fechaCosecha < this.fechaPlantacion) {
      this.mensajeError = 'La fecha estimada de cosecha no puede ser anterior a la plantación.';
      return;
    }
    const sup = Number(this.hectareas);
    if (!sup || isNaN(sup) || sup <= 0) {
      this.mensajeError = 'La superficie implantada debe ser mayor a 0 hectáreas.';
      return;
    }
    const maxLote = this.loteSeleccionado?.hectares ?? this.loteSeleccionado?.area ?? 0;
    if (this.loteSeleccionado && maxLote > 0 && sup > maxLote) {
      this.mensajeError = `La superficie implantada (${sup} ha) no puede superar la del lote (${maxLote} ha).`;
      return;
    }
    if (!this.renspa.trim()) {
      this.mensajeError = 'El código RENSPA (SENASA) es obligatorio.';
      return;
    }

    const dto: CropUpsertDto = {
      lotId: this.selectedLotId,
      typeCrop: this.typeCrop,
      species: this.especie.trim(),
      variety: this.variedad.trim(),
      plantingDate: `${this.fechaPlantacion}T00:00:00`,
      estimateHarvestDate: `${this.fechaCosecha}T00:00:00`,
      implantedSurface: sup,
      renspa: this.renspa.trim(),
      phenologicalState: this.esEdicion ? this.phenologicalState : 'VEGETATIVE_GROWTH',
      isPerennial: this.isPerennial,
    };

    this.guardando = true;
    this.cdr.detectChanges();

    const request$ = this.esEdicion
      ? this.cropService.updateCrop(this.cultivoId, dto, this.farmId)
      : this.cropService.registerCrop(this.selectedLotId, dto, this.farmId);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (saved) => {
        this.guardando = false;
        this.mostrarToast(
          this.esEdicion
            ? 'Cultivo actualizado exitosamente.'
            : 'Cultivo registrado exitosamente.',
          'success'
        );

        if (this.esEdicion) {
          this.location.back();
        } else if (saved?.id) {
          this.router.navigate(['/cultivos', saved.id], { replaceUrl: true });
        } else {
          this.router.navigate(['/cultivos'], { replaceUrl: true });
        }
      },
      error: (err) => {
        console.error('Error guardando cultivo:', err);
        this.guardando = false;
        this.mensajeError =
          this.extraerMensajeError(err) ||
          (this.esEdicion
            ? 'Hubo un error al actualizar el cultivo.'
            : 'Hubo un error al registrar el cultivo.');
        this.cdr.detectChanges();
      },
    });
  }

  cancelar() {
    this.location.back();
  }

  irAMapa() {
    this.router.navigate(['/mapa']);
  }

  private formatearFechaInput(fecha: Date | string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }
    if (this.mapTimeout) {
      clearTimeout(this.mapTimeout);
      this.mapTimeout = null;
    }
    this.polygonLayer = undefined;
    if (this.map) {
      this.map.off();
      this.map.remove();
      this.map = undefined;
    }
  }
}
