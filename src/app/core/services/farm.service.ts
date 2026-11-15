import { environment } from '../../../environments/environment';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Finca } from '../models/finca.model';
import { OfflineStorageService } from './offline-storage.service';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root',
})
export class FarmService {
  private apiUrl = environment.apiUrl + '/farms';
  private http = inject(HttpClient);
  private storage = inject(OfflineStorageService);
  private network = inject(NetworkService);

  getFincas(): Observable<Finca[]> {
    const cacheKey = 'farms_list';
    if (!this.network.isOnlineSnapshot) {
      return from(this.storage.getCache<Finca[]>(cacheKey)).pipe(
        switchMap((cached) => (cached ? of(cached) : of([])))
      );
    }

    return this.http.get<any[]>(this.apiUrl).pipe(
      map((farms) => (farms || []).map((farm) => this.mapFarmToFinca(farm))),
      tap((fincas) => {
        void this.storage.setCache(cacheKey, fincas);
      }),
      catchError((err) =>
        from(this.storage.getCache<Finca[]>(cacheKey)).pipe(
          switchMap((cached) => (cached ? of(cached) : throwError(() => err)))
        )
      )
    );
  }

  getFincaById(id: string): Observable<Finca> {
    const cacheKey = `farm_${id}`;
    if (!this.network.isOnlineSnapshot) {
      return from(this.getCachedFarmById(id)).pipe(
        switchMap((cached) =>
          cached
            ? of(cached)
            : throwError(() => new Error('Sin conexión ni datos en caché'))
        )
      );
    }

    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map((farm) => this.mapFarmToFinca(farm)),
      tap((finca) => {
        void this.storage.setCache(cacheKey, finca);
      }),
      catchError((err) =>
        from(this.getCachedFarmById(id)).pipe(
          switchMap((cached) => (cached ? of(cached) : throwError(() => err)))
        )
      )
    );
  }

  createFarm(farm: any): Observable<Finca> {
    return this.http
      .post<any>(this.apiUrl, farm)
      .pipe(map((f) => this.mapFarmToFinca(f)));
  }

  updateFarm(id: string, farm: any): Observable<Finca> {
    return this.http
      .put<any>(`${this.apiUrl}/${id}`, farm)
      .pipe(map((f) => this.mapFarmToFinca(f)));
  }

  deleteFarm(id: string, reason: string): Observable<void> {
    return this.http.request<void>('delete', `${this.apiUrl}/${id}`, {
      body: { reason },
    });
  }

  private async getCachedFarmById(id: string): Promise<Finca | null> {
    const direct = await this.storage.getCache<Finca>(`farm_${id}`);
    if (direct) return direct;
    const list = await this.storage.getCache<Finca[]>('farms_list');
    return list?.find((f) => f.id === id) ?? null;
  }

  private mapFarmToFinca(farm: any): Finca {
    return {
      id: farm.idFarm || farm.id,
      name: farm.name,
      location: farm.address,
      lat: farm.centroid?.coordinates ? farm.centroid.coordinates[1] : undefined,
      lon: farm.centroid?.coordinates ? farm.centroid.coordinates[0] : undefined,
      polygon: farm.polygonLimit?.coordinates
        ? farm.polygonLimit.coordinates[0].map((c: any) => [c[1], c[0]])
        : [],
      imageUrl: farm.imageUrl,
      companyName: farm.companyName,
      cuit: farm.cuit,
      numberRENAPSA: farm.numberrenapsa,
      productiveOrientation: farm.productiveOrientation,
      surface: farm.surface,
      myRole: farm.myRole,
    };
  }
}
