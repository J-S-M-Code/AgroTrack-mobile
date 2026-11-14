import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SpectralMap } from '../models/spectral-map.model';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class SpectralMapService {
  private baseUrl = environment.apiUrl + '/farms';
  private http = inject(HttpClient);
  private network = inject(NetworkService);

  getMapsByFarm(farmId: string): Observable<SpectralMap[]> {
    if (!farmId || !this.network.isOnlineSnapshot) return of([]);
    // Autenticación manejada por el interceptor global
    return this.http
      .get<SpectralMap[]>(`${this.baseUrl}/${farmId}/maps`)
      .pipe(catchError(() => of([])));
  }
}
