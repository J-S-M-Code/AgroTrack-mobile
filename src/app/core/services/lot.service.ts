import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Lot } from '../models/lot.model';

@Injectable({
  providedIn: 'root'
})
export class LotService {
  private apiUrl = environment.apiUrl + '/lots';
  private http = inject(HttpClient);

  getLotsByFarm(farmId: string): Observable<Lot[]> {
    if (!farmId) return of([]);
    return this.http.get<any[]>(`${this.apiUrl}/farm/${farmId}`).pipe(
      map(lots => lots.map(lot => this.mapLot(lot)))
    );
  }

  createLot(farmId: string, lotDto: any): Observable<Lot> {
    return this.http.post<any>(`${this.apiUrl}/farm/${farmId}`, lotDto).pipe(
      map(lot => this.mapLot(lot))
    );
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
      polygon: lot.polygonLimit?.coordinates ? lot.polygonLimit.coordinates[0].map((c: any) => [c[1], c[0]]) : [],
    };
  }
}
