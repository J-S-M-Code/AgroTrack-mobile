import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from, map, tap, catchError, switchMap } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../../environments/environment';
import { Collar, CollarEstadoLabel, CollarStateBackend } from '../models/collar.model';

const COLLARS_CACHE_PREFIX = 'agrotrack_collars_';

@Injectable({
  providedIn: 'root',
})
export class CollarService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * Obtiene los collares IoT de una finca bajo estrategia Online-First:
   * 1. Consulta la API REST para traer los datos actualizados.
   * 2. Actualiza la caché local en Preferences.
   * 3. Si no hay conexión, devuelve la última copia en caché de esa finca.
   */
  getCollarsByFarm(farmId: string): Observable<Collar[]> {
    if (!farmId) return of([]);

    return this.http
      .get<any[]>(`${this.apiUrl}/farms/${encodeURIComponent(farmId)}/collars`)
      .pipe(
        map((collars) => (collars || []).map((c) => this.mapCollar(c))),
        tap((mapped) => {
          Preferences.set({
            key: `${COLLARS_CACHE_PREFIX}${farmId}`,
            value: JSON.stringify(mapped),
          }).catch(() => {});
        }),
        catchError((err) => {
          return from(this.getCachedCollars(farmId)).pipe(
            switchMap((cached) => {
              if (cached) {
                return of(cached);
              }
              throw err;
            })
          );
        })
      );
  }

  async getCachedCollars(farmId: string): Promise<Collar[] | null> {
    if (!farmId) return null;
    try {
      const { value } = await Preferences.get({
        key: `${COLLARS_CACHE_PREFIX}${farmId}`,
      });
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  createCollar(farmId: string, collar: Partial<Collar>): Observable<Collar> {
    const payload = {
      codeRFID: collar.rfid?.trim(),
      model: collar.modelo?.trim() || '',
      state: this.toBackendState(collar.estado),
      batteryLevel: collar.bateria ?? 100,
    };

    return this.http
      .post<any>(`${this.apiUrl}/farms/${encodeURIComponent(farmId)}/collars`, payload)
      .pipe(map((c) => this.mapCollar(c)));
  }

  updateCollar(id: string, farmId: string, updates: Partial<Collar>): Observable<Collar> {
    const payload = {
      codeRFID: updates.rfid?.trim(),
      model: updates.modelo?.trim() || '',
      state: this.toBackendState(updates.estado),
      batteryLevel: updates.bateria ?? 100,
    };

    return this.http
      .put<any>(
        `${this.apiUrl}/collars/${encodeURIComponent(id)}?farmId=${encodeURIComponent(farmId)}`,
        payload
      )
      .pipe(map((c) => this.mapCollar(c)));
  }

  deleteCollar(id: string, farmId: string, reason: string): Observable<void> {
    return this.http.request<void>(
      'delete',
      `${this.apiUrl}/collars/${encodeURIComponent(id)}?farmId=${encodeURIComponent(farmId)}`,
      { body: { reason } }
    );
  }

  private toBackendState(estado?: CollarEstadoLabel): CollarStateBackend {
    if (estado === 'En Reparación') return 'MAINTENANCE';
    if (estado === 'Asignado') return 'ASSIGNED';
    return 'AVAILABLE';
  }

  private mapCollar(c: any): Collar {
    const stateMap: Record<string, CollarEstadoLabel> = {
      AVAILABLE: 'Disponible',
      ASSIGNED: 'Asignado',
      MAINTENANCE: 'En Reparación',
    };

    return {
      id: c.idCollar || c.id || '',
      rfid: c.codeRFID || c.rfid || '',
      modelo: c.model || c.modelo || 'Estándar',
      rawState: c.state || 'AVAILABLE',
      estado: stateMap[c.state] || 'Disponible',
      bateria: c.batteryLevel ?? c.bateria ?? 100,
      assignedAnimalCaravan: c.assignedAnimalCaravan || undefined,
    };
  }
}
