import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { Finca } from '../models/finca.model';

const SELECTED_FARM_KEY = 'selectedFarm';

@Injectable({
  providedIn: 'root'
})
export class ContextService {
  private selectedFarmSubj = new BehaviorSubject<Finca | null>(null);
  public selectedFarm$ = this.selectedFarmSubj.asObservable();

  private isFarmContextSubj = new BehaviorSubject<boolean>(false);
  public isFarmContext$ = this.isFarmContextSubj.asObservable();

  private userRoleSubj = new BehaviorSubject<string>('');
  public userRole$ = this.userRoleSubj.asObservable();

  private hasExplicitChange = false;

  constructor() {
    this.restoreFarmContext();
  }

  private async restoreFarmContext() {
    try {
      const { value } = await Preferences.get({ key: SELECTED_FARM_KEY });
      if (value && !this.hasExplicitChange) {
        const farm: Finca = JSON.parse(value);
        this.selectedFarmSubj.next(farm);
        this.isFarmContextSubj.next(true);
        this.userRoleSubj.next(farm.myRole || '');
      }
    } catch {
      await Preferences.remove({ key: SELECTED_FARM_KEY });
    }
  }

  setFarmContext(farm: Finca) {
    this.hasExplicitChange = true;
    this.selectedFarmSubj.next(farm);
    this.isFarmContextSubj.next(true);
    this.userRoleSubj.next(farm.myRole || '');
    Preferences.set({ key: SELECTED_FARM_KEY, value: JSON.stringify(farm) }).catch(() => {});
  }

  clearFarmContext() {
    this.hasExplicitChange = true;
    this.selectedFarmSubj.next(null);
    this.isFarmContextSubj.next(false);
    this.userRoleSubj.next('');
    Preferences.remove({ key: SELECTED_FARM_KEY }).catch(() => {});
  }
}
