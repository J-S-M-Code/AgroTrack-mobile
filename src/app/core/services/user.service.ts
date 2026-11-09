import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = environment.apiUrl + '/users';

  constructor(private http: HttpClient) {}

  getCurrentUser(): Observable<User> {
    return this.http
      .get<any>(`${this.apiUrl}/me`)
      .pipe(map((u) => this.mapUser(u)));
  }

  getUsersByFarm(farmId: string): Observable<User[]> {
    if (!farmId) return of([]);
    return this.http
      .get<any[]>(`${this.apiUrl}/farm/${encodeURIComponent(farmId)}`)
      .pipe(map((users) => (users || []).map((u) => this.mapUser(u))));
  }

  private mapUser(u: any): User {
    return {
      id: u.idUser || u.id || '',
      idUser: u.idUser || u.id || '',
      name: u.name || '',
      lastName: u.lastName || '',
      email: u.email || '',
      role: u.role || '',
      phone: u.phone || '',
      address: u.address || '',
      active: u.active !== false,
    };
  }
}
