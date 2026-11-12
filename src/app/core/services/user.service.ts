import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, map, catchError, switchMap, tap, of } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../../environments/environment';
import { User, UpdateProfileDto, UpdatePasswordDto } from '../models/user.model';

const USER_PROFILE_KEY = 'agrotrack_user_profile';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl + '/users';
  private memoryUser: User | null = null;

  constructor() {
    this.preloadCachedUser();
  }

  private async preloadCachedUser() {
    const cached = await this.getCachedUser();
    if (cached && !this.memoryUser) {
      this.memoryUser = cached;
    }
  }

  /**
   * Snapshot instantáneo en memoria RAM del usuario autenticado (0ms).
   */
  get currentUserSnapshot(): User | null {
    return this.memoryUser;
  }

  /**
   * Obtiene el perfil del usuario autenticado bajo estrategia Online-First:
   * 1. Consulta la API REST del backend para garantizar datos frescos.
   * 2. Si responde con éxito, actualiza la caché en RAM y en Preferences.
   * 3. Si no hay conexión (offline) o hay un error de red, emite los datos previamente guardados en caché.
   */
  getCurrentUser(): Observable<User> {
    return this.http.get<any>(`${this.apiUrl}/me`).pipe(
      map((u) => this.mapUser(u)),
      tap((user) => {
        this.memoryUser = user;
        Preferences.set({
          key: USER_PROFILE_KEY,
          value: JSON.stringify(user),
        }).catch(() => {});
      }),
      catchError((err) => {
        if (this.memoryUser) {
          return of(this.memoryUser);
        }
        return from(this.getCachedUser()).pipe(
          switchMap((cachedUser) => {
            if (cachedUser) {
              this.memoryUser = cachedUser;
              return of(cachedUser);
            }
            throw err;
          })
        );
      })
    );
  }

  /**
   * Obtiene el perfil almacenado en caché local para acceso inmediato offline.
   */
  async getCachedUser(): Promise<User | null> {
    if (this.memoryUser) {
      return this.memoryUser;
    }
    try {
      const { value } = await Preferences.get({ key: USER_PROFILE_KEY });
      if (value) {
        const parsed = JSON.parse(value);
        this.memoryUser = parsed;
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Actualiza los datos de contacto personales del usuario autenticado.
   */
  updateMyProfile(data: UpdateProfileDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/me`, data).pipe(
      tap(() => {
        if (this.memoryUser) {
          this.memoryUser = {
            ...this.memoryUser,
            name: data.name,
            lastName: data.lastName,
            phone: data.phone ?? this.memoryUser.phone,
            address: data.address ?? this.memoryUser.address,
          };
          Preferences.set({
            key: USER_PROFILE_KEY,
            value: JSON.stringify(this.memoryUser),
          }).catch(() => {});
        }
      })
    );
  }

  /**
   * Modifica la contraseña del usuario previa verificación de la contraseña actual.
   */
  updateMyPassword(data: UpdatePasswordDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/me/password`, data);
  }

  /**
   * Obtiene la nómina de colaboradores asignados a una finca específica.
   */
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
