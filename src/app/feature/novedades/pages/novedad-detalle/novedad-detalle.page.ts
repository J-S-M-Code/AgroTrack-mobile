import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin, of, takeUntil, catchError } from 'rxjs';
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
  ToastController,
  ViewDidEnter,
  ViewWillLeave,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  trashOutline,
  warningOutline,
  documentTextOutline,
  timeOutline,
  personOutline,
  linkOutline,
  locationOutline,
  leafOutline,
  pawOutline,
  chevronForwardOutline,
  imagesOutline,
  expandOutline,
  mapOutline,
  navigateOutline,
  close,
  closeOutline,
  chevronBackOutline,
  refreshOutline,
} from 'ionicons/icons';
import * as L from 'leaflet';

import { AlertService } from '../../../../core/services/alert.service';
import { ContextService } from '../../../../core/services/context.service';
import { LotService } from '../../../../core/services/lot.service';
import { CropService } from '../../../../core/services/crop.service';
import { AnimalService } from '../../../../core/services/animal.service';
import { Novedad, RelacionNovedad } from '../../../../core/models/novedad.model';

@Component({
  selector: 'app-novedad-detalle',
  templateUrl: './novedad-detalle.page.html',
  styleUrls: ['./novedad-detalle.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
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
  ],
})
export class NovedadDetallePage implements OnInit, OnDestroy, ViewDidEnter, ViewWillLeave {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private contextService = inject(ContextService);
  private lotService = inject(LotService);
  private cropService = inject(CropService);
  private animalService = inject(AnimalService);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();

  novedadId = '';
  farmId = '';
  userRole = '';

  novedad: Novedad | null = null;
  isLoading = true;
  errorMessage = '';

  // Visor de fotos modal
  isImageViewerOpen = false;
  imagenActivaIndex = 0;

  // Eliminación
  isDeleteModalOpen = false;
  isDeleting = false;
  deleteError = '';

  // Mapa Leaflet
  private mapaDetalle?: L.Map;

  constructor() {
    addIcons({
      trashOutline,
      warningOutline,
      documentTextOutline,
      timeOutline,
      personOutline,
      linkOutline,
      locationOutline,
      leafOutline,
      pawOutline,
      chevronForwardOutline,
      imagesOutline,
      expandOutline,
      mapOutline,
      navigateOutline,
      close,
  closeOutline,
      chevronBackOutline,
      refreshOutline,
    });
  }

