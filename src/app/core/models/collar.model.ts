export type CollarEstadoLabel = 'Disponible' | 'Asignado' | 'En Reparación';
export type CollarStateBackend = 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE';

export interface Collar {
  id: string;
  rfid: string;
  modelo: string;
  estado: CollarEstadoLabel;
  rawState?: CollarStateBackend;
  bateria: number;
  ultimaSincronizacion?: string;
  assignedAnimalCaravan?: string;
}
