export interface Animal {
  id: string;
  caravanaVisual: string;
  caravanaSenasa: string;
  rfid: string;
  cuig: string;
  renspaActual: string;
  caravanaInterna: string;
  loteAsignado: string;
  loteId?: string;
  fincaId?: string;
  especie: string;
  raza: string;
  sexo: 'Macho' | 'Hembra';
  categoria: string;
  fechaNacimiento?: Date;
  pesoActual: number;
  active?: boolean;
}
