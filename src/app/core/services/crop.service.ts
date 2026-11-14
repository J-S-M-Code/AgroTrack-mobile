import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin, from, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Cultivo,
  CropUpsertDto,
  PhenologicalState,
  PHENOLOGICAL_STATE_LABELS,
  TypeCrop,
  TYPE_CROP_LABELS,
} from '../models/cultivo.model';
import { OfflineStorageService } from './offline-storage.service';
import { NetworkService } from './network.service';
import { SyncService } from './sync.service';

@Injectable({
  providedIn: 'root',
})
export class CropService {
  private apiUrl = environment.apiUrl + '/crops';
  private lotsUrl = environment.apiUrl + '/lots';
  private http = inject(HttpClient);
  private storage = inject(OfflineStorageService);
  private network = inject(NetworkService);
  private sync = inject(SyncService);

  getCropsByFarm(farmId: string): Observable<Cultivo[]> {
    if (!farmId) return of([]);
    const cacheKey = `crops_${farmId}`;

    if (!this.network.isOnlineSnapshot) {
      return from(this.storage.getCache<Cultivo[]>(cacheKey)).pipe(
        map((cached) => this.reviveDates(cached || []))
      );
    }

    return this.http.get<any[]>(`${this.apiUrl}/farm/${farmId}`).pipe(
      map((crops) => (crops || []).map((crop) => this.mapCrop(crop))),
      tap((mapped) => {
        void this.storage.setCache(cacheKey, mapped);
      }),
      catchError((err) =>
        from(this.storage.getCache<Cultivo[]>(cacheKey)).pipe(
          switchMap((cached) =>
            cached ? of(this.reviveDates(cached)) : throwError(() => err)
          )
        )
      )
    );
  }

  getAllCropsForAllFarms(farmIds: string[]): Observable<Cultivo[]> {
    if (!farmIds || farmIds.length === 0) return of([]);
    const requests = farmIds.map((id) => this.getCropsByFarm(id));
    return forkJoin(requests).pipe(
      map((results) => results.reduce((acc, curr) => acc.concat(curr), []))
    );
  }

  getUnassignedCrops(): Observable<Cultivo[]> {
    const cacheKey = 'crops_unassigned';
    if (!this.network.isOnlineSnapshot) {
      return from(this.storage.getCache<Cultivo[]>(cacheKey)).pipe(
        map((cached) => this.reviveDates(cached || []))
      );
    }
    return this.http.get<any[]>(`${this.apiUrl}/unassigned`).pipe(
      map((crops) => (crops || []).map((crop) => this.mapCrop(crop))),
      tap((mapped) => {
        void this.storage.setCache(cacheKey, mapped);
      }),
      catchError((err) =>
        from(this.storage.getCache<Cultivo[]>(cacheKey)).pipe(
          switchMap((cached) =>
            cached ? of(this.reviveDates(cached)) : throwError(() => err)
          )
        )
      )
    );
  }

  getCropById(id: string, farmId: string): Observable<Cultivo> {
    const cacheKey = `crop_${id}`;
    if (!this.network.isOnlineSnapshot) {
      return from(this.getCachedCropById(id, farmId)).pipe(
        switchMap((cached) =>
          cached
            ? of(cached)
            : throwError(() => new Error('Sin conexión ni datos en caché'))
        )
      );
    }

    return this.http
      .get<any>(`${this.apiUrl}/${id}?farmId=${encodeURIComponent(farmId)}`)
      .pipe(
        map((crop) => this.mapCrop(crop)),
        tap((mapped) => {
          void this.storage.setCache(cacheKey, mapped);
        }),
        catchError((err) =>
          from(this.getCachedCropById(id, farmId)).pipe(
            switchMap((cached) => (cached ? of(cached) : throwError(() => err)))
          )
        )
      );
  }

  registerCrop(
    lotId: string,
    crop: CropUpsertDto,
    farmId: string
  ): Observable<Cultivo> {
    if (!this.network.isOnlineSnapshot) {
      return from(this.enqueueOfflineRegister(lotId, crop, farmId));
    }
    return this.http
      .post<any>(
        `${this.lotsUrl}/${encodeURIComponent(lotId)}/crops?farmId=${encodeURIComponent(farmId)}`,
        crop
      )
      .pipe(
        map((created) => this.mapCrop(created)),
        catchError((err) => {
          if ((err?.status ?? 0) === 0) {
            return from(this.enqueueOfflineRegister(lotId, crop, farmId));
          }
          return throwError(() => err);
        })
      );
  }

