export interface Lot {
  id: string;
  farmId?: string;
  name: string;
  area?: number;
  hectares?: number;
  type?: string;
  soilType?: string;
  description?: string;
  state?: string;
  polygon: any;
  createdAt?: string;
  updatedAt?: string;
}
