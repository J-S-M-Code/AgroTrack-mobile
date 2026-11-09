import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Animal } from '../models/animal.model';

@Injectable({
  providedIn: 'root',
})
export class AnimalService {
  private apiUrl = environment.apiUrl + '/animals';

  constructor(private http: HttpClient) {}

  getAnimalsByFarm(farmId: string): Observable<Animal[]> {
    if (!farmId) return of([]);
    return this.http.get<any[]>(`${this.apiUrl}/farm/${farmId}`).pipe(
      map((animals) => (animals || []).map((animal) => this.mapAnimal(animal)))
    );
  }

  getAnimalById(id: string, farmId: string): Observable<Animal> {
    return this.http.get<any>(`${this.apiUrl}/${id}?farmId=${farmId}`).pipe(
      map((animal) => this.mapAnimal(animal))
    );
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
      loteId: animal.lotId || animal.assignedLotId || animal.assignedLot?.id || '',
      fincaId: animal.farmId || animal.assignedFarmId || animal.assignedLot?.farmId || '',
      especie: this.mapSpeciesToSpanish(animal.species || ''),
      raza: animal.race || '',
      sexo: animal.sex === 'MALE' ? 'Macho' : 'Hembra',
      categoria: this.mapCategoryToSpanish(animal.category || ''),
      fechaNacimiento: animal.birthdate ? new Date(animal.birthdate) : undefined,
      pesoActual: animal.currentWeight || 0,
      active: animal.active !== false,
    };
  }
}
