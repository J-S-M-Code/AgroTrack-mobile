import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AlertPriority,
  AlertType,
  Novedad,
  PrioridadLabel,
  RecordType,
  RelacionNovedad,
} from '../models/novedad.model';
import { OutboxAttachment } from '../models/sync.model';
import { OfflineStorageService } from './offline-storage.service';
import { NetworkService } from './network.service';
import { SyncService } from './sync.service';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private apiUrl = environment.apiUrl + '/alerts';
  private http = inject(HttpClient);
  private storage = inject(OfflineStorageService);
  private network = inject(NetworkService);
  private sync = inject(SyncService);

  getAlertsByFarm(farmId: string): Observable<Novedad[]> {
    if (!farmId) {
      return throwError(() => new Error('Farm ID is missing'));
    }
    const cacheKey = `alerts_${farmId}`;
    if (!this.network.isOnlineSnapshot) {
      return from(this.storage.getCache<Novedad[]>(cacheKey)).pipe(
        map((cached) => this.reviveDates(cached || []))
      );
    }

    return this.http.get<any[]>(`${this.apiUrl}/farm/${farmId}`).pipe(
      map((alerts) =>
        (alerts || [])
          .map((alert) => this.mapAlert(alert))
          .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      ),
      tap((mapped) => {
        void this.storage.setCache(cacheKey, mapped);
      }),
      catchError((err) =>
        from(this.storage.getCache<Novedad[]>(cacheKey)).pipe(
          switchMap((cached) =>
            cached ? of(this.reviveDates(cached)) : throwError(() => err)
          )
        )
      )
    );
  }

  getAlertById(id: string, farmId: string): Observable<Novedad> {
    if (!farmId) {
      return throwError(() => new Error('Farm ID is missing'));
    }
    const cacheKey = `alert_${id}`;
    if (!this.network.isOnlineSnapshot) {
      return from(this.getCachedAlertById(id, farmId)).pipe(
        switchMap((cached) =>
          cached
            ? of(cached)
            : throwError(() => new Error('Sin conexión ni novedad en caché'))
        )
      );
    }

    return this.http
      .get<any>(`${this.apiUrl}/${id}?farmId=${encodeURIComponent(farmId)}`)
      .pipe(
        map((alert) => this.mapAlert(alert)),
        tap((mapped) => {
          void this.storage.setCache(cacheKey, mapped);
        }),
        catchError((err) =>
          from(this.getCachedAlertById(id, farmId)).pipe(
            switchMap((cached) => (cached ? of(cached) : throwError(() => err)))
          )
        )
      );
  }

  private async getCachedAlertById(
    id: string,
    farmId: string
  ): Promise<Novedad | null> {
    const direct = await this.storage.getCache<Novedad>(`alert_${id}`);
    if (direct) return this.reviveDates([direct])[0];
    const list = await this.storage.getCache<Novedad[]>(`alerts_${farmId}`);
    const found = list?.find((a) => a.id === id);
    return found ? this.reviveDates([found])[0] : null;
  }

  private reviveDates(alerts: Novedad[]): Novedad[] {
    return alerts.map((a) => ({
      ...a,
      fecha: a.fecha ? new Date(a.fecha) : new Date(),
    }));
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

  createAlert(
    alertDto: any,
    farmId: string,
    offlineAttachments?: OutboxAttachment[]
  ): Observable<Novedad> {
    if (!this.network.isOnlineSnapshot) {
      return from(
        this.enqueueOfflineAlertCreate(alertDto, farmId, offlineAttachments)
      );
    }

    return this.http
      .post<any>(`${this.apiUrl}?farmId=${encodeURIComponent(farmId)}`, alertDto)
      .pipe(
        map((res) => this.mapAlert(res)),
        catchError((err) => {
          if ((err?.status ?? 0) === 0) {
            return from(
              this.enqueueOfflineAlertCreate(
                alertDto,
                farmId,
                offlineAttachments
              )
            );
          }
          return throwError(() => err);
        })
      );
  }

  private async enqueueOfflineAlertCreate(
    alertDto: any,
    farmId: string,
    attachments?: OutboxAttachment[]
  ): Promise<Novedad> {
    const tempId = `offline_alert_${Date.now()}`;
    const optimistic = this.mapAlert({
      ...alertDto,
      id: tempId,
      createdAt: new Date().toISOString(),
      images: attachments?.map((a) => a.dataUrl) || [],
    });

    const cacheKey = `alerts_${farmId}`;
    const current = (await this.storage.getCache<Novedad[]>(cacheKey)) || [];
    await this.storage.setCache(cacheKey, [optimistic, ...current]);
    await this.storage.setCache(`alert_${tempId}`, optimistic);

    await this.sync.enqueue({
      entity: 'ALERT',
      operation: 'CREATE',
      endpoint: `/alerts?farmId=${encodeURIComponent(farmId)}`,
      method: 'POST',
      payload: alertDto,
      attachments,
      farmId,
      description: `Nueva novedad: ${optimistic.titulo}`,
      localRefId: tempId,
    });

    return optimistic;
  }

  deleteAlert(id: string, farmId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}?farmId=${encodeURIComponent(farmId)}`
    );
  }
}