  ngOnInit() {
    this.novedadId = this.route.snapshot.paramMap.get('id') || '';

    this.contextService.userRole$
      .pipe(takeUntil(this.destroy$))
      .subscribe((role) => {
        this.userRole = role;
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
  }

  ionViewDidEnter() {
    setTimeout(() => {
      if (this.mapaDetalle) {
        this.mapaDetalle.invalidateSize();
      } else if (this.novedad && this.tieneGeometria) {
        this.inicializarMapa();
      }
    }, 200);
  }

  ionViewWillLeave() {
    this.isImageViewerOpen = false;
    this.isDeleteModalOpen = false;
  }

  ngOnDestroy() {
    this.destruirMapa();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get puedeEliminar(): boolean {
    return this.userRole === 'OWNER' || this.userRole === 'FOREMAN';
  }

  get tieneGeometria(): boolean {
    if (!this.novedad) return false;
    return (
      (!!this.novedad.poligono && this.novedad.poligono.length > 0) ||
      !!this.novedad.centroide
    );
  }

  cargarDetalle(refresherEvent?: any) {
    if (!this.novedadId || !this.farmId) {
      this.isLoading = false;
      this.errorMessage = 'No se pudo identificar la novedad o la finca activa.';
      if (refresherEvent) refresherEvent.target.complete();
      this.cdr.detectChanges();
      return;
    }

    if (!refresherEvent) {
      this.isLoading = true;
    }
    this.errorMessage = '';
    this.cdr.detectChanges();

    forkJoin({
      alert: this.alertService.getAlertById(this.novedadId, this.farmId),
      lots: this.lotService.getLotsByFarm(this.farmId).pipe(catchError(() => of([]))),
      crops: this.cropService.getCropsByFarm(this.farmId).pipe(catchError(() => of([]))),
      animals: this.animalService.getAnimalsByFarm(this.farmId).pipe(catchError(() => of([]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ alert, lots, crops, animals }) => {
          const relaciones = alert.relaciones.map((rel) => {
            if (rel.tipo === 'Lote' && alert.relatedLotId) {
              const lote = lots.find((l) => String(l.id) === String(alert.relatedLotId));
              return lote ? { ...rel, nombre: `${lote.name} (${lote.area} ha)` } : rel;
            }
            if (rel.tipo === 'Cultivo' && alert.relatedCropId) {
              const cultivo = crops.find((c) => String(c.id) === String(alert.relatedCropId));
              return cultivo
                ? {
                    ...rel,
                    nombre: `${cultivo.especie} (${cultivo.variedad}) — ${cultivo.lote}`,
                  }
                : rel;
            }
            if (rel.tipo === 'Animal' && alert.relatedAnimalId) {
              const animal = animals.find((a) => String(a.id) === String(alert.relatedAnimalId));
              return animal
                ? {
                    ...rel,
                    nombre: `Caravana ${animal.caravanaVisual || animal.caravanaSenasa} (${animal.categoria})`,
                  }
                : rel;
            }
            return rel;
          });

          this.novedad = { ...alert, relaciones };
          this.isLoading = false;
          if (refresherEvent) refresherEvent.target.complete();
          this.cdr.detectChanges();

          if (this.tieneGeometria) {
            setTimeout(() => this.inicializarMapa(), 180);
          }
        },
        error: (err) => {
          console.error('Error al cargar detalle de novedad:', err);
          this.errorMessage = 'No se pudo cargar la información de la novedad.';
          this.isLoading = false;
          if (refresherEvent) refresherEvent.target.complete();
          this.cdr.detectChanges();
        },
      });
  }

  onRefresh(event: any) {
    this.cargarDetalle(event);
  }

  navegarARelacion(rel: RelacionNovedad) {
    if (rel.tipo === 'Cultivo' && rel.id) {
      this.router.navigate(['/cultivos', rel.id]);
    } else if (rel.tipo === 'Lote') {
      this.router.navigate(['/mapa'], {
        queryParams: rel.id ? { lotId: rel.id } : undefined,
      });
    }
  }

  abrirVisorImagen(index: number) {
    this.imagenActivaIndex = index;
    this.isImageViewerOpen = true;
  }

  cerrarVisorImagen() {
    this.isImageViewerOpen = false;
  }

  imagenAnterior() {
    if (!this.novedad) return;
    this.imagenActivaIndex =
      (this.imagenActivaIndex - 1 + this.novedad.imagenes.length) %
      this.novedad.imagenes.length;
  }

  imagenSiguiente() {
    if (!this.novedad) return;
    this.imagenActivaIndex =
      (this.imagenActivaIndex + 1) % this.novedad.imagenes.length;
  }

  abrirModalEliminar() {
    this.deleteError = '';
    this.isDeleteModalOpen = true;
  }

  cerrarModalEliminar() {
    this.isDeleteModalOpen = false;
    this.deleteError = '';
  }

  confirmarEliminacion() {
    if (!this.novedad || !this.farmId || this.isDeleting) return;

    this.isDeleting = true;
    this.deleteError = '';

    this.alertService
      .deleteAlert(this.novedad.id, this.farmId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async () => {
          this.isDeleting = false;
          this.isDeleteModalOpen = false;
          const toast = await this.toastCtrl.create({
            message: 'Novedad eliminada correctamente.',
            duration: 2200,
            color: 'success',
            position: 'bottom',
          });
          await toast.present();
          this.router.navigate(['/novedades'], { replaceUrl: true });
        },
        error: (err) => {
          console.error('Error al eliminar novedad:', err);
          this.isDeleting = false;
          this.deleteError =
            err?.error?.error || 'Ocurrió un error al intentar eliminar la novedad.';
          this.cdr.detectChanges();
        },
      });
  }

  private destruirMapa() {
    if (this.mapaDetalle) {
      this.mapaDetalle.remove();
      this.mapaDetalle = undefined;
    }
  }

  private inicializarMapa() {
    const container = document.getElementById('mapa-novedad-detalle');
    if (!container || !this.novedad) return;

    this.destruirMapa();

    this.mapaDetalle = L.map('mapa-novedad-detalle', {
      zoomControl: false,
      attributionControl: false,
    }).setView([-29.161, -67.4983], 14);

    L.control.zoom({ position: 'topright' }).addTo(this.mapaDetalle);

    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
    }).addTo(this.mapaDetalle);

    const esAlerta = this.novedad.tipo === 'Alerta';
    const colorPoligono = esAlerta ? '#ef4444' : '#0d8a5c';

    let polyLayer: L.Polygon | undefined;
    if (this.novedad.poligono && this.novedad.poligono.length > 0) {
      polyLayer = L.polygon(this.novedad.poligono, {
        color: colorPoligono,
        weight: 2.5,
        fillColor: colorPoligono,
        fillOpacity: 0.28,
      }).addTo(this.mapaDetalle);
    }

    if (this.novedad.centroide) {
      const [lat, lng] = this.novedad.centroide;
      const pinIcon = L.divIcon({
        className: 'gps-pin-marker',
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${colorPoligono};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.45);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      L.marker([lat, lng], { icon: pinIcon })
        .addTo(this.mapaDetalle)
        .bindPopup(
          `<strong>Ubicación GPS</strong><br/>Lat: ${lat.toFixed(5)}<br/>Lng: ${lng.toFixed(5)}`
        );
    }

    if (polyLayer) {
      this.mapaDetalle.fitBounds(polyLayer.getBounds(), { padding: [24, 24] });
    } else if (this.novedad.centroide) {
      this.mapaDetalle.setView(this.novedad.centroide, 17);
    }

    setTimeout(() => this.mapaDetalle?.invalidateSize(), 150);
  }
}
