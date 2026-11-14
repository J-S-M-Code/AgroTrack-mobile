export interface User {
  id: string;
  idUser?: string;
  name: string;
  lastName?: string;
  email: string;
  role?: string;
  phone?: string;
  address?: string;
  active?: boolean;
}

export interface UpdateProfileDto {
  name: string;
  lastName: string;
  phone?: string;
  address?: string;
}

export interface UpdatePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface UserPreferences {
  unidadSuperficie: 'ha' | 'ac';
  unidadTemperatura: 'C' | 'F';
  altoContraste: boolean;
  notificacionesLocales: boolean;
}
