export type AccionType =
  | 'MAINTENANCE'
  | 'FERTILIZATION'
  | 'FUMIGATION'
  | 'HARVEST'
  | 'IRRIGATION'
  | 'PRUNING';

export type TaskStatus = 'CREATED' | 'IN_PROGESS' | 'FINISH';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type EstadoTareaLabel = 'Pendientes' | 'En Progreso' | 'Completadas';

export type PrioridadTareaLabel = 'Baja' | 'Media' | 'Alta';

export interface AccionTypeOption {
  value: AccionType;
  label: string;
  icon: string;
}

export const ACCION_TYPE_OPTIONS: AccionTypeOption[] = [
  { value: 'MAINTENANCE', label: 'Mantenimiento', icon: 'construct-outline' },
  { value: 'FERTILIZATION', label: 'Fertilización', icon: 'flask-outline' },
  { value: 'FUMIGATION', label: 'Fumigación', icon: 'bug-outline' },
  { value: 'HARVEST', label: 'Cosecha', icon: 'leaf-outline' },
  { value: 'IRRIGATION', label: 'Riego', icon: 'water-outline' },
  { value: 'PRUNING', label: 'Poda', icon: 'cut-outline' },
];

export const TASK_PRIORITY_OPTIONS: { value: TaskPriority; label: PrioridadTareaLabel }[] = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
];

export interface Tarea {
  id: string;
  titulo: string;
  descripcion: string;
  accionType: AccionType;
  accionLabel: string;
  accionIcon: string;
  rawStatus: TaskStatus;
  estado: EstadoTareaLabel;
  rawPriority: TaskPriority;
  prioridad: PrioridadTareaLabel;
  creadorId?: string;
  creador: string;
  responsableId?: string;
  responsable: string;
  fincaId?: string;
  finca: string;
  loteId?: string;
  lote: string;
  fechaCreacion: Date;
  fechaVencimiento: Date;
  fechaFinalizacion?: Date;
  rawImages: string[];
  imagenes: string[];
  poligono?: [number, number][];
  centroide?: [number, number];
  observacionCierre?: string;
  rawImagenesCierre: string[];
  imagenesCierre: string[];
}
