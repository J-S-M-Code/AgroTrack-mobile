export type AlertType = 'MANUAL_NOTE' | 'SYSTEM_AUTOMATIC';
export type RecordType = 'NOTE' | 'ALERT';
export type AlertPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PrioridadLabel = 'Baja' | 'Media' | 'Alta' | 'Crítica';
export type TipoNovedadLabel = 'Alerta' | 'Nota';

export interface RelacionNovedad {
  tipo: 'Finca' | 'Lote' | 'Cultivo' | 'Animal';
  id?: string;
  nombre: string;
  ruta: string;
  params?: Record<string, string>;
}

export interface Novedad {
  id: string;
  fecha: Date;
  tipo: TipoNovedadLabel;
  prioridad: PrioridadLabel;
  rawRecordType: RecordType;
  rawPriority: AlertPriority;
  rawAlertType: AlertType;
  origen: string;
  authorId?: string;
  titulo: string;
  descripcion: string;
  imagenes: string[];
  rawImages: string[];
  relatedLotId?: string;
  relatedCropId?: string;
  relatedAnimalId?: string;
  poligono?: [number, number][]; // Coordenadas Leaflet [lat, lng]
  centroide?: [number, number];  // Coordenada puntual GPS [lat, lng]
  relaciones: RelacionNovedad[];
}

export const ALERT_PRIORITY_OPTIONS: { value: AlertPriority; label: PrioridadLabel }[] = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'CRITICAL', label: 'Crítica' },
];
