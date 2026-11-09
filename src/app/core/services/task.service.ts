import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, throwError } from 'rxjs';
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

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private apiUrl = environment.apiUrl + '/tasks';

  constructor(private http: HttpClient) {}

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
    return this.http.get<any[]>(`${this.apiUrl}/assigned`).pipe(
      map((tasks) => {
        const mapped = (tasks || []).map((t) => this.mapTask(t));
        const filtered = farmId
          ? mapped.filter(
              (t) => !t.fincaId || String(t.fincaId) === String(farmId)
            )
          : mapped;
        return this.sortTasks(filtered);
      })
    );
  }

  getTasksByFarm(farmId: string): Observable<Tarea[]> {
    if (!farmId) return of([]);
    return this.http
      .get<any[]>(`${this.apiUrl}/farm/${encodeURIComponent(farmId)}`)
      .pipe(
        map((tasks) =>
          this.sortTasks((tasks || []).map((t) => this.mapTask(t)))
        )
      );
  }

  getTaskById(taskId: string): Observable<Tarea> {
    if (!taskId) {
      return throwError(() => new Error('Task ID is missing'));
    }
    return this.http
      .get<any>(`${this.apiUrl}/${encodeURIComponent(taskId)}`)
      .pipe(map((t) => this.mapTask(t)));
  }

  createTask(taskDto: any): Observable<Tarea> {
    return this.http
      .post<any>(this.apiUrl, taskDto)
      .pipe(map((t) => this.mapTask(t)));
  }

  updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    completionData?: { completionNotes?: string; completionImages?: string[] }
  ): Observable<boolean> {
    const body = completionData || {};
    return this.http
      .patch(
        `${this.apiUrl}/${encodeURIComponent(taskId)}/status?newStatus=${encodeURIComponent(newStatus)}`,
        body,
        { responseType: 'text' }
      )
      .pipe(map(() => true));
  }

  deleteTask(taskId: string, farmId: string, reason: string): Observable<void> {
    const url = `${this.apiUrl}/${encodeURIComponent(taskId)}?farmId=${encodeURIComponent(farmId)}&reason=${encodeURIComponent(reason || 'Sin motivo')}`;
    return this.http.delete<void>(url);
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
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:')
    ) {
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

  private sortTasks(tasks: Tarea[]): Tarea[] {
    return [...tasks].sort((a, b) => {
      if (a.rawStatus === 'FINISH' && b.rawStatus !== 'FINISH') return 1;
      if (a.rawStatus !== 'FINISH' && b.rawStatus === 'FINISH') return -1;
      return a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime();
    });
  }
}