  updateCrop(
    id: string,
    crop: CropUpsertDto,
    farmId: string
  ): Observable<Cultivo> {
    if (!this.network.isOnlineSnapshot) {
      return from(this.enqueueOfflineUpdate(id, crop, farmId));
    }
    return this.http
      .put<any>(
        `${this.apiUrl}/${encodeURIComponent(id)}?farmId=${encodeURIComponent(farmId)}`,
        crop
      )
      .pipe(
        map((updated) => this.mapCrop(updated)),
        catchError((err) => {
          if ((err?.status ?? 0) === 0) {
            return from(this.enqueueOfflineUpdate(id, crop, farmId));
          }
          return throwError(() => err);
        })
      );
  }

  updatePhenologicalState(
    id: string,
    state: PhenologicalState,
    farmId: string
  ): Observable<void> {
    const endpoint = `/crops/${encodeURIComponent(id)}/phenological-state?state=${encodeURIComponent(state)}&farmId=${encodeURIComponent(farmId)}`;
    if (!this.network.isOnlineSnapshot) {
      return from(
        this.enqueueOfflineStateChange(id, state, farmId, endpoint)
      );
    }
    return this.http.put<void>(`${environment.apiUrl}${endpoint}`, {}).pipe(
      catchError((err) => {
        if ((err?.status ?? 0) === 0) {
          return from(
            this.enqueueOfflineStateChange(id, state, farmId, endpoint)
          );
        }
        return throwError(() => err);
      })
    );
  }

  registerHarvest(
    id: string,
    farmId: string,
    actualHarvestDate: string
  ): Observable<void> {
    const formattedDate = actualHarvestDate.includes('T')
      ? actualHarvestDate
      : `${actualHarvestDate}T00:00:00`;
    const endpoint = `/crops/${encodeURIComponent(id)}/harvest?farmId=${encodeURIComponent(farmId)}&actualHarvestDate=${encodeURIComponent(formattedDate)}`;

    if (!this.network.isOnlineSnapshot) {
      return from(this.enqueueOfflineHarvest(id, farmId, endpoint));
    }
    return this.http.post<void>(`${environment.apiUrl}${endpoint}`, {}).pipe(
      catchError((err) => {
        if ((err?.status ?? 0) === 0) {
          return from(this.enqueueOfflineHarvest(id, farmId, endpoint));
        }
        return throwError(() => err);
      })
    );
  }

  deleteCrop(id: string, farmId: string, reason?: string): Observable<void> {
    let url = `${this.apiUrl}/${encodeURIComponent(id)}?farmId=${encodeURIComponent(farmId)}`;
    if (reason) {
      url += `&reason=${encodeURIComponent(reason)}`;
    }
    return this.http.delete<void>(url);
  }

  private async getCachedCropById(
    id: string,
    farmId: string
  ): Promise<Cultivo | null> {
    const direct = await this.storage.getCache<Cultivo>(`crop_${id}`);
    if (direct) return this.reviveDates([direct])[0];
    const list = await this.storage.getCache<Cultivo[]>(`crops_${farmId}`);
    const found = list?.find((c) => c.id === id);
    return found ? this.reviveDates([found])[0] : null;
  }

  private reviveDates(crops: Cultivo[]): Cultivo[] {
    return crops.map((c) => ({
      ...c,
      fechaPlantacion: c.fechaPlantacion
        ? new Date(c.fechaPlantacion)
        : new Date(),
      fechaCosecha: c.fechaCosecha ? new Date(c.fechaCosecha) : new Date(),
    }));
  }

  private async enqueueOfflineRegister(
    lotId: string,
    crop: CropUpsertDto,
    farmId: string
  ): Promise<Cultivo> {
    const tempId = `offline_crop_${Date.now()}`;
    const optimistic = this.mapCrop({
      ...crop,
      id: tempId,
      farmId,
      lotId,
    });
    const list =
      (await this.storage.getCache<Cultivo[]>(`crops_${farmId}`)) || [];
    await this.storage.setCache(`crops_${farmId}`, [optimistic, ...list]);
    await this.storage.setCache(`crop_${tempId}`, optimistic);

    await this.sync.enqueue({
      entity: 'CROP',
      operation: 'CREATE',
      endpoint: `/lots/${encodeURIComponent(lotId)}/crops?farmId=${encodeURIComponent(farmId)}`,
      method: 'POST',
      payload: crop,
      farmId,
      description: `Nuevo cultivo: ${optimistic.especie || 'Cultivo'}`,
      localRefId: tempId,
    });

    return optimistic;
  }

  private async enqueueOfflineUpdate(
    id: string,
    crop: CropUpsertDto,
    farmId: string
  ): Promise<Cultivo> {
    const optimistic = this.mapCrop({ ...crop, id, farmId });
    const list =
      (await this.storage.getCache<Cultivo[]>(`crops_${farmId}`)) || [];
    const updatedList = list.map((c) =>
      c.id === id ? { ...c, ...optimistic } : c
    );
    await this.storage.setCache(`crops_${farmId}`, updatedList);
    await this.storage.setCache(`crop_${id}`, optimistic);

    await this.sync.enqueue({
      entity: 'CROP',
      operation: 'UPDATE',
      endpoint: `/crops/${encodeURIComponent(id)}?farmId=${encodeURIComponent(farmId)}`,
      method: 'PUT',
      payload: crop,
      farmId,
      description: `Actualización de cultivo: ${optimistic.especie || id}`,
    });

    return optimistic;
  }

