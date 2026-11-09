import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AlertPriority,
  AlertType,
  Novedad,
  PrioridadLabel,
  RecordType,
  RelacionNovedad,
} from '../models/novedad.model';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private apiUrl = environment.apiUrl + '/alerts';

  constructor(private http: HttpClient) {}

  getAlertsByFarm(farmId: string): Observable<Novedad[]> {
    if (!farmId) {
      return throwError(() => new Error('Farm ID is missing'));
    }
    return this.http.get<any[]>(`${this.apiUrl}/farm/${farmId}`).pipe(
      map((alerts) =>
        (alerts || [])
          .map((alert) => this.mapAlert(alert))
          .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      )
    );
  }

  getAlertById(id: string, farmId: string): Observable<Novedad> {
    if (!farmId) {
      return throwError(() => new Error('Farm ID is missing'));
    }
    return this.http
      .get<any>(`${this.apiUrl}/${id}?farmId=${encodeURIComponent(farmId)}`)
      .pipe(map((alert) => this.mapAlert(alert)));
  }

  uploadAlertImage(
    blob: Blob,
    ext: 'jpg' | 'png' | 'webp',
    farmId: string,
    index = 0
  ): Observable<string> {
    if (!farmId) {
      return throwError(() => new Error('Farm ID is missing'));
    }
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const typedBlob = blob.type === mime ? blob : new Blob([blob], { type: mime });

    const formData = new FormData();
    formData.append('file', typedBlob, `evidencia_${index + 1}.${ext}`);

    return this.http
      .post<{ path: string }>(
        `${this.apiUrl}/images?farmId=${encodeURIComponent(farmId)}`,
        formData
      )
      .pipe(map((res) => res.path));
  }

  resolveImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    const trimmed = imagePath.trim();
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:')
    ) {
      return trimmed;
    }
    const baseUrl = environment.minioBaseUrl.endsWith('/')
      ? environment.minioBaseUrl
      : `${environment.minioBaseUrl}/`;
    const cleanPath = trimmed.startsWith('/') ? trimmed.substring(1) : trimmed;
    return `${baseUrl}${cleanPath}`;
  }

  mapAlert(alert: any): Novedad {
    const relaciones: RelacionNovedad[] = [];
    if (alert.relatedLotId) {
      relaciones.push({
        tipo: 'Lote',
        id: alert.relatedLotId,
        nombre: 'Lote Asociado',
        ruta: '/mapa',
        params: { lotId: alert.relatedLotId },
      });
    }
    if (alert.relatedCropId) {
      relaciones.push({
        tipo: 'Cultivo',
        id: alert.relatedCropId,
        nombre: 'Cultivo Asociado',
        ruta: `/cultivos/${alert.relatedCropId}`,
      });
    }
    if (alert.relatedAnimalId) {
      relaciones.push({
        tipo: 'Animal',
        id: alert.relatedAnimalId,
        nombre: 'Animal Asociado',
        ruta: '/novedades',
      });
    }

    const centroide: [number, number] | undefined =
      alert.centroid?.coordinates && alert.centroid.coordinates.length >= 2
        ? [alert.centroid.coordinates[1], alert.centroid.coordinates[0]]
        : undefined;

    const poligono: [number, number][] | undefined =
      alert.polygonLimit?.coordinates && alert.polygonLimit.coordinates[0]?.length > 0
        ? alert.polygonLimit.coordinates[0].map((c: any) => [c[1], c[0]] as [number, number])
        : undefined;

    const rawPriority: AlertPriority = alert.priority || 'MEDIUM';
    const rawRecordType: RecordType = alert.recordType === 'NOTE' ? 'NOTE' : 'ALERT';
    const rawAlertType: AlertType = alert.alertType || 'MANUAL_NOTE';
    const rawImages: string[] = (alert.images || []).filter((img: string) => !!img);

    return {
      id: alert.idAlert || alert.id,
      fecha: alert.createdAt ? new Date(alert.createdAt) : new Date(),
      tipo: rawRecordType === 'NOTE' ? 'Nota' : 'Alerta',
      prioridad: this.mapPriorityToLabel(rawPriority),
      rawRecordType,
      rawPriority,
      rawAlertType,
      origen: alert.authorName || 'Sistema',
      authorId: alert.authorId || undefined,
      titulo: alert.title || 'Sin título',
      descripcion: alert.description || 'Sin descripción',
      rawImages,
      imagenes: rawImages.map((img: string) => this.resolveImageUrl(img)),
      relatedLotId: alert.relatedLotId || undefined,
      relatedCropId: alert.relatedCropId || undefined,
      relatedAnimalId: alert.relatedAnimalId || undefined,
      poligono,
      centroide,
      relaciones,
    };
  }

  private mapPriorityToLabel(priority: AlertPriority | string): PrioridadLabel {
    switch (priority) {
      case 'CRITICAL':
        return 'Crítica';
      case 'HIGH':
        return 'Alta';
      case 'MEDIUM':
        return 'Media';
      case 'LOW':
      default:
        return 'Baja';
    }
  }

  createAlert(alertDto: any, farmId: string): Observable<Novedad> {
    return this.http
      .post<any>(`${this.apiUrl}?farmId=${encodeURIComponent(farmId)}`, alertDto)
      .pipe(map((res) => this.mapAlert(res)));
  }

  deleteAlert(id: string, farmId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}?farmId=${encodeURIComponent(farmId)}`
    );
  }
}
