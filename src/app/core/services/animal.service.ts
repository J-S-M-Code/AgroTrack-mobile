import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Animal } from '../models/animal.model';
import { OfflineStorageService } from './offline-storage.service';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root',
})
export class AnimalService {
  private apiUrl = environment.apiUrl + '/animals';
  private http = inject(HttpClient);
  private storage = inject(OfflineStorageService);
  private network = inject(NetworkService);

  getAnimalsByFarm(farmId: string): Observable<Animal[]> {
    if (!farmId) return of([]);
    const cacheKey = `animals_${farmId}`;

    if (!this.network.isOnlineSnapshot) {
      return from(this.storage.getCache<Animal[]>(cacheKey)).pipe(
        map((cached) => this.reviveDates(cached || []))
      );
    }

    return this.http.get<any[]>(`${this.apiUrl}/farm/${farmId}`).pipe(
      map((animals) => (animals || []).map((animal) => this.mapAnimal(animal))),
      tap((mapped) => {
        void this.storage.setCache(cacheKey, mapped);
      }),
      catchError((err) =>
        from(this.storage.getCache<Animal[]>(cacheKey)).pipe(
          switchMap((cached) =>
            cached ? of(this.reviveDates(cached)) : throwError(() => err)
          )
        )
      )
    );
  }

  getAnimalById(id: string, farmId: string): Observable<Animal> {
    const cacheKey = `animal_${id}`;

    if (!this.network.isOnlineSnapshot) {
      return from(this.getCachedAnimalById(id, farmId)).pipe(
        switchMap((cached) =>
          cached
            ? of(cached)
            : throwError(() => new Error('Sin conexión ni datos en caché'))
        )
      );
    }

    return this.http.get<any>(`${this.apiUrl}/${id}?farmId=${farmId}`).pipe(
      map((animal) => this.mapAnimal(animal)),
      tap((mapped) => {
        void this.storage.setCache(cacheKey, mapped);
      }),
      catchError((err) =>
        from(this.getCachedAnimalById(id, farmId)).pipe(
          switchMap((cached) => (cached ? of(cached) : throwError(() => err)))
        )
      )
    );
  }

  private async getCachedAnimalById(
    id: string,
    farmId: string
  ): Promise<Animal | null> {
    const direct = await this.storage.getCache<Animal>(`animal_${id}`);
    if (direct) return this.reviveDates([direct])[0];
    const list = await this.storage.getCache<Animal[]>(`animals_${farmId}`);
    const found = list?.find((a) => a.id === id);
    return found ? this.reviveDates([found])[0] : null;
  }

  private reviveDates(animals: Animal[]): Animal[] {
    return animals.map((a) => ({
      ...a,
      fechaNacimiento: a.fechaNacimiento ? new Date(a.fechaNacimiento) : undefined,
    }));
  }

  private mapSpeciesToSpanish(species: string): string {
    const mapSpecies: Record<string, string> = {
      BOVINE: 'Bovino',
      BUFFALO: 'Bubalino',
      SWEEP: 'Ovino',
      SHEEP: 'Ovino',
      GOAT: 'Caprino',
      PIG: 'Porcino',
      HORSE: 'Equino',
    };
    return mapSpecies[species] || species || 'Bovino';
  }

  private mapCategoryToSpanish(category: string): string {
    const mapCategory: Record<string, string> = {
      CALF_MALE: 'Ternero',
      CALF_FEMALE: 'Ternera',
      YOUNG_STEER: 'Novillito',
      STEER: 'Novillo',
      HEIFER: 'Vaquillona',
      COW: 'Vaca',
      MEJ: 'Torito',
      BULL: 'Toro',
    };
    return mapCategory[category] || category || 'General';
  }

  private mapAnimal(animal: any): Animal {
    return {
      id: animal.idAnimal || animal.id,
      caravanaVisual: animal.visualCaravan || '',
      caravanaSenasa: animal.caravanSenasa || '',
      rfid: animal.rfid || '',
      cuig: animal.livestockKey || '',
      renspaActual: animal.numRENSPA || '',
      caravanaInterna: animal.internalManagementCaravan || '',
      loteAsignado:
        animal.lotName ||
        animal.farmName ||
        animal.assignedLot?.name ||
        animal.assignedLotId ||
        'Sin Lote',
      loteId:
        animal.lotId || animal.assignedLotId || animal.assignedLot?.id || '',
      fincaId:
        animal.farmId ||
        animal.assignedFarmId ||
        animal.assignedLot?.farmId ||
        '',
      especie: this.mapSpeciesToSpanish(animal.species || ''),
      raza: animal.race || '',
      sexo: animal.sex === 'MALE' ? 'Macho' : 'Hembra',
      categoria: this.mapCategoryToSpanish(animal.category || ''),
      fechaNacimiento: animal.birthdate
        ? new Date(animal.birthdate)
        : undefined,
      pesoActual: animal.currentWeight || 0,
      active: animal.active !== false,
    };
  }
}
