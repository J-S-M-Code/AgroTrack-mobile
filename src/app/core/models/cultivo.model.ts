export type TypeCrop =
  | 'FRUIT'
  | 'CEREAL'
  | 'OILSEED'
  | 'FORAGE'
  | 'HORTICULTURAL'
  | 'INDUSTRIAL';

export type PhenologicalState =
  | 'GERMINATION'
  | 'VEGETATIVE_GROWTH'
  | 'FLOWERING'
  | 'MATURITY'
  | 'HARVESTED';

export const TYPE_CROP_LABELS: Record<TypeCrop, string> = {
  FRUIT: 'Frutal',
  CEREAL: 'Cereal',
  OILSEED: 'Oleaginosa',
  FORAGE: 'Forrajero',
  HORTICULTURAL: 'Hortícola',
  INDUSTRIAL: 'Industrial',
};

export const PHENOLOGICAL_STATE_LABELS: Record<PhenologicalState, string> = {
  GERMINATION: 'Germinación',
  VEGETATIVE_GROWTH: 'Crecimiento Vegetativo',
  FLOWERING: 'Floración',
  MATURITY: 'Maduración',
  HARVESTED: 'Cosecha',
};

export const PHENOLOGICAL_STATE_OPTIONS: { value: PhenologicalState; label: string }[] = [
  { value: 'GERMINATION', label: 'Germinación' },
  { value: 'VEGETATIVE_GROWTH', label: 'Crecimiento Vegetativo' },
  { value: 'FLOWERING', label: 'Floración' },
  { value: 'MATURITY', label: 'Maduración' },
  { value: 'HARVESTED', label: 'Cosecha' },
];

export const TYPE_CROP_OPTIONS: { value: TypeCrop; label: string }[] = [
  { value: 'FRUIT', label: 'Frutal' },
  { value: 'CEREAL', label: 'Cereal' },
  { value: 'OILSEED', label: 'Oleaginosa' },
  { value: 'FORAGE', label: 'Forrajero' },
  { value: 'HORTICULTURAL', label: 'Hortícola' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
];

export interface EventoCampo {
  id: number;
  fecha: Date;
  tipo: 'Alerta' | 'Tarea' | 'Comentario';
  descripcion: string;
  autor: string;
}

export interface Cultivo {
  id: string;
  fincaId: string;
  fincaNombre?: string;
  typeCrop: TypeCrop;
  tipoCultivoLabel: string;
  phenologicalState: PhenologicalState;
  estado: string;
  isPerennial: boolean;
  especie: string;
  variedad: string;
  lote: string;
  loteId?: string;
  hectareas: number;
  renspa: string;
  fechaPlantacion: Date;
  fechaCosecha: Date;
  historial: EventoCampo[];
  poligono: [number, number][];
  centroide: [number, number];
}

export interface CropUpsertDto {
  lotId?: string | null;
  typeCrop: TypeCrop;
  species: string;
  variety: string;
  plantingDate: string | null;
  estimateHarvestDate: string | null;
  implantedSurface: number;
  renspa: string;
  phenologicalState: PhenologicalState;
  isPerennial: boolean;
}
