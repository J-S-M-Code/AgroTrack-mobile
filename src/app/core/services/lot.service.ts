import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Lot } from '../models/lot.model';
import { OfflineStorageService } from './offline-storage.service';
import { NetworkService } from './network.service';
import { SyncService } from './sync.service';

@Injectable({
  providedIn: 'root',
})
export class LotService {
  private apiUrl = environment.apiUrl + '/lots';
  private http = inject(HttpClient);
  private storage = inject(OfflineStorageService);
  private network = inject(NetworkService);
  private sync = inject(SyncService);

  getLotsByFarm(farmId: string): Observable<Lot[]> {
    if (!farmId) return of([]);
    const cacheKey = `lots_${farmId}`;

    if (!this.network.isOnlineSnapshot) {
      return from(this.storage.getCache<Lot[]>(cacheKey)).pipe(
        map((cached) => cached || [])
      );
    }

    return this.http.get<any[]>(`${this.apiUrl}/farm/${farmId}`).pipe(
      map((lots) => (lots || []).map((lot) => this.mapLot(lot))),
      tap((mapped) => {
        void this.storage.setCache(cacheKey, mapped);
      }),
      catchError((err) =>
        from(this.storage.getCache<Lot[]>(cacheKey)).pipe(
          switchMap((cached) => (cached ? of(cached) : throwError(() => err)))
        )
      )
    );
  }

  createLot(farmId: string, lotDto: any): Observable<Lot> {
    if (!this.network.isOnlineSnapshot) {
      return from(this.enqueueOfflineLot(farmId, lotDto));
    }

    return this.http.post<any>(`${this.apiUrl}/farm/${farmId}`, lotDto).pipe(
      map((lot) => this.mapLot(lot)),
      catchError((err) => {
        if ((err?.status ?? 0) === 0) {
          return from(this.enqueueOfflineLot(farmId, lotDto));
        }
        return throwError(() => err);
      })
    );
  }

  private async enqueueOfflineLot(farmId: string, lotDto: any): Promise<Lot> {
    const tempId = `offline_lot_${Date.now()}`;
    const optimistic: Lot = {
      id: tempId,
      farmId,
      name: lotDto.name || 'Lote (Pendiente)',
      area: lotDto.hectares || 0,
      hectares: lotDto.hectares || 0,
      type: lotDto.type,
      soilType: lotDto.soilType,
      description: lotDto.description,
      state: lotDto.state || 'AVAILABLE',
      polygon: lotDto.polygonLimit?.coordinates
        ? lotDto.polygonLimit.coordinates[0].map((c: any) => [c[1], c[0]])
        : [],
    };

    const cacheKey = `lots_${farmId}`;
    const current = (await this.storage.getCache<Lot[]>(cacheKey)) || [];
    await this.storage.setCache(cacheKey, [optimistic, ...current]);

    await this.sync.enqueue({
      entity: 'LOT',
      operation: 'CREATE',
      endpoint: `/lots/farm/${encodeURIComponent(farmId)}`,
      method: 'POST',
      payload: lotDto,
      farmId,
      description: `Nuevo lote: ${optimistic.name}`,
      localRefId: tempId,
    });

    return optimistic;
  }

  private mapLot(lot: any): Lot {
    return {
      id: lot.id,
      farmId: lot.farmId,
      name: lot.name,
      area: lot.hectares,
      hectares: lot.hectares,
      type: lot.type,
      soilType: lot.soilType,
      description: lot.description,
      state: lot.state,
      // Map standard GeoJSON Polygon format to an array of [lat, lng] arrays for Leaflet
      polygon: lot.polygonLimit?.coordinates
        ? lot.polygonLimit.coordinates[0].map((c: any) => [c[1], c[0]])
        : [],
    };
  }
}
