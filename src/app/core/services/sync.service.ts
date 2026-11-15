import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, firstValueFrom } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { environment } from '../../../environments/environment';
import {
  OutboxAttachment,
  OutboxOperation,
  SyncEntityType,
} from '../models/sync.model';
import { NetworkService } from './network.service';

const OUTBOX_STORAGE_KEY = 'agrotrack_outbox_queue';
const LAST_SYNC_KEY = 'agrotrack_last_sync_at';

@Injectable({
  providedIn: 'root',
})
export class SyncService implements OnDestroy {
  private http = inject(HttpClient);
  private networkService = inject(NetworkService);

  private operationsSubject = new BehaviorSubject<OutboxOperation[]>([]);
  private pendingCountSubject = new BehaviorSubject<number>(0);
  private isSyncingSubject = new BehaviorSubject<boolean>(false);
  private lastSyncAtSubject = new BehaviorSubject<string | null>(null);
  private syncedEntitySubject = new Subject<{
    entity: SyncEntityType;
    farmId: string;
  }>();

  readonly operations$: Observable<OutboxOperation[]> =
    this.operationsSubject.asObservable();
  readonly pendingCount$: Observable<number> =
    this.pendingCountSubject.asObservable();
  readonly isSyncing$: Observable<boolean> =
    this.isSyncingSubject.asObservable();
  readonly lastSyncAt$: Observable<string | null> =
    this.lastSyncAtSubject.asObservable();
  readonly syncedEntity$ = this.syncedEntitySubject.asObservable();

  private syncInProgress = false;
  private appStateListener: { remove: () => Promise<void> } | null = null;
  private networkSub = this.networkService.isOnline$.subscribe((online) => {
    if (online && this.operationsSubject.value.some((o) => o.status === 'PENDING')) {
      void this.processQueue();
    }
  });

  constructor() {
    void this.loadInitialState();
    void this.registerAppLifecycle();
  }

  get operationsSnapshot(): OutboxOperation[] {
    return this.operationsSubject.value;
  }

  private async loadInitialState(): Promise<void> {
    try {
      const [{ value: queueRaw }, { value: lastSyncRaw }] = await Promise.all([
        Preferences.get({ key: OUTBOX_STORAGE_KEY }),
        Preferences.get({ key: LAST_SYNC_KEY }),
      ]);

      if (lastSyncRaw) {
        this.lastSyncAtSubject.next(lastSyncRaw);
      }

      if (queueRaw) {
        const parsed: OutboxOperation[] = JSON.parse(queueRaw);
        const normalized = (parsed || []).map((op) => ({
          ...op,
          status: op.status === 'SYNCING' ? ('PENDING' as const) : op.status,
        }));
        this.emitQueue(normalized);

        if (
          this.networkService.isOnlineSnapshot &&
          normalized.some((o) => o.status === 'PENDING')
        ) {
          void this.processQueue();
        }
      }
    } catch (err) {
      console.warn('Error cargando cola outbox:', err);
    }
  }

  private async registerAppLifecycle(): Promise<void> {
    try {
      this.appStateListener = await App.addListener(
        'appStateChange',
        ({ isActive }) => {
          if (
            isActive &&
            this.operationsSubject.value.some((o) => o.status === 'PENDING')
          ) {
            void this.processQueue(true);
          }
        }
      );
    } catch {
      // noop en web
    }
  }

  async enqueue(
    op: Omit<OutboxOperation, 'id' | 'createdAt' | 'retryCount' | 'status'>
  ): Promise<OutboxOperation> {
    const item: OutboxOperation = {
      ...op,
      id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING',
    };

    const nextQueue = [...this.operationsSubject.value, item];
    await this.saveQueue(nextQueue);
    return item;
  }

  async processQueue(force = false): Promise<void> {
    if (this.syncInProgress) {
      return;
    }
    if (force) {
      await this.networkService.checkStatus();
    }
    if (!this.networkService.isOnlineSnapshot) {
      return;
    }

    const pendingIds = this.operationsSubject.value
      .filter((op) => op.status === 'PENDING')
      .map((op) => op.id);
    if (pendingIds.length === 0) return;

    this.syncInProgress = true;
    this.isSyncingSubject.next(true);

    try {
      for (const opId of pendingIds) {
        if (!this.networkService.isOnlineSnapshot) break;

        const op = this.operationsSubject.value.find((item) => item.id === opId);
        if (!op || op.status !== 'PENDING') continue;

        await this.updateOperation(op.id, { status: 'SYNCING', lastError: undefined });

        try {
          const finalPayload = await this.preparePayloadWithAttachments(op);
          const rawResponse = await this.executeHttpOperation(op, finalPayload);

          const remaining = this.operationsSubject.value.filter(
            (item) => item.id !== op.id
          );
          const updatedRemaining = this.propagateCreatedId(
            op,
            rawResponse,
            remaining
          );
          await this.saveQueue(updatedRemaining);

          const nowIso = new Date().toISOString();
          this.lastSyncAtSubject.next(nowIso);
          await Preferences.set({ key: LAST_SYNC_KEY, value: nowIso });

          this.syncedEntitySubject.next({
            entity: op.entity,
            farmId: op.farmId,
          });
        } catch (err: any) {
          const status = err?.status ?? 0;
          if (status === 0 || err?.name === 'TimeoutError') {
            // Se perdió la red durante el envío; reintentar cuando vuelva
            await this.updateOperation(op.id, { status: 'PENDING' });
            break;
          }

          const nextRetries = (op.retryCount || 0) + 1;
          const isTerminal = (status >= 400 && status < 500) || nextRetries >= 3;
          const errorMsg =
            err?.error?.message ||
            err?.message ||
            `Error HTTP ${status || 'desconocido'}`;

          await this.updateOperation(op.id, {
            retryCount: nextRetries,
            status: isTerminal ? 'FAILED' : 'PENDING',
            lastError: errorMsg,
          });
        }
      }
    } finally {
      this.syncInProgress = false;
      this.isSyncingSubject.next(false);
    }
  }

