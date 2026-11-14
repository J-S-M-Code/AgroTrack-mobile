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
  IonIcon,
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
  IonChip,
  IonSpinner,
  IonFab,
  IonFabButton,
  IonModal,
  IonList,
  IonItem,
  IonSelect,
  IonSelectOption,
  ViewWillEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  funnelOutline,
  addOutline,
  warningOutline,
  documentTextOutline,
  cameraOutline,
  locationOutline,
  leafOutline,
  pawOutline,
  timeOutline,
  personOutline,
  chevronForwardOutline,
  closeCircle,
  refreshOutline,
  notificationsOffOutline,
  navigateOutline,
} from 'ionicons/icons';

import { AlertService } from '../../core/services/alert.service';
import { ContextService } from '../../core/services/context.service';
import { NotificationService } from '../../core/services/notification.service';
import { LotService } from '../../core/services/lot.service';
import { CropService } from '../../core/services/crop.service';
import { AnimalService } from '../../core/services/animal.service';
import { Novedad, PrioridadLabel } from '../../core/models/novedad.model';

@Component({
  selector: 'app-novedades',
  templateUrl: './novedades.page.html',
  styleUrls: ['./novedades.page.scss'],
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
    IonIcon,
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
    IonChip,
    IonSpinner,
    IonFab,
    IonFabButton,
    IonModal,
    IonList,
    IonItem,
    IonSelect,
    IonSelectOption,
  ],
})
export class NovedadesPage implements OnInit, OnDestroy, ViewWillEnter {
  private alertService = inject(AlertService);
  private contextService = inject(ContextService);
  private notificationService = inject(NotificationService);
  private lotService = inject(LotService);
  private cropService = inject(CropService);
  private animalService = inject(AnimalService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  farmId = '';
  farmName = '';
  userRole = '';

  novedades: Novedad[] = [];
  novedadesFiltradas: Novedad[] = [];

  private lotesMap = new Map<string, string>();
  private cultivosMap = new Map<string, string>();
  private animalesMap = new Map<string, string>();

  segmentoActual: 'Todas' | 'Alerta' | 'Nota' = 'Todas';
  terminoBusqueda = '';
  filtroPrioridad: 'Todas' | PrioridadLabel = 'Todas';
  filtroEntidad: 'Todas' | 'Lote' | 'Cultivo' | 'Animal' = 'Todas';

  prioridadesDisponibles: PrioridadLabel[] = ['Crítica', 'Alta', 'Media', 'Baja'];
  entidadesDisponibles: ('Lote' | 'Cultivo' | 'Animal')[] = ['Lote', 'Cultivo', 'Animal'];

  isFilterModalOpen = false;
  isLoading = true;
  errorMessage = '';

  constructor() {
    addIcons({
      funnelOutline,
      addOutline,
      warningOutline,
      documentTextOutline,
      cameraOutline,
      locationOutline,
      leafOutline,
      pawOutline,
      timeOutline,
      personOutline,
      chevronForwardOutline,
      closeCircle,
      refreshOutline,
      notificationsOffOutline,
      navigateOutline,
    });
  }

  ngOnInit() {
    this.contextService.selectedFarm$
      .pipe(takeUntil(this.destroy$))
      .subscribe((farm) => {
        if (farm) {
          const changed = this.farmId !== farm.id;
          this.farmId = farm.id;
          this.farmName = farm.name;
          if (changed) {
            this.cargarDatos();
          }
        }
      });

    this.contextService.userRole$
      .pipe(takeUntil(this.destroy$))
      .subscribe((role) => {
        this.userRole = role;
        this.cdr.detectChanges();
      });

    this.notificationService.incomingAlert$
      .pipe(takeUntil(this.destroy$))
      .subscribe((nueva) => {
        const enriquecida = this.enriquecerRelaciones(nueva);
        const idx = this.novedades.findIndex((n) => n.id === enriquecida.id);
        if (idx >= 0) {
          this.novedades[idx] = enriquecida;
        } else {
          this.novedades = [enriquecida, ...this.novedades];
        }
        this.notificationService.resetCount();
        this.aplicarFiltros();
      });
  }

  ionViewWillEnter() {
    this.notificationService.resetCount();
    if (this.farmId) {
      this.cargarDatos(false);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get cantidadFiltrosActivos(): number {
    let count = 0;
    if (this.filtroPrioridad !== 'Todas') count++;
    if (this.filtroEntidad !== 'Todas') count++;
    return count;
  }

  cargarDatos(mostrarSkeleton = true, refresherEvent?: any) {
    if (!this.farmId) {
      this.isLoading = false;
      this.errorMessage = 'Selecciona una finca primero para consultar las novedades.';
      if (refresherEvent) refresherEvent.target.complete();
      this.cdr.detectChanges();
      return;
    }

    if (mostrarSkeleton) {
      this.isLoading = true;
    }
    this.errorMessage = '';
    this.cdr.detectChanges();

    forkJoin({
      alerts: this.alertService.getAlertsByFarm(this.farmId),
      lots: this.lotService.getLotsByFarm(this.farmId).pipe(catchError(() => of([]))),
      crops: this.cropService.getCropsByFarm(this.farmId).pipe(catchError(() => of([]))),
      animals: this.animalService.getAnimalsByFarm(this.farmId).pipe(catchError(() => of([]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ alerts, lots, crops, animals }) => {
          this.lotesMap.clear();
          lots.forEach((l) => this.lotesMap.set(String(l.id), l.name));

          this.cultivosMap.clear();
          crops.forEach((c) =>
            this.cultivosMap.set(
              String(c.id),
              `${c.especie}${c.variedad ? ' (' + c.variedad + ')' : ''}`
            )
          );

          this.animalesMap.clear();
          animals.forEach((a) =>
            this.animalesMap.set(
              String(a.id),
              `Caravana ${a.caravanaVisual || a.caravanaSenasa || a.id.slice(0, 6)}`
            )
          );

          this.novedades = alerts.map((a) => this.enriquecerRelaciones(a));
          this.isLoading = false;
          this.aplicarFiltros();
          if (refresherEvent) refresherEvent.target.complete();
        },
        error: (err) => {
          console.error('Error al cargar novedades:', err);
          this.errorMessage = 'No se pudieron cargar las novedades de la finca.';
          this.isLoading = false;
          if (refresherEvent) refresherEvent.target.complete();
          this.cdr.detectChanges();
        },
      });
  }

  private enriquecerRelaciones(novedad: Novedad): Novedad {
    const relaciones = novedad.relaciones.map((rel) => {
      if (rel.tipo === 'Lote' && novedad.relatedLotId) {
        const nombreLote = this.lotesMap.get(String(novedad.relatedLotId));
        return { ...rel, nombre: nombreLote || rel.nombre };
      }
      if (rel.tipo === 'Cultivo' && novedad.relatedCropId) {
        const nombreCultivo = this.cultivosMap.get(String(novedad.relatedCropId));
        return { ...rel, nombre: nombreCultivo || rel.nombre };
      }
      if (rel.tipo === 'Animal' && novedad.relatedAnimalId) {
        const nombreAnimal = this.animalesMap.get(String(novedad.relatedAnimalId));
        return { ...rel, nombre: nombreAnimal || rel.nombre };
      }
      return rel;
    });
    return { ...novedad, relaciones };
  }

  onRefresh(event: any) {
    this.cargarDatos(false, event);
  }

  onSegmentChange() {
    this.aplicarFiltros();
  }

  aplicarFiltros() {
    const q = this.terminoBusqueda.trim().toLowerCase();

    this.novedadesFiltradas = this.novedades.filter((n) => {
      const coincideSegmento =
        this.segmentoActual === 'Todas' || n.tipo === this.segmentoActual;

      const coincidePrioridad =
        this.filtroPrioridad === 'Todas' || n.prioridad === this.filtroPrioridad;

      const coincideEntidad =
        this.filtroEntidad === 'Todas' ||
        n.relaciones.some((r) => r.tipo === this.filtroEntidad);

      const coincideTexto =
        !q ||
        n.titulo.toLowerCase().includes(q) ||
        n.descripcion.toLowerCase().includes(q) ||
        n.origen.toLowerCase().includes(q) ||
        n.relaciones.some((r) => r.nombre.toLowerCase().includes(q));

      return (
        coincideSegmento &&
        coincidePrioridad &&
        coincideEntidad &&
        coincideTexto
      );
    });

    this.cdr.detectChanges();
  }

  limpiarFiltros() {
    this.filtroPrioridad = 'Todas';
    this.filtroEntidad = 'Todas';
    this.terminoBusqueda = '';
    this.aplicarFiltros();
  }

  abrirModalFiltros() {
    this.isFilterModalOpen = true;
  }

  cerrarModalFiltros() {
    this.isFilterModalOpen = false;
  }

  verDetalle(novedad: Novedad) {
    this.router.navigate(['/novedades', novedad.id]);
  }

  irANuevaNovedad() {
    this.router.navigate(['/novedades/nueva']);
  }
}
