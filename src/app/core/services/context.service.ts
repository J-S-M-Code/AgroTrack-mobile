import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Finca } from '../models/finca.model';

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

  constructor() {}

  setFarmContext(farm: Finca) {
    this.selectedFarmSubj.next(farm);
    this.isFarmContextSubj.next(true);
    this.userRoleSubj.next(farm.myRole || '');
  }

  clearFarmContext() {
    this.selectedFarmSubj.next(null);
    this.isFarmContextSubj.next(false);
    this.userRoleSubj.next('');
  }
}