  async retryOperation(id: string): Promise<void> {
    await this.updateOperation(id, {
      status: 'PENDING',
      retryCount: 0,
      lastError: undefined,
    });
    await this.processQueue(true);
  }

  async retryAllFailed(): Promise<void> {
    const updated = this.operationsSubject.value.map((op) =>
      op.status === 'FAILED'
        ? { ...op, status: 'PENDING' as const, retryCount: 0, lastError: undefined }
        : op
    );
    await this.saveQueue(updated);
    await this.processQueue(true);
  }

  async discardOperation(id: string): Promise<void> {
    const filtered = this.operationsSubject.value.filter((op) => op.id !== id);
    await this.saveQueue(filtered);
  }

  private async preparePayloadWithAttachments(op: OutboxOperation): Promise<any> {
    const payloadCopy = op.payload ? JSON.parse(JSON.stringify(op.payload)) : {};
    if (!op.attachments || op.attachments.length === 0) {
      return payloadCopy;
    }

    const uploadUrl =
      op.entity === 'ALERT'
        ? `${environment.apiUrl}/alerts/images?farmId=${encodeURIComponent(op.farmId)}`
        : `${environment.apiUrl}/tasks/images?farmId=${encodeURIComponent(op.farmId)}`;

    const uploadedPaths: string[] = [];
    for (const att of op.attachments) {
      const blob = await this.dataUrlToBlob(att.dataUrl, att.mimeType);
      const formData = new FormData();
      formData.append('file', blob, att.fileName);

      const res = await firstValueFrom(
        this.http.post<{ path: string }>(uploadUrl, formData)
      );
      if (res?.path) {
        uploadedPaths.push(res.path);
      }
    }

    if (op.entity === 'TASK' && op.operation === 'STATUS_CHANGE') {
      payloadCopy.completionImages = [
        ...(payloadCopy.completionImages || []),
        ...uploadedPaths,
      ];
    } else {
      payloadCopy.images = [...(payloadCopy.images || []), ...uploadedPaths];
    }

    return payloadCopy;
  }

  private propagateCreatedId(
    op: OutboxOperation,
    rawResponse: string | null,
    queue: OutboxOperation[]
  ): OutboxOperation[] {
    if (op.operation !== 'CREATE' || !op.localRefId || !rawResponse) {
      return queue;
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      return queue;
    }

    const createdId =
      parsed?.idTask || parsed?.idAlert || parsed?.idCrop || parsed?.id;
    if (!createdId) {
      return queue;
    }

    const realId = String(createdId);
    const localRef = op.localRefId;
    return queue.map((item) => {
      const nextEndpoint = item.endpoint.includes(localRef)
        ? item.endpoint.split(localRef).join(realId)
        : item.endpoint;
      let nextPayload = item.payload;
      if (item.payload) {
        const serialized = JSON.stringify(item.payload);
        if (serialized.includes(localRef)) {
          nextPayload = JSON.parse(serialized.split(localRef).join(realId));
        }
      }
      if (nextEndpoint !== item.endpoint || nextPayload !== item.payload) {
        return { ...item, endpoint: nextEndpoint, payload: nextPayload };
      }
      return item;
    });
  }

  private async executeHttpOperation(
    op: OutboxOperation,
    body: any
  ): Promise<string | null> {
    const url = op.endpoint.startsWith('http')
      ? op.endpoint
      : `${environment.apiUrl}${op.endpoint}`;

    return await firstValueFrom(
      this.http.request(op.method, url, {
        body: op.method === 'DELETE' ? undefined : body,
        responseType: 'text',
      })
    );
  }

  private async dataUrlToBlob(dataUrl: string, mimeType: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    const rawBlob = await res.blob();
    return rawBlob.type === mimeType
      ? rawBlob
      : new Blob([rawBlob], { type: mimeType });
  }

  blobToAttachment(
    blob: Blob,
    fileName: string,
    fieldName = 'file'
  ): Promise<OutboxAttachment> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          fieldName,
          fileName,
          mimeType: blob.type || 'image/jpeg',
          dataUrl: String(reader.result || ''),
        });
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private async updateOperation(
    id: string,
    changes: Partial<OutboxOperation>
  ): Promise<void> {
    const next = this.operationsSubject.value.map((op) =>
      op.id === id ? { ...op, ...changes } : op
    );
    await this.saveQueue(next);
  }

  private async saveQueue(queue: OutboxOperation[]): Promise<void> {
    this.emitQueue(queue);
    try {
      await Preferences.set({
        key: OUTBOX_STORAGE_KEY,
        value: JSON.stringify(queue),
      });
    } catch (err) {
      console.warn('Error persistiendo cola outbox:', err);
    }
  }

  private emitQueue(queue: OutboxOperation[]): void {
    this.operationsSubject.next(queue);
    this.pendingCountSubject.next(queue.length);
  }

  ngOnDestroy(): void {
    this.networkSub.unsubscribe();
    if (this.appStateListener) {
      void this.appStateListener.remove();
    }
  }
}
