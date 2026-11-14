import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Network, ConnectionStatus } from '@capacitor/network';

@Injectable({
  providedIn: 'root',
})
export class NetworkService implements OnDestroy {
  private onlineSubject = new BehaviorSubject<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  private connectionTypeSubject = new BehaviorSubject<string>('unknown');
  private hardwareConnected =
    typeof navigator !== 'undefined' ? navigator.onLine : true;

  readonly isOnline$: Observable<boolean> = this.onlineSubject.asObservable();
  readonly connectionType$: Observable<string> =
    this.connectionTypeSubject.asObservable();

  private listenerHandle: { remove: () => Promise<void> } | null = null;
  private windowOnlineHandler = () => this.updateStatus(true, 'unknown');
  private windowOfflineHandler = () => this.updateStatus(false, 'none');

  constructor() {
    void this.init();
  }

  get isOnlineSnapshot(): boolean {
    return this.onlineSubject.value;
  }

  get isHardwareConnected(): boolean {
    return this.hardwareConnected;
  }

  reportNetworkFailure(): void {
    if (this.onlineSubject.value) {
      this.onlineSubject.next(false);
    }
  }

  reportNetworkSuccess(): void {
    this.hardwareConnected = true;
    if (!this.onlineSubject.value) {
      this.onlineSubject.next(true);
    }
  }

  isNetworkError(err: any): boolean {
    return (
      !this.isOnlineSnapshot ||
      err?.name === 'TimeoutError' ||
      (err?.status ?? 0) === 0
    );
  }

  async checkStatus(): Promise<boolean> {
    try {
      const status = await Network.getStatus();
      this.updateStatus(status.connected, status.connectionType);
      return status.connected;
    } catch {
      const fallback = typeof navigator !== 'undefined' ? navigator.onLine : true;
      this.updateStatus(fallback, fallback ? 'unknown' : 'none');
      return fallback;
    }
  }

  private async init(): Promise<void> {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.windowOnlineHandler);
      window.addEventListener('offline', this.windowOfflineHandler);
    }

    try {
      const status = await Network.getStatus();
      this.updateStatus(status.connected, status.connectionType);

      this.listenerHandle = await Network.addListener(
        'networkStatusChange',
        (next: ConnectionStatus) => {
          this.updateStatus(next.connected, next.connectionType);
        }
      );
    } catch {
      // Fallback en navegadores sin plugin nativo
    }
  }

  private updateStatus(connected: boolean, connectionType: string): void {
    this.hardwareConnected = connected;
    if (this.onlineSubject.value !== connected) {
      this.onlineSubject.next(connected);
    }
    if (this.connectionTypeSubject.value !== connectionType) {
      this.connectionTypeSubject.next(connectionType);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.windowOnlineHandler);
      window.removeEventListener('offline', this.windowOfflineHandler);
    }
    if (this.listenerHandle) {
      void this.listenerHandle.remove();
    }
  }
}
