import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, forkJoin, of, takeUntil, catchError } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonMenuButton,
  IonTitle,
  IonButton,
  IonBadge,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardContent,
  IonIcon,
  IonProgressBar,
  IonSpinner,
  IonFab,
  IonFabButton,
  IonModal,
  IonList,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonChip,
  ToastController,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  optionsOutline,
  close,
  add,
  leafOutline,
  locationOutline,
  calendarOutline,
  checkmarkCircle,
  warningOutline,
  closeCircle,
  refreshOutline,
  chevronForwardOutline,
  syncOutline,
} from 'ionicons/icons';

import { CropService } from '../../core/services/crop.service';
import { ContextService } from '../../core/services/context.service';
import { Finca } from '../../core/models/finca.model';
import {
  Cultivo,
  EventoCampo,
  PhenologicalState,
  PHENOLOGICAL_STATE_OPTIONS,
} from '../../core/models/cultivo.model';

@Component({
  selector: 'app-cultivos',
  templateUrl: './cultivos.page.html',
  styleUrls: ['./cultivos.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonButton,
    IonBadge,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonCard,
    IonCardContent,
    IonIcon,
    IonProgressBar,
    IonSpinner,
    IonFab,
    IonFabButton,
    IonModal,
    IonList,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonChip,
  ],
})
export class CultivosPage implements OnInit, ViewWillEnter, ViewWillLeave, OnDestroy {
  private cropService = inject(CropService);
  private contextService = inject(ContextService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private toastCtrl = inject(ToastController);

  private destroy$ = new Subject<void>();
  private hasLoadedOnce = false;

  fincaActiva: Finca | null = null;
  userRole = '';

  cultivosActivos: Cultivo[] = [];
  cultivosSinLote: Cultivo[] = [];
  cultivosCombinados: Cultivo[] = [];
  filteredCultivos: Cultivo[] = [];

  lotesDisponibles: string[] = [];
  estadosDisponibles = PHENOLOGICAL_STATE_OPTIONS;

  segmentoActual: 'Todos' | 'Activos' | 'Sin Lote' = 'Todos';
  searchTerm = '';
  selectedLote = '';
  selectedEstado = '';

  isFiltrosOpen = false;
  isLoading = true;
  errorMessage = '';

  constructor() {
    addIcons({
      optionsOutline,
      close,
      add,
      leafOutline,
      locationOutline,
      calendarOutline,
      checkmarkCircle,
      warningOutline,
      closeCircle,
      refreshOutline,
      chevronForwardOutline,
      syncOutline,
    });
  }

  get canManageCrops(): boolean {
    return ['OWNER', 'FOREMAN', 'AGRONOMIST'].includes(this.userRole);
  }

  get cantidadFiltrosActivos(): number {
    let count = 0;
    if (this.selectedLote && this.segmentoActual !== 'Sin Lote') count++;
    if (this.selectedEstado) count++;
    return count;
  }

  ngOnInit() {
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
          const isFarmChange = this.fincaActiva?.id !== farm.id;
          this.fincaActiva = farm;
          if (isFarmChange || !this.hasLoadedOnce) {
            this.cargarCultivos(true);
          }
        } else {
          this.fincaActiva = null;
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  ionViewWillEnter() {
    if (this.fincaActiva && this.hasLoadedOnce) {
      this.cargarCultivos(false);
    }
  }

  ionViewWillLeave() {
    this.isFiltrosOpen = false;
  }

  cargarCultivos(showSpinner = true, refresherEvent?: any) {
    if (!this.fincaActiva?.id) {
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

    forkJoin({
      activos: this.cropService.getCropsByFarm(this.fincaActiva.id),
      sinLote: this.cropService.getUnassignedCrops().pipe(catchError(() => of([]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ activos, sinLote }) => {
          this.cultivosActivos = activos;
          this.cultivosSinLote = sinLote;

          const uniqueMap = new Map<string, Cultivo>();
          [...activos, ...sinLote].forEach((c) => {
            if (c.id && !uniqueMap.has(c.id)) {
              uniqueMap.set(c.id, c);
            }
          });
          this.cultivosCombinados = Array.from(uniqueMap.values());

          this.extraerLotesDisponibles();
          this.aplicarFiltros();
          this.isLoading = false;
          this.hasLoadedOnce = true;
          refresherEvent?.target?.complete();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error cargando cultivos:', err);
          this.errorMessage = 'No se pudieron cargar los cultivos de la finca.';
          this.isLoading = false;
          refresherEvent?.target?.complete();
          this.cdr.detectChanges();
        },
      });
  }

  handleRefresh(event: any) {
    this.cargarCultivos(false, event);
  }

  private extraerLotesDisponibles() {
    const lotesSet = new Set<string>();
    this.cultivosCombinados.forEach((c) => {
      if (c.lote && c.lote.trim() !== '') {
        lotesSet.add(c.lote.trim());
      }
    });
    this.lotesDisponibles = Array.from(lotesSet).sort();

    if (this.selectedLote && !this.lotesDisponibles.includes(this.selectedLote)) {
      this.selectedLote = '';
    }
  }

  onSearchInput(event: any) {
    this.searchTerm = event?.detail?.value ?? '';
    this.aplicarFiltros();
  }

  onSearchClear() {
    this.searchTerm = '';
    this.aplicarFiltros();
  }

  onSegmentChange(event: any) {
    const nuevoSegmento = event?.detail?.value;
    if (nuevoSegmento) {
      this.segmentoActual = nuevoSegmento;
      if (this.segmentoActual === 'Sin Lote') {
        this.selectedLote = '';
      }
      this.aplicarFiltros();
    }
  }

  abrirModalFiltros() {
    this.isFiltrosOpen = true;
  }

  cerrarModalFiltros() {
    this.isFiltrosOpen = false;
  }

  limpiarFiltrosAvanzados() {
    this.selectedLote = '';
    this.selectedEstado = '';
    this.aplicarFiltros();
  }

  limpiarTodo() {
    this.searchTerm = '';
    this.segmentoActual = 'Todos';
    this.selectedLote = '';
    this.selectedEstado = '';
    this.aplicarFiltros();
  }

  quitarFiltroLote() {
    this.selectedLote = '';
    this.aplicarFiltros();
  }

  quitarFiltroEstado() {
    this.selectedEstado = '';
    this.aplicarFiltros();
  }

  aplicarFiltros() {
    let result = this.cultivosCombinados;

    if (this.segmentoActual === 'Activos') {
      result = this.cultivosActivos;
    } else if (this.segmentoActual === 'Sin Lote') {
      result = this.cultivosSinLote;
    }

    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const term = this.searchTerm.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.especie?.toLowerCase().includes(term) ||
          c.variedad?.toLowerCase().includes(term) ||
          c.lote?.toLowerCase().includes(term) ||
          c.renspa?.toLowerCase().includes(term)
      );
    }

    if (this.selectedLote && this.segmentoActual !== 'Sin Lote') {
      result = result.filter((c) => c.lote === this.selectedLote);
    }

    if (this.selectedEstado) {
      result = result.filter((c) => c.estado === this.selectedEstado);
    }

    this.filteredCultivos = result;
    this.cdr.detectChanges();
  }

  calcularProgreso(inicio: Date, fin: Date): number {
    if (!inicio || !fin) return 0;
    const inicioMs = new Date(inicio).getTime();
    const finMs = new Date(fin).getTime();
    const total = finMs - inicioMs;
    if (isNaN(total) || total <= 0) return 0;

    const actual = Date.now() - inicioMs;
    const porcentaje = Math.round((actual / total) * 100);
    return Math.max(0, Math.min(100, porcentaje));
  }

  getAlertas(cultivo: Cultivo): EventoCampo[] {
    return (cultivo.historial || []).filter((evento) => evento.tipo === 'Alerta');
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

  irAMisFincas() {
    this.router.navigate(['/home']);
  }

  verDetalle(cultivo: Cultivo) {
    if (!cultivo?.id) return;
    this.router.navigate(['/cultivos', cultivo.id]);
  }

  registrarCultivo() {
    this.router.navigate(['/cultivos/nuevo']);
  }

  private async mostrarAviso(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'dark',
    });
    await toast.present();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
