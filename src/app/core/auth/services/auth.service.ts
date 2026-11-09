import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../../../environments/environment';

const TOKEN_KEY = 'agrotrack_token';
const USER_ID_KEY = 'userId';
const REFRESH_THRESHOLD_SECONDS = 24 * 60 * 60; // 24 horas

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl + '/auth';

  private authStatusSubj = new BehaviorSubject<boolean>(false);
  public authStatus$ = this.authStatusSubj.asObservable();

  private refreshInFlight: Promise<string | null> | null = null;

  constructor(private http: HttpClient, private router: Router) {
    this.checkInitialToken();
  }

  private async checkInitialToken() {
    const validToken = await this.refreshTokenIfNeeded();
    this.authStatusSubj.next(!!validToken);
  }

  login(credentials: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      switchMap(async (response) => {
        if (response && response.token) {
          await this.setToken(response.token);
          this.authStatusSubj.next(true);
        }
        return response;
      })
    );
  }

  async logout(): Promise<void> {
    await Preferences.remove({ key: TOKEN_KEY });
    await Preferences.remove({ key: USER_ID_KEY });
    this.authStatusSubj.next(false);
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  async setToken(token: string): Promise<void> {
    await Preferences.set({ key: TOKEN_KEY, value: token });
    try {
      const payload = this.decodePayload(token);
      if (payload && payload.sub) {
        await Preferences.set({ key: USER_ID_KEY, value: payload.sub });
      }
    } catch (e) {
      console.error('Error parsing token', e);
    }
  }

  async getToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    return value;
  }

  /**
   * Verifica la vigencia del token y lo renueva silenciosamente si le restan menos de 24 horas.
   */
  async refreshTokenIfNeeded(): Promise<string | null> {
    const token = await this.getToken();
    if (!token) return null;

    const payload = this.decodePayload(token);
    if (!payload || !payload.exp) {
      return token;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const remainingSec = payload.exp - nowSec;

    if (remainingSec <= 0) {
      await this.logout();
      return null;
    }

    if (remainingSec < REFRESH_THRESHOLD_SECONDS) {
      return this.executeSilentRefresh(token);
    }

    return token;
  }

  private async executeSilentRefresh(currentToken: string): Promise<string | null> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = (async () => {
      try {
        const res = await firstValueFrom(
          this.http.post<{ token: string }>(`${this.apiUrl}/refresh`, {})
        );
        if (res && res.token) {
          await this.setToken(res.token);
          this.authStatusSubj.next(true);
          return res.token;
        }
        return currentToken;
      } catch (err: any) {
        if (err?.status === 401 || err?.status === 403) {
          await this.logout();
          return null;
        }
        return currentToken;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  private decodePayload(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }

  async getUserId(): Promise<string | null> {
    const { value } = await Preferences.get({ key: USER_ID_KEY });
    if (value) return value;
    const token = await this.getToken();
    if (!token) return null;
    const payload = this.decodePayload(token);
    return payload?.sub || null;
  }

  async hasToken(): Promise<boolean> {
    const token = await this.refreshTokenIfNeeded();
    return !!token;
  }
}
