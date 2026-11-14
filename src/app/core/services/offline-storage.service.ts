import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { CachedEnvelope } from '../models/sync.model';

@Injectable({
  providedIn: 'root',
})
export class OfflineStorageService {
  private readonly PREFIX = 'agrotrack_cache_';

  async setCache<T>(key: string, data: T): Promise<void> {
    if (!key) return;
    const envelope: CachedEnvelope<T> = {
      savedAt: new Date().toISOString(),
      data,
    };
    try {
      await Preferences.set({
        key: `${this.PREFIX}${key}`,
        value: JSON.stringify(envelope),
      });
    } catch (err) {
      console.warn(`Error guardando caché [${key}]:`, err);
    }
  }

  async getCache<T>(key: string): Promise<T | null> {
    if (!key) return null;
    try {
      const { value } = await Preferences.get({ key: `${this.PREFIX}${key}` });
      if (!value) return null;
      const parsed = JSON.parse(value) as CachedEnvelope<T>;
      return parsed?.data ?? null;
    } catch {
      return null;
    }
  }

  async getCacheEnvelope<T>(key: string): Promise<CachedEnvelope<T> | null> {
    if (!key) return null;
    try {
      const { value } = await Preferences.get({ key: `${this.PREFIX}${key}` });
      if (!value) return null;
      return JSON.parse(value) as CachedEnvelope<T>;
    } catch {
      return null;
    }
  }

  async removeCache(key: string): Promise<void> {
    if (!key) return;
    try {
      await Preferences.remove({ key: `${this.PREFIX}${key}` });
    } catch {
      // noop
    }
  }

  async clearAllCaches(): Promise<void> {
    try {
      const { keys } = await Preferences.keys();
      const cacheKeys = keys.filter((k) => k.startsWith(this.PREFIX));
      await Promise.all(cacheKeys.map((k) => Preferences.remove({ key: k })));
    } catch {
      // noop
    }
  }
}
