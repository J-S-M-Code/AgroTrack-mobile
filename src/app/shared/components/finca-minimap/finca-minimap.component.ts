import { Component, Input, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { Finca } from '../../../core/models/finca.model';

@Component({
  selector: 'app-finca-minimap',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [id]="mapId" class="map-container"></div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      overflow: hidden;
    }
    .map-container {
      width: 100%;
      height: 140px;
      z-index: 1; /* Ionic z-index stacking */
      position: relative;
      overflow: hidden;
    }

    /* Custom Leaflet overrides for Ionic card */
    ::ng-deep .leaflet-control-attribution {
      display: none !important; /* Optionally hide attribution to keep it clean */
    }
  `]
})
export class FincaMinimapComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() finca!: Finca;
  
  private map: L.Map | undefined;
  mapId: string = 'minimap-' + Math.random().toString(36).substr(2, 9);

  ngOnInit() {
  }

  ngAfterViewInit() {
    this.initMap();
  }

  private initMap() {
    // Solo inicializar si hay latitud y longitud válidas
    if (!this.finca || this.finca.lat === undefined || this.finca.lon === undefined) {
      return;
    }

    this.map = L.map(this.mapId, {
      center: [this.finca.lat, this.finca.lon],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    }).addTo(this.map);

    // Ícono nativo para Leaflet simulando FontAwesome
    const icon = L.divIcon({
      className: 'minimap-marker',
      html: `<div style="
        background-color: #ef4444; 
        width: 16px; height: 16px; 
        border-radius: 50%; 
        border: 2px solid white; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    L.marker([this.finca.lat, this.finca.lon], { icon: icon }).addTo(this.map);

    // Dibujar polígono de la finca si existe
    if (this.finca.polygon && this.finca.polygon.length > 0) {
      try {
        L.polygon(this.finca.polygon as L.LatLngExpression[], {
          color: '#fbd350',
          weight: 2,
          opacity: 0.8,
          fillColor: '#fbd350',
          fillOpacity: 0.2
        }).addTo(this.map);
      } catch (e) {
        console.error('Error drawing polygon for minimap', e);
      }
    }
    
    // Invalidate size in case it renders small initially inside Ionic Card
    setTimeout(() => {
      this.map?.invalidateSize();
    }, 200);
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }
}
