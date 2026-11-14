import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
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
  clipboardOutline,
  constructOutline,
  flaskOutline,
  bugOutline,
  leafOutline,
  waterOutline,
  cutOutline,
  cameraOutline,
  locationOutline,
  calendarOutline,
  personOutline,
  chevronForwardOutline,
  closeCircle,
  refreshOutline,
  checkmarkDoneCircleOutline,
  timeOutline,
  navigateOutline,
  warningOutline,
} from 'ionicons/icons';

import { TaskService } from '../../core/services/task.service';
import { ContextService } from '../../core/services/context.service';
import { NotificationService } from '../../core/services/notification.service';
import { LotService } from '../../core/services/lot.service';
import { AuthService } from '../../core/auth/services/auth.service';
import {
  ACCION_TYPE_OPTIONS,
  AccionType,
  EstadoTareaLabel,
  PrioridadTareaLabel,
  Tarea,
} from '../../core/models/tarea.model';

@Component({
  selector: 'app-tareas',
  templateUrl: './tareas.page.html',
  styleUrls: ['./tareas.page.scss'],
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
export class TareasPage implements OnInit, OnDestroy, ViewWillEnter {
  private taskService = inject(TaskService);
  private contextService = inject(ContextService);
  private notificationService = inject(NotificationService);
  private lotService = inject(LotService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  farmId = '';
  farmName = '';
  userRole = '';
  currentUserId: string | null = null;

  tareas: Tarea[] = [];
  tareasFiltradas: Tarea[] = [];

  private lotesMap = new Map<string, string>();

  segmentoActual: 'Todas' | EstadoTareaLabel = 'Pendientes';
  terminoBusqueda = '';
  filtroPrioridad: 'Todas' | PrioridadTareaLabel = 'Todas';
  filtroAccion: 'Todas' | AccionType = 'Todas';

  prioridadesDisponibles: PrioridadTareaLabel[] = ['Alta', 'Media', 'Baja'];
  accionesDisponibles = ACCION_TYPE_OPTIONS;

  isFilterModalOpen = false;
  isLoading = true;
  errorMessage = '';

  constructor() {
    addIcons({
      funnelOutline,
      addOutline,
      clipboardOutline,
      constructOutline,
      flaskOutline,
      bugOutline,
      leafOutline,
      waterOutline,
      cutOutline,
      cameraOutline,
      locationOutline,
      calendarOutline,
      personOutline,
      chevronForwardOutline,
      closeCircle,
      refreshOutline,
      checkmarkDoneCircleOutline,
      timeOutline,
      navigateOutline,
      warningOutline,
    });
  }

  get canCreateTask(): boolean {
    return ['OWNER', 'FOREMAN', 'AGRONOMIST', 'VETERINARIAN'].includes(
      this.userRole
    );
  }

  get cantidadFiltrosActivos(): number {
    let count = 0;
    if (this.filtroPrioridad !== 'Todas') count++;
    if (this.filtroAccion !== 'Todas') count++;
    return count;
  }

  async ngOnInit() {
    this.currentUserId = await this.authService.getUserId();

    this.contextService.userRole$
      .pipe(takeUntil(this.destroy$))
      .subscribe((role) => {
        const changed = this.userRole !== role;
        this.userRole = role || '';
        if (changed && this.farmId) {
          this.cargarDatos(false);
        }
        this.cdr.detectChanges();
      });

    this.contextService.selectedFarm$
      .pipe(takeUntil(this.destroy$))
      .subscribe((farm) => {
        if (farm) {
          const changed = this.farmId !== farm.id;
          this.farmId = farm.id;
          this.farmName = farm.name;
          if (changed) {
            this.cargarDatos(true);
          }
        }
      });

    this.notificationService.incomingTask$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (tareaEntrante) => {
        if (
          tareaEntrante.fincaId &&
          String(tareaEntrante.fincaId) !== String(this.farmId)
        ) {
          return;
        }
        if (!this.currentUserId) {
          this.currentUserId = await this.authService.getUserId();
        }
        const isManager =
          this.userRole === 'OWNER' || this.userRole === 'FOREMAN';
        const isAssignedToMe =
          !!this.currentUserId &&
          String(tareaEntrante.responsableId) === String(this.currentUserId);

        if (!isManager && !isAssignedToMe) {
          return;
        }

        const enriquecida = this.enriquecerLote(tareaEntrante);
        const idx = this.tareas.findIndex((t) => t.id === enriquecida.id);
        if (idx >= 0) {
          this.tareas[idx] = enriquecida;
        } else {
          this.tareas = [enriquecida, ...this.tareas];
        }
        this.notificationService.resetTasksCount();
        this.aplicarFiltros();
      });
  }

  ionViewWillEnter() {
    this.notificationService.resetTasksCount();
    if (this.farmId) {
      this.cargarDatos(false);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarDatos(mostrarSkeleton = true, refresherEvent?: any) {
    if (!this.farmId) {
      this.isLoading = false;
      this.errorMessage =
        'Selecciona una finca primero para consultar las tareas operativas.';
      refresherEvent?.target?.complete();
      this.cdr.detectChanges();
      return;
    }

    if (mostrarSkeleton) {
      this.isLoading = true;
    }
    this.errorMessage = '';
    this.cdr.detectChanges();

    forkJoin({
      tasks: this.taskService.getTasksForCurrentContext(
        this.farmId,
        this.userRole
      ),
      lots: this.lotService
        .getLotsByFarm(this.farmId)
        .pipe(catchError(() => of([]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ tasks, lots }) => {
          this.lotesMap.clear();
          lots.forEach((l) => this.lotesMap.set(String(l.id), l.name));

          this.tareas = tasks.map((t) => this.enriquecerLote(t));
          this.isLoading = false;
          this.aplicarFiltros();
          refresherEvent?.target?.complete();
        },
        error: (err) => {
          console.error('Error al cargar tareas:', err);
          this.errorMessage =
            'No se pudieron cargar las tareas operativas de la finca.';
          this.isLoading = false;
          refresherEvent?.target?.complete();
          this.cdr.detectChanges();
        },
      });
  }

  private enriquecerLote(tarea: Tarea): Tarea {
    if (tarea.loteId) {
      const nombreLote = this.lotesMap.get(String(tarea.loteId));
      if (nombreLote) {
        return { ...tarea, lote: nombreLote };
      }
    }
    return tarea;
  }

  onRefresh(event: any) {
    this.cargarDatos(false, event);
  }

  onSegmentChange() {
    this.aplicarFiltros();
  }

  aplicarFiltros() {
    const q = this.terminoBusqueda.trim().toLowerCase();

    this.tareasFiltradas = this.tareas.filter((t) => {
      const coincideSegmento =
        this.segmentoActual === 'Todas' || t.estado === this.segmentoActual;

      const coincidePrioridad =
        this.filtroPrioridad === 'Todas' ||
        t.prioridad === this.filtroPrioridad;

      const coincideAccion =
        this.filtroAccion === 'Todas' || t.accionType === this.filtroAccion;

      const coincideTexto =
        !q ||
        t.titulo.toLowerCase().includes(q) ||
        t.descripcion.toLowerCase().includes(q) ||
        t.responsable.toLowerCase().includes(q) ||
        t.accionLabel.toLowerCase().includes(q) ||
        (t.lote && t.lote.toLowerCase().includes(q));

      return (
        coincideSegmento &&
        coincidePrioridad &&
        coincideAccion &&
        coincideTexto
      );
    });

    this.cdr.detectChanges();
  }

  esVencida(tarea: Tarea): boolean {
    if (tarea.rawStatus === 'FINISH') return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const venc = new Date(tarea.fechaVencimiento);
    venc.setHours(0, 0, 0, 0);
    return venc.getTime() < hoy.getTime();
  }

  totalFotos(tarea: Tarea): number {
    return (tarea.imagenes?.length || 0) + (tarea.imagenesCierre?.length || 0);
  }

  getAccionLabel(type: string): string {
    return (
      ACCION_TYPE_OPTIONS.find((a) => a.value === type)?.label || type
    );
  }

  limpiarFiltros() {
    this.filtroPrioridad = 'Todas';
    this.filtroAccion = 'Todas';
    this.terminoBusqueda = '';
    this.aplicarFiltros();
  }

  abrirModalFiltros() {
    this.isFilterModalOpen = true;
  }

  cerrarModalFiltros() {
    this.isFilterModalOpen = false;
  }

  verDetalle(tarea: Tarea) {
    this.router.navigate(['/tareas', tarea.id]);
  }

  irANuevaTarea() {
    this.router.navigate(['/tareas/nueva']);
  }
}
