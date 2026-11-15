import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, map, catchError, switchMap, tap, of, throwError } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../../environments/environment';
import { User, UpdateProfileDto, UpdatePasswordDto } from '../models/user.model';
import {
  Persona,
  UserRole,
  ROLES_OPTIONS,
  AssignUserDto,
  CreatePersonnelDto,
} from '../models/person.model';
import { NetworkService } from './network.service';

const USER_PROFILE_KEY = 'agrotrack_user_profile';
const PERSONNEL_CACHE_PREFIX = 'agrotrack_personnel_';
const FARM_USERS_CACHE_PREFIX = 'agrotrack_farm_users_';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private network = inject(NetworkService);
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
   * Obtiene el perfil del usuario autenticado bajo estrategia Online-First.
   */
  getCurrentUser(): Observable<User> {
    if (!this.network.isOnlineSnapshot) {
      if (this.memoryUser) {
        return of(this.memoryUser);
      }
      return from(this.getCachedUser()).pipe(
        switchMap((cachedUser) =>
          cachedUser
            ? of(cachedUser)
            : throwError(() => new Error('Sin conexión ni perfil en caché'))
        )
      );
    }

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
            return throwError(() => err);
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
   * Obtiene la nómina de colaboradores asignados a una finca específica (modelo User ligero).
   */
  getUsersByFarm(farmId: string): Observable<User[]> {
    if (!farmId) return of([]);

    if (!this.network.isOnlineSnapshot) {
      return from(this.getCachedUsersByFarm(farmId)).pipe(
        map((cached) => cached || [])
      );
    }

    return this.http
      .get<any[]>(`${this.apiUrl}/farm/${encodeURIComponent(farmId)}`)
      .pipe(
        map((users) => (users || []).map((u) => this.mapUser(u))),
        tap((mapped) => {
          Preferences.set({
            key: `${FARM_USERS_CACHE_PREFIX}${farmId}`,
            value: JSON.stringify(mapped),
          }).catch(() => {});
        }),
        catchError((err) =>
          from(this.getCachedUsersByFarm(farmId)).pipe(
            switchMap((cached) =>
              cached ? of(cached) : throwError(() => err)
            )
          )
        )
      );
  }

  async getCachedUsersByFarm(farmId: string): Promise<User[] | null> {
    if (!farmId) return null;
    try {
      const { value } = await Preferences.get({
        key: `${FARM_USERS_CACHE_PREFIX}${farmId}`,
      });
      if (value) {
        return JSON.parse(value);
      }
      const cachedPersonnel = await this.getCachedPersonnel(farmId);
      if (cachedPersonnel) {
        return cachedPersonnel.map((p) => ({
          id: p.id,
          idUser: p.id,
          name: p.firstName || p.nombre,
          lastName: p.lastName || '',
          email: p.email,
          role: p.rol,
          phone: p.telefono,
          address: p.direccion,
          active: p.estado === 'Activo',
        }));
      }
      return null;
    } catch {
      return null;
    }
  }

  // ==================== GESTIÓN DE PERSONAL / EQUIPO ====================

  /**
   * Obtiene la nómina de personal de la finca activa bajo estrategia Online-First:
   * 1. Consulta la API REST del backend.
   * 2. Guarda el resultado en caché de Preferences (`agrotrack_personnel_{farmId}`).
   * 3. Si no hay conexión o falla la red, devuelve la copia en caché local.
   */
  getPersonnelByFarm(farmId: string): Observable<Persona[]> {
    if (!farmId) return of([]);

    if (!this.network.isOnlineSnapshot) {
      return from(this.getCachedPersonnel(farmId)).pipe(
        map((cached) => cached || [])
      );
    }

    return this.http
      .get<any[]>(`${this.apiUrl}/farm/${encodeURIComponent(farmId)}`)
      .pipe(
        map((users) => (users || []).map((u) => this.mapPersona(u))),
        tap((personas) => {
          Preferences.set({
            key: `${PERSONNEL_CACHE_PREFIX}${farmId}`,
            value: JSON.stringify(personas),
          }).catch(() => {});
        }),
        catchError((err) => {
          return from(this.getCachedPersonnel(farmId)).pipe(
            switchMap((cached) => {
              if (cached) {
                return of(cached);
              }
              return throwError(() => err);
            })
          );
        })
      );
  }

  /**
   * Recupera de la caché local la última lista de personal guardada para la finca.
   */
  async getCachedPersonnel(farmId: string): Promise<Persona[] | null> {
    if (!farmId) return null;
    try {
      const { value } = await Preferences.get({
        key: `${PERSONNEL_CACHE_PREFIX}${farmId}`,
      });
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  /**
   * Asigna un usuario existente por email y rol a las fincas indicadas (Requiere OWNER).
   */
  assignUserToFarm(dto: AssignUserDto): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/assign`, dto);
  }

  /**
   * Invita / Registra un nuevo colaborador asignándolo a la finca activa (Requiere OWNER).
   */
  inviteUserToFarm(farmId: string, dto: CreatePersonnelDto): Observable<void> {
    const url = `${environment.apiUrl}/farms/${encodeURIComponent(farmId)}/users`;
    return this.http.post<void>(url, dto);
  }

  /**
   * Actualiza el rol o fincas asignadas de un usuario (Requiere OWNER).
   */
  updateUserAssignment(
    userId: string,
    role: UserRole,
    farmIds: string[]
  ): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${encodeURIComponent(userId)}/assignments`, {
      role,
      farmIds,
    });
  }

  /**
   * Revoca el acceso de un miembro a una finca específica (Requiere OWNER).
   */
  removeUserFromFarm(farmId: string, userId: string): Observable<void> {
    const url = `${environment.apiUrl}/farms/${encodeURIComponent(farmId)}/users/${encodeURIComponent(userId)}`;
    return this.http.delete<void>(url);
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

  private mapPersona(u: any): Persona {
    const roleVal: UserRole = (u.role as UserRole) || 'WORKER';
    const opt = ROLES_OPTIONS.find((r) => r.value === roleVal) || ROLES_OPTIONS[5];
    const first = u.name || '';
    const last = u.lastName || '';
    const full = `${first} ${last}`.trim() || u.email || 'Colaborador';

    return {
      id: u.idUser || u.id || '',
      nombre: full,
      firstName: first,
      lastName: last,
      dni: u.dni || undefined,
      email: u.email || '',
      telefono: u.phone || '',
      direccion: u.address || '',
      rol: roleVal,
      rolLabel: opt.label,
      categoriaRol: opt.category,
      colorBadge: opt.color,
      estado: u.active !== false ? 'Activo' : 'Pendiente',
      fincasAsignadas: u.farmIds || [],
    };
  }
}
