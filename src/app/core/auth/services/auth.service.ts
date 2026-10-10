import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../../../environments/environment';

const TOKEN_KEY = 'agrotrack_token';
const USER_ID_KEY = 'userId';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl + '/auth';
  
  private authStatusSubj = new BehaviorSubject<boolean>(false);
  public authStatus$ = this.authStatusSubj.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.checkInitialToken();
  }

  private async checkInitialToken() {
    const hasToken = await this.hasToken();
    this.authStatusSubj.next(hasToken);
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
      const payload = JSON.parse(atob(token.split('.')[1]));
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

  async hasToken(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}
