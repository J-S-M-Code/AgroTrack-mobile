import { Injectable, OnDestroy, inject } from '@angular/core';
import { RxStomp } from '@stomp/rx-stomp';
import SockJS from 'sockjs-client';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/services/auth.service';

export interface MapStatusUpdate {
  mapId: string;
  status: 'PROCESSING' | 'READY' | 'ERROR';
}

@Injectable({
  providedIn: 'root',
})
export class WebsocketService implements OnDestroy {
  private authService = inject(AuthService);
  private rxStomp: RxStomp;
  private authSub?: Subscription;

  constructor() {
    this.rxStomp = new RxStomp();

    this.rxStomp.configure({
      webSocketFactory: () => new SockJS(environment.wsUrl),
      beforeConnect: async (client: RxStomp) => {
        const token = await this.authService.getToken();
        client.stompClient.connectHeaders = {
          Authorization: token ? `Bearer ${token}` : '',
        };
      },
      heartbeatIncoming: 0,
      heartbeatOutgoing: 20000,
      reconnectDelay: 5000,
    });

    this.authSub = this.authService.authStatus$.subscribe((isAuthenticated) => {
      if (isAuthenticated) {
        if (!this.rxStomp.active) {
          this.rxStomp.activate();
        }
      } else {
        if (this.rxStomp.active) {
          this.rxStomp.deactivate();
        }
      }
    });
  }

  watchMapUpdates(farmId: string): Observable<MapStatusUpdate> {
    return this.rxStomp.watch(`/topic/farms/${farmId}/maps`).pipe(
      map((message) => JSON.parse(message.body) as MapStatusUpdate)
    );
  }

  watchAlerts(farmId: string): Observable<any> {
    return this.rxStomp.watch(`/topic/farms/${farmId}/alerts`).pipe(
      map((message) => JSON.parse(message.body))
    );
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
    this.rxStomp.deactivate();
  }
}
