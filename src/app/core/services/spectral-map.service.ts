import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SpectralMap } from '../models/spectral-map.model';

@Injectable({
  providedIn: 'root'
})
export class SpectralMapService {
  private baseUrl = environment.apiUrl + '/farms';
  private http = inject(HttpClient);

  getMapsByFarm(farmId: string): Observable<SpectralMap[]> {
    if (!farmId) return of([]);
    // Autenticación manejada por el interceptor global
    return this.http.get<SpectralMap[]>(`${this.baseUrl}/${farmId}/maps`);
  }
}
