import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin, of, takeUntil, filter, take } from 'rxjs';
import { finalize } from 'rxjs/operators';
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
import { NetworkService } from '../../../../core/services/network.service';
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
    ReactiveFormsModule,
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
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private cropService = inject(CropService);
  private lotService = inject(LotService);
  private contextService = inject(ContextService);
  private networkService = inject(NetworkService);
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

  // Formulario reactivo del cultivo
  cultivoForm = this.fb.group({
    typeCrop: this.fb.nonNullable.control<TypeCrop>('FRUIT', [Validators.required]),
    especie: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/\S+/)]),
    variedad: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/\S+/)]),
    fechaPlantacion: this.fb.nonNullable.control('', [Validators.required]),
    fechaCosecha: this.fb.nonNullable.control('', [Validators.required]),
    isPerennial: this.fb.nonNullable.control(false),
    selectedLotId: this.fb.nonNullable.control('', [Validators.required]),
    hectareas: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.001)]),
    renspa: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/\S+/)]),
  });
  phenologicalState: PhenologicalState = 'VEGETATIVE_GROWTH';

  get typeCrop(): TypeCrop {
    return this.cultivoForm.controls.typeCrop.value;
  }
  set typeCrop(value: TypeCrop) {
    this.cultivoForm.controls.typeCrop.setValue(value);
  }

  get especie(): string {
    return this.cultivoForm.controls.especie.value;
  }
  set especie(value: string) {
    this.cultivoForm.controls.especie.setValue(value);
  }

  get variedad(): string {
    return this.cultivoForm.controls.variedad.value;
  }
  set variedad(value: string) {
    this.cultivoForm.controls.variedad.setValue(value);
  }

  get fechaPlantacion(): string {
    return this.cultivoForm.controls.fechaPlantacion.value;
  }
  set fechaPlantacion(value: string) {
    this.cultivoForm.controls.fechaPlantacion.setValue(value);
  }

  get fechaCosecha(): string {
    return this.cultivoForm.controls.fechaCosecha.value;
  }
  set fechaCosecha(value: string) {
    this.cultivoForm.controls.fechaCosecha.setValue(value);
  }

  get isPerennial(): boolean {
    return this.cultivoForm.controls.isPerennial.value;
  }
  set isPerennial(value: boolean) {
    this.cultivoForm.controls.isPerennial.setValue(value);
  }

  get selectedLotId(): string {
    return this.cultivoForm.controls.selectedLotId.value;
  }
  set selectedLotId(value: string) {
    this.cultivoForm.controls.selectedLotId.setValue(value);
  }

  get hectareas(): number | null {
    return this.cultivoForm.controls.hectareas.value;
  }
  set hectareas(value: number | null) {
    this.cultivoForm.controls.hectareas.setValue(value);
  }

  get renspa(): string {
    return this.cultivoForm.controls.renspa.value;
  }
  set renspa(value: string) {
    this.cultivoForm.controls.renspa.setValue(value);
  }

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

    this.cultivoForm.controls.typeCrop.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.actualizarSugerenciasEspecie());

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
            this.cultivoForm.patchValue(
              {
                typeCrop: cultivo.typeCrop || 'FRUIT',
                especie: cultivo.especie || '',
                variedad: cultivo.variedad || '',
                fechaPlantacion: this.formatearFechaInput(cultivo.fechaPlantacion),
                fechaCosecha: this.formatearFechaInput(cultivo.fechaCosecha),
                isPerennial: Boolean(cultivo.isPerennial),
                hectareas: cultivo.hectareas || null,
                renspa: cultivo.renspa || '',
              },
              { emitEvent: false }
            );
            this.phenologicalState = cultivo.phenologicalState || 'VEGETATIVE_GROWTH';

            const loteMatch = this.lotesAgricolas.find(
              (l) => l.id === cultivo.loteId || l.name === cultivo.lote
            );
            if (loteMatch) {
              this.loteSeleccionado = loteMatch;
              this.selectedLotId = loteMatch.id;
              this.tieneLoteOriginal = true;
              this.cultivoForm.controls.selectedLotId.disable({ emitEvent: false });
            } else {
              this.cultivoForm.controls.selectedLotId.enable({ emitEvent: false });
            }
          } else if (this.preselectedLotId) {
            this.cultivoForm.controls.selectedLotId.enable({ emitEvent: false });
            const lotePre = this.lotesAgricolas.find((l) => l.id === this.preselectedLotId);
            if (lotePre) {
              this.aplicarSeleccionDeLote(lotePre);
            }
          } else {
            this.cultivoForm.controls.selectedLotId.enable({ emitEvent: false });
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
    const value = event?.detail?.value ?? '';
    this.mostrarSugerenciasEspecie = true;
    this.actualizarSugerenciasEspecie(value);
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
    this.cultivoForm.controls.especie.markAsDirty();
    this.cultivoForm.controls.especie.markAsTouched();
    this.mostrarSugerenciasEspecie = false;
    this.especiesFiltradas = [];
    this.cdr.detectChanges();
  }

  actualizarSugerenciasEspecie(overrideTerm?: string) {
    const norm = (s: string) =>
      (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const term = norm(overrideTerm ?? this.especie);
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
      L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
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
    this.cultivoForm.markAllAsTouched();

    const {
      selectedLotId,
      typeCrop,
      especie,
      variedad,
      fechaPlantacion,
      fechaCosecha,
      hectareas,
      renspa,
      isPerennial,
    } = this.cultivoForm.getRawValue();

    if (!selectedLotId) {
      this.mensajeError = 'Debes seleccionar un lote agrícola válido.';
      return;
    }
    if (!especie.trim()) {
      this.mensajeError = 'La especie del cultivo es obligatoria.';
      return;
    }
    if (!variedad.trim()) {
      this.mensajeError = 'La variedad es obligatoria.';
      return;
    }
    if (!fechaPlantacion || !fechaCosecha) {
      this.mensajeError = 'Completa las fechas de plantación y cosecha estimada.';
      return;
    }
    if (fechaCosecha < fechaPlantacion) {
      this.mensajeError = 'La fecha estimada de cosecha no puede ser anterior a la plantación.';
      return;
    }
    const sup = Number(hectareas);
    if (!sup || isNaN(sup) || sup <= 0) {
      this.mensajeError = 'La superficie implantada debe ser mayor a 0 hectáreas.';
      return;
    }
    const maxLote = this.loteSeleccionado?.hectares ?? this.loteSeleccionado?.area ?? 0;
    if (this.loteSeleccionado && maxLote > 0 && sup > maxLote) {
      this.mensajeError = `La superficie implantada (${sup} ha) no puede superar la del lote (${maxLote} ha).`;
      return;
    }
    if (!renspa.trim()) {
      this.mensajeError = 'El código RENSPA (SENASA) es obligatorio.';
      return;
    }

    const dto: CropUpsertDto = {
      lotId: selectedLotId,
      typeCrop,
      species: especie.trim(),
      variety: variedad.trim(),
      plantingDate: `${fechaPlantacion}T00:00:00`,
      estimateHarvestDate: `${fechaCosecha}T00:00:00`,
      implantedSurface: sup,
      renspa: renspa.trim(),
      phenologicalState: this.esEdicion ? this.phenologicalState : 'VEGETATIVE_GROWTH',
      isPerennial,
    };

    this.guardando = true;
    this.cdr.detectChanges();

    const request$ = this.esEdicion
      ? this.cropService.updateCrop(this.cultivoId, dto, this.farmId)
      : this.cropService.registerCrop(selectedLotId, dto, this.farmId);

    request$
      .pipe(
        finalize(() => {
          this.guardando = false;
          this.cdr.detectChanges();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (saved) => {
          this.guardando = false;
          this.cdr.detectChanges();
          const savedOffline =
            !this.networkService.isOnlineSnapshot ||
            String(saved?.id || '').startsWith('offline_');

          void this.mostrarToast(
            savedOffline
              ? 'Guardado sin conexión. Se enviará al recuperar internet.'
              : this.esEdicion
                ? 'Cultivo actualizado exitosamente.'
                : 'Cultivo registrado exitosamente.',
            savedOffline ? 'warning' : 'success'
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

  private async mostrarToast(
    message: string,
    color: 'success' | 'danger' | 'warning' | 'dark' = 'dark'
  ) {
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