  private async enqueueOfflineStateChange(
    id: string,
    state: PhenologicalState,
    farmId: string,
    endpoint: string
  ): Promise<void> {
    const list =
      (await this.storage.getCache<Cultivo[]>(`crops_${farmId}`)) || [];
    const updatedList = list.map((c) =>
      c.id === id
        ? {
            ...c,
            phenologicalState: state,
            estado: PHENOLOGICAL_STATE_LABELS[state],
          }
        : c
    );
    await this.storage.setCache(`crops_${farmId}`, updatedList);

    const directCrop = await this.storage.getCache<Cultivo>(`crop_${id}`);
    const existing = directCrop || list.find((c) => c.id === id);
    if (existing) {
      await this.storage.setCache(`crop_${id}`, {
        ...existing,
        phenologicalState: state,
        estado: PHENOLOGICAL_STATE_LABELS[state],
      });
    }

    await this.sync.enqueue({
      entity: 'CROP',
      operation: 'STATUS_CHANGE',
      endpoint,
      method: 'PUT',
      payload: {},
      farmId,
      description: `Cambio fenológico a ${PHENOLOGICAL_STATE_LABELS[state]}`,
    });
  }

  private async enqueueOfflineHarvest(
    id: string,
    farmId: string,
    endpoint: string
  ): Promise<void> {
    const list =
      (await this.storage.getCache<Cultivo[]>(`crops_${farmId}`)) || [];
    const updatedList = list.map((c) =>
      c.id === id
        ? {
            ...c,
            phenologicalState: 'HARVESTED' as PhenologicalState,
            estado: PHENOLOGICAL_STATE_LABELS['HARVESTED'],
          }
        : c
    );
    await this.storage.setCache(`crops_${farmId}`, updatedList);

    const directCrop = await this.storage.getCache<Cultivo>(`crop_${id}`);
    const existing = directCrop || list.find((c) => c.id === id);
    if (existing) {
      await this.storage.setCache(`crop_${id}`, {
        ...existing,
        phenologicalState: 'HARVESTED' as PhenologicalState,
        estado: PHENOLOGICAL_STATE_LABELS['HARVESTED'],
      });
    }

    await this.sync.enqueue({
      entity: 'CROP',
      operation: 'STATUS_CHANGE',
      endpoint,
      method: 'POST',
      payload: {},
      farmId,
      description: `Registro de cosecha de cultivo`,
    });
  }

  private normalizePhenologicalState(rawState?: string): PhenologicalState {
    if (rawState && rawState in PHENOLOGICAL_STATE_LABELS) {
      return rawState as PhenologicalState;
    }
    // Soporte inverso por si llega traducido
    const entry = Object.entries(PHENOLOGICAL_STATE_LABELS).find(
      ([, label]) => label === rawState
    );
    return (entry?.[0] as PhenologicalState) || 'VEGETATIVE_GROWTH';
  }

  private normalizeTypeCrop(rawType?: string): TypeCrop {
    if (rawType && rawType in TYPE_CROP_LABELS) {
      return rawType as TypeCrop;
    }
    return 'FRUIT';
  }

  private mapCrop(crop: any): Cultivo {
    const phenologicalState = this.normalizePhenologicalState(
      crop.phenologicalState || crop.estado
    );
    const typeCrop = this.normalizeTypeCrop(crop.typeCrop);

    return {
      id: crop.idCrop || crop.id || '',
      fincaId: crop.farmId || '',
      fincaNombre: crop.farmName || '',
      typeCrop,
      tipoCultivoLabel: TYPE_CROP_LABELS[typeCrop],
      phenologicalState,
      estado: PHENOLOGICAL_STATE_LABELS[phenologicalState],
      isPerennial: Boolean(crop.isPerennial ?? crop.perennial ?? false),
      especie: crop.species || crop.especie || '',
      variedad: crop.variety || crop.variedad || '',
      lote: crop.lotName || crop.assignedLot?.name || '',
      loteId: crop.lotId || crop.assignedLot?.id || '',
      hectareas: Number(crop.implantedSurface ?? crop.hectareas ?? 0),
      renspa: crop.renspa || '',
      fechaPlantacion: crop.plantingDate ? new Date(crop.plantingDate) : new Date(),
      fechaCosecha: crop.estimateHarvestDate ? new Date(crop.estimateHarvestDate) : new Date(),
      historial: Array.isArray(crop.historial) ? crop.historial : [],
      poligono: [],
      centroide: [0, 0],
    };
  }
}
