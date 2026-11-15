import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

const PREFERENCES_KEY = 'agrotrack_app_preferences';

export interface AppPreferences {
  unidadSuperficie: 'ha' | 'ac';
  unidadTemperatura: 'C' | 'F';
  altoContraste: boolean;
  notificacionesHabilitadas: boolean;
}

const DEFAULT_PREFERENCES: AppPreferences = {
  unidadSuperficie: 'ha',
  unidadTemperatura: 'C',
  altoContraste: false,
  notificacionesHabilitadas: true,
};

@Injectable({
  providedIn: 'root',
})
export class PreferencesService {
  private preferencesSubj = new BehaviorSubject<AppPreferences>(DEFAULT_PREFERENCES);
  public preferences$ = this.preferencesSubj.asObservable();

  constructor() {
    this.cargarPreferencias();
  }

  private async cargarPreferencias() {
    try {
      const { value } = await Preferences.get({ key: PREFERENCES_KEY });
      if (value) {
        const parsed = JSON.parse(value);
        const prefs: AppPreferences = { ...DEFAULT_PREFERENCES, ...parsed };
        this.preferencesSubj.next(prefs);
        this.aplicarEfectosVisuales(prefs);
      }
    } catch {
      this.preferencesSubj.next(DEFAULT_PREFERENCES);
    }
  }

  get currentPreferences(): AppPreferences {
    return this.preferencesSubj.getValue();
  }

  async setPreferences(nuevas: Partial<AppPreferences>): Promise<void> {
    const actualizadas: AppPreferences = {
      ...this.currentPreferences,
      ...nuevas,
    };
    this.preferencesSubj.next(actualizadas);
    this.aplicarEfectosVisuales(actualizadas);

    await Preferences.set({
      key: PREFERENCES_KEY,
      value: JSON.stringify(actualizadas),
    });
  }

  private aplicarEfectosVisuales(prefs: AppPreferences) {
    if (typeof document !== 'undefined') {
      if (prefs.altoContraste) {
        document.body.classList.add('high-contrast-mode');
      } else {
        document.body.classList.remove('high-contrast-mode');
      }
    }
  }
}
