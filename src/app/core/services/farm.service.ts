import { environment } from '../../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Finca } from '../models/finca.model';

@Injectable({
  providedIn: 'root'
})
export class FarmService {
  private apiUrl = environment.apiUrl + '/farms';

  constructor(private http: HttpClient) {}

  getFincas(): Observable<Finca[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      map(farms => farms.map(farm => this.mapFarmToFinca(farm)))
    );
  }

  getFincaById(id: string): Observable<Finca> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(farm => this.mapFarmToFinca(farm))
    );
  }

  createFarm(farm: any): Observable<Finca> {
    return this.http.post<any>(this.apiUrl, farm).pipe(
      map(f => this.mapFarmToFinca(f))
    );
  }

  updateFarm(id: string, farm: any): Observable<Finca> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, farm).pipe(
      map(f => this.mapFarmToFinca(f))
    );
  }

  deleteFarm(id: string, reason: string): Observable<void> {
    return this.http.request<void>('delete', `${this.apiUrl}/${id}`, { body: { reason } });
  }

  private mapFarmToFinca(farm: any): Finca {
    return {
      id: farm.idFarm || farm.id,
      name: farm.name,
      location: farm.address,
      lat: farm.centroid?.coordinates ? farm.centroid.coordinates[1] : undefined,
      lon: farm.centroid?.coordinates ? farm.centroid.coordinates[0] : undefined,
      polygon: farm.polygonLimit?.coordinates ? farm.polygonLimit.coordinates[0].map((c: any) => [c[1], c[0]]) : [],
      imageUrl: farm.imageUrl,
      companyName: farm.companyName,
      cuit: farm.cuit,
      numberRENAPSA: farm.numberrenapsa,
      productiveOrientation: farm.productiveOrientation,
      surface: farm.surface,
      myRole: farm.myRole
    };
  }
}
