import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ACCION_TYPE_OPTIONS,
  AccionType,
  EstadoTareaLabel,
  PrioridadTareaLabel,
  Tarea,
  TaskPriority,
  TaskStatus,
} from '../models/tarea.model';
import { OutboxAttachment } from '../models/sync.model';
import { OfflineStorageService } from './offline-storage.service';
import { NetworkService } from './network.service';
import { SyncService } from './sync.service';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private apiUrl = environment.apiUrl + '/tasks';
  private http = inject(HttpClient);
  private storage = inject(OfflineStorageService);
  private network = inject(NetworkService);
  private sync = inject(SyncService);

  getTasksForCurrentContext(
    farmId: string,
    role: string | null
  ): Observable<Tarea[]> {
    if (!farmId) return of([]);
    const isFarmManager = role === 'OWNER' || role === 'FOREMAN';
    if (isFarmManager) {
      return this.getTasksByFarm(farmId);
    }
    return this.getMyAssignedTasks(farmId);
  }

  getMyAssignedTasks(farmId?: string): Observable<Tarea[]> {
    const cacheKey = `tasks_assigned_${farmId || 'all'}`;
    if (!this.network.isOnlineSnapshot) {
      return from(this.storage.getCache<Tarea[]>(cacheKey)).pipe(
        map((cached) => this.reviveDates(cached || []))
      );
    }

    return this.http.get<any[]>(`${this.apiUrl}/assigned`).pipe(
      map((tasks) => {
        const mapped = (tasks || []).map((t) => this.mapTask(t));
        const filtered = farmId
          ? mapped.filter(
              (t) => !t.fincaId || String(t.fincaId) === String(farmId)
            )
          : mapped;
        return this.sortTasks(filtered);
      }),
      tap((sorted) => {
        void this.storage.setCache(cacheKey, sorted);
      }),
      catchError((err) =>
        from(this.storage.getCache<Tarea[]>(cacheKey)).pipe(
          switchMap((cached) =>
            cached ? of(this.reviveDates(cached)) : throwError(() => err)
          )
        )
      )
    );
  }

  getTasksByFarm(farmId: string): Observable<Tarea[]> {
    if (!farmId) return of([]);
    const cacheKey = `tasks_farm_${farmId}`;
    if (!this.network.isOnlineSnapshot) {
      return from(this.storage.getCache<Tarea[]>(cacheKey)).pipe(
        map((cached) => this.reviveDates(cached || []))
      );
    }

    return this.http
      .get<any[]>(`${this.apiUrl}/farm/${encodeURIComponent(farmId)}`)
      .pipe(
        map((tasks) =>
          this.sortTasks((tasks || []).map((t) => this.mapTask(t)))
        ),
        tap((sorted) => {
          void this.storage.setCache(cacheKey, sorted);
        }),
        catchError((err) =>
          from(this.storage.getCache<Tarea[]>(cacheKey)).pipe(
            switchMap((cached) =>
              cached ? of(this.reviveDates(cached)) : throwError(() => err)
            )
          )
        )
      );
  }

  getTaskById(taskId: string): Observable<Tarea> {
    if (!taskId) {
      return throwError(() => new Error('Task ID is missing'));
    }
    const cacheKey = `task_${taskId}`;
    if (!this.network.isOnlineSnapshot) {
      return from(this.storage.getCache<Tarea>(cacheKey)).pipe(
        switchMap((cached) =>
          cached
            ? of(this.reviveDates([cached])[0])
            : throwError(() => new Error('Sin conexión ni tarea en caché'))
        )
      );
    }

    return this.http
      .get<any>(`${this.apiUrl}/${encodeURIComponent(taskId)}`)
      .pipe(
        map((t) => this.mapTask(t)),
        tap((mapped) => {
          void this.storage.setCache(cacheKey, mapped);
        }),
        catchError((err) =>
          from(this.storage.getCache<Tarea>(cacheKey)).pipe(
            switchMap((cached) =>
              cached
                ? of(this.reviveDates([cached])[0])
                : throwError(() => err)
            )
          )
        )
      );
  }

  createTask(
    taskDto: any,
    offlineAttachments?: OutboxAttachment[]
  ): Observable<Tarea> {
    if (!this.network.isOnlineSnapshot) {
      return from(this.enqueueOfflineTaskCreate(taskDto, offlineAttachments));
    }

    return this.http.post<any>(this.apiUrl, taskDto).pipe(
      map((t) => this.mapTask(t)),
      catchError((err) => {
        if ((err?.status ?? 0) === 0) {
          return from(this.enqueueOfflineTaskCreate(taskDto, offlineAttachments));
        }
        return throwError(() => err);
      })
    );
  }

  updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    completionData?: { completionNotes?: string; completionImages?: string[] },
    farmId?: string,
    offlineAttachments?: OutboxAttachment[]
  ): Observable<boolean> {
    const body = completionData || {};
    const endpoint = `/tasks/${encodeURIComponent(taskId)}/status?newStatus=${encodeURIComponent(newStatus)}`;

    if (!this.network.isOnlineSnapshot) {
      return from(
        this.enqueueOfflineTaskStatus(
          taskId,
          newStatus,
          body,
          endpoint,
          farmId || '',
          offlineAttachments
        )
      );
    }

    return this.http
      .patch(`${environment.apiUrl}${endpoint}`, body, { responseType: 'text' })
      .pipe(
        map(() => true),
        catchError((err) => {
          if ((err?.status ?? 0) === 0) {
            return from(
              this.enqueueOfflineTaskStatus(
                taskId,
                newStatus,
                body,
                endpoint,
                farmId || '',
                offlineAttachments
              )
            );
          }
          return throwError(() => err);
        })
      );
  }

  deleteTask(taskId: string, farmId: string, reason: string): Observable<void> {
    const url = `${this.apiUrl}/${encodeURIComponent(taskId)}?farmId=${encodeURIComponent(farmId)}&reason=${encodeURIComponent(reason || 'Sin motivo')}`;
    return this.http.delete<void>(url);
  }

  private reviveDates(tasks: Tarea[]): Tarea[] {
    return tasks.map((t) => ({
      ...t,
      fechaCreacion: t.fechaCreacion ? new Date(t.fechaCreacion) : new Date(),
      fechaVencimiento: t.fechaVencimiento
        ? new Date(t.fechaVencimiento)
        : new Date(),
      fechaFinalizacion: t.fechaFinalizacion
        ? new Date(t.fechaFinalizacion)
        : undefined,
    }));
  }

  private async enqueueOfflineTaskCreate(
    taskDto: any,
    attachments?: OutboxAttachment[]
  ): Promise<Tarea> {
    const farmId = taskDto.relatedFarmId || '';
    const tempId = `offline_task_${Date.now()}`;
    const optimistic = this.mapTask({
      ...taskDto,
      id: tempId,
      creationDate: new Date().toISOString(),
      taskStatus: 'CREATED',
      images: [
        ...(taskDto.images || []),
        ...(attachments?.map((a) => a.dataUrl) || []),
      ],
    });

    if (farmId) {
      for (const key of [`tasks_farm_${farmId}`, `tasks_assigned_${farmId}`]) {
        const current = this.reviveDates(
          (await this.storage.getCache<Tarea[]>(key)) || []
        );
        await this.storage.setCache(key, this.sortTasks([optimistic, ...current]));
      }
    }
    await this.storage.setCache(`task_${tempId}`, optimistic);

    await this.sync.enqueue({
      entity: 'TASK',
      operation: 'CREATE',
      endpoint: '/tasks',
      method: 'POST',
      payload: taskDto,
      attachments,
      farmId,
      description: `Nueva tarea: ${optimistic.titulo}`,
      localRefId: tempId,
    });

    return optimistic;
  }

  private async enqueueOfflineTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    body: any,
    endpoint: string,
    farmId: string,
    attachments?: OutboxAttachment[]
  ): Promise<boolean> {
    const estadoLabel: EstadoTareaLabel =
      newStatus === 'FINISH'
        ? 'Completadas'
        : newStatus === 'IN_PROGESS'
          ? 'En Progreso'
          : 'Pendientes';

    const rawCachedTask = await this.storage.getCache<Tarea>(`task_${taskId}`);
    const cachedTask = rawCachedTask ? this.reviveDates([rawCachedTask])[0] : null;
    const effectiveFarmId = farmId || cachedTask?.fincaId || '';
    const completionUrls = [
      ...(body?.completionImages || []),
      ...(attachments?.map((a) => a.dataUrl) || []),
    ];

    if (cachedTask) {
      await this.storage.setCache(`task_${taskId}`, {
        ...cachedTask,
        rawStatus: newStatus,
        estado: estadoLabel,
        observacionCierre: body?.completionNotes || cachedTask.observacionCierre,
        rawImagenesCierre:
          completionUrls.length > 0
            ? [...(cachedTask.rawImagenesCierre || []), ...completionUrls]
            : cachedTask.rawImagenesCierre,
        imagenesCierre:
          completionUrls.length > 0
            ? [...(cachedTask.imagenesCierre || []), ...completionUrls]
            : cachedTask.imagenesCierre,
        fechaFinalizacion:
          newStatus === 'FINISH' ? new Date() : cachedTask.fechaFinalizacion,
      });
    }

    const keysToUpdate = effectiveFarmId
      ? [`tasks_farm_${effectiveFarmId}`, `tasks_assigned_${effectiveFarmId}`, 'tasks_assigned_all']
      : ['tasks_assigned_all'];

    for (const key of keysToUpdate) {
      const rawCurrent = await this.storage.getCache<Tarea[]>(key);
      if (rawCurrent) {
        const current = this.reviveDates(rawCurrent);
        const updated = current.map((t) =>
          t.id === taskId
            ? {
                ...t,
                rawStatus: newStatus,
                estado: estadoLabel,
                observacionCierre: body?.completionNotes || t.observacionCierre,
                rawImagenesCierre:
                  completionUrls.length > 0
                    ? [...(t.rawImagenesCierre || []), ...completionUrls]
                    : t.rawImagenesCierre,
                imagenesCierre:
                  completionUrls.length > 0
                    ? [...(t.imagenesCierre || []), ...completionUrls]
                    : t.imagenesCierre,
                fechaFinalizacion:
                  newStatus === 'FINISH' ? new Date() : t.fechaFinalizacion,
              }
            : t
        );
        await this.storage.setCache(key, this.sortTasks(updated));
      }
    }

    await this.sync.enqueue({
      entity: 'TASK',
      operation: 'STATUS_CHANGE',
      endpoint,
      method: 'PATCH',
      payload: body,
      attachments,
      farmId: effectiveFarmId,
      description: `Cambio de estado de tarea a ${estadoLabel}`,
    });

    return true;
  }

  uploadTaskImage(
    blob: Blob,
    ext: 'jpg' | 'png' | 'webp',
    farmId: string,
    index = 0
  ): Observable<string> {
    if (!farmId) {
      return throwError(() => new Error('Farm ID is missing'));
    }
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const typedBlob =
      blob.type === mime ? blob : new Blob([blob], { type: mime });

    const formData = new FormData();
    formData.append('file', typedBlob, `tarea_${index + 1}.${ext}`);

    return this.http
      .post<{ path: string }>(
        `${this.apiUrl}/images?farmId=${encodeURIComponent(farmId)}`,
        formData
      )
      .pipe(map((res) => res.path));
  }

  resolveImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    const trimmed = imagePath.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return trimmed;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (environment.minioBaseUrl.includes('/storage/')) {
        try {
          const parsed = new URL(trimmed);
          if (
            parsed.hostname === 'localhost' ||
            parsed.hostname === '127.0.0.1' ||
            parsed.hostname === 'azurite-azuretest' ||
            parsed.port === '10000'
          ) {
            const storageBase =
              environment.minioBaseUrl.split('/storage/')[0] + '/storage';
            return `${storageBase}${parsed.pathname}${parsed.search}`;
          }
        } catch {
          return trimmed;
        }
      }
      return trimmed;
    }
    const baseUrl = environment.minioBaseUrl.endsWith('/')
      ? environment.minioBaseUrl
      : `${environment.minioBaseUrl}/`;
    const cleanPath = trimmed.startsWith('/') ? trimmed.substring(1) : trimmed;
    return `${baseUrl}${cleanPath}`;
  }

  mapTask(t: any): Tarea {
    const accionType: AccionType = t.accionType || 'MAINTENANCE';
    const accionMeta =
      ACCION_TYPE_OPTIONS.find((opt) => opt.value === accionType) ||
      ACCION_TYPE_OPTIONS[0];

    const rawStatus: TaskStatus = t.taskStatus || 'CREATED';
    const estado: EstadoTareaLabel =
      rawStatus === 'FINISH'
        ? 'Completadas'
        : rawStatus === 'IN_PROGESS'
          ? 'En Progreso'
          : 'Pendientes';

    const rawPriority: TaskPriority = t.priority || 'MEDIUM';
    const prioridad: PrioridadTareaLabel =
      rawPriority === 'HIGH'
        ? 'Alta'
        : rawPriority === 'MEDIUM'
          ? 'Media'
          : 'Baja';

    const poligono: [number, number][] | undefined =
      t.polygonLimit?.coordinates && t.polygonLimit.coordinates[0]?.length > 0
        ? t.polygonLimit.coordinates[0].map(
            (c: any) => [c[1], c[0]] as [number, number]
          )
        : undefined;

    const centroide: [number, number] | undefined =
      t.centroid?.coordinates && t.centroid.coordinates.length >= 2
        ? [t.centroid.coordinates[1], t.centroid.coordinates[0]]
        : undefined;

    const rawImages: string[] = (t.images || []).filter(
      (img: string) => !!img
    );
    const rawImagenesCierre: string[] = (t.completionImages || []).filter(
      (img: string) => !!img
    );

    return {
      id: t.idTask || t.id,
      titulo: t.title || 'Sin título',
      descripcion: t.description || 'Sin descripción',
      accionType,
      accionLabel: accionMeta.label,
      accionIcon: accionMeta.icon,
      rawStatus,
      estado,
      rawPriority,
      prioridad,
      creadorId: t.creatorId || undefined,
      creador: t.creatorName || t.creatorId || 'Sistema',
      responsableId: t.assignedId || undefined,
      responsable: t.assignedName || t.assignedId || 'Sin asignar',
      fincaId: t.relatedFarmId || undefined,
      finca: t.farmName || t.relatedFarmId || '',
      loteId: t.relatedLotId || undefined,
      lote: t.lotName || '',
      fechaCreacion: t.creationDate ? new Date(t.creationDate) : new Date(),
      fechaVencimiento: t.dueDate ? new Date(t.dueDate) : new Date(),
      fechaFinalizacion: t.completeDate ? new Date(t.completeDate) : undefined,
      rawImages,
      imagenes: rawImages.map((img) => this.resolveImageUrl(img)),
      poligono,
      centroide,
      observacionCierre: t.completionNotes || undefined,
      rawImagenesCierre,
      imagenesCierre: rawImagenesCierre.map((img) => this.resolveImageUrl(img)),
    };
  }

  private toTimestamp(value?: Date | string | null): number {
    if (!value) return 0;
    const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return isNaN(ms) ? 0 : ms;
  }

  private sortTasks(tasks: Tarea[]): Tarea[] {
    return [...tasks].sort((a, b) => {
      if (a.rawStatus === 'FINISH' && b.rawStatus !== 'FINISH') return 1;
      if (a.rawStatus !== 'FINISH' && b.rawStatus === 'FINISH') return -1;
      return (
        this.toTimestamp(a.fechaVencimiento) -
        this.toTimestamp(b.fechaVencimiento)
      );
    });
  }
}
