import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Cultivo,
  CropUpsertDto,
  PhenologicalState,
  PHENOLOGICAL_STATE_LABELS,
  TypeCrop,
  TYPE_CROP_LABELS,
} from '../models/cultivo.model';

@Injectable({
  providedIn: 'root',
})
export class CropService {
  private apiUrl = environment.apiUrl + '/crops';
  private lotsUrl = environment.apiUrl + '/lots';
  private http = inject(HttpClient);

  getCropsByFarm(farmId: string): Observable<Cultivo[]> {
    if (!farmId) return of([]);
    return this.http
      .get<any[]>(`${this.apiUrl}/farm/${farmId}`)
      .pipe(map((crops) => (crops || []).map((crop) => this.mapCrop(crop))));
  }

  getAllCropsForAllFarms(farmIds: string[]): Observable<Cultivo[]> {
    if (!farmIds || farmIds.length === 0) return of([]);
    const requests = farmIds.map((id) => this.getCropsByFarm(id));
    return forkJoin(requests).pipe(
      map((results) => results.reduce((acc, curr) => acc.concat(curr), []))
    );
  }

  getUnassignedCrops(): Observable<Cultivo[]> {
    return this.http
      .get<any[]>(`${this.apiUrl}/unassigned`)
      .pipe(map((crops) => (crops || []).map((crop) => this.mapCrop(crop))));
  }

  getCropById(id: string, farmId: string): Observable<Cultivo> {
    return this.http
      .get<any>(`${this.apiUrl}/${id}?farmId=${encodeURIComponent(farmId)}`)
      .pipe(map((crop) => this.mapCrop(crop)));
  }

  registerCrop(lotId: string, crop: CropUpsertDto, farmId: string): Observable<Cultivo> {
    return this.http
      .post<any>(
        `${this.lotsUrl}/${encodeURIComponent(lotId)}/crops?farmId=${encodeURIComponent(farmId)}`,
        crop
      )
      .pipe(map((created) => this.mapCrop(created)));
  }

  updateCrop(id: string, crop: CropUpsertDto, farmId: string): Observable<Cultivo> {
    return this.http
      .put<any>(
        `${this.apiUrl}/${encodeURIComponent(id)}?farmId=${encodeURIComponent(farmId)}`,
        crop
      )
      .pipe(map((updated) => this.mapCrop(updated)));
  }

  updatePhenologicalState(
    id: string,
    state: PhenologicalState,
    farmId: string
  ): Observable<void> {
    return this.http.put<void>(
      `${this.apiUrl}/${encodeURIComponent(id)}/phenological-state?state=${encodeURIComponent(
        state
      )}&farmId=${encodeURIComponent(farmId)}`,
      {}
    );
  }

  registerHarvest(id: string, farmId: string, actualHarvestDate: string): Observable<void> {
    const formattedDate = actualHarvestDate.includes('T')
      ? actualHarvestDate
      : `${actualHarvestDate}T00:00:00`;

    return this.http.post<void>(
      `${this.apiUrl}/${encodeURIComponent(id)}/harvest?farmId=${encodeURIComponent(
        farmId
      )}&actualHarvestDate=${encodeURIComponent(formattedDate)}`,
      {}
    );
  }

  deleteCrop(id: string, farmId: string, reason?: string): Observable<void> {
    let url = `${this.apiUrl}/${encodeURIComponent(id)}?farmId=${encodeURIComponent(farmId)}`;
    if (reason) {
      url += `&reason=${encodeURIComponent(reason)}`;
    }
    return this.http.delete<void>(url);
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
