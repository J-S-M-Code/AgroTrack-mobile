export type UserRole =
  | 'OWNER'
  | 'FOREMAN'
  | 'AGRONOMIST'
  | 'VETERINARIAN'
  | 'APPLICATOR'
  | 'WORKER';

export interface RoleOption {
  value: UserRole;
  label: string;
  category: 'GESTION' | 'TECNICO' | 'OPERATIVO';
  color: string;
  description: string;
}

export const ROLES_OPTIONS: RoleOption[] = [
  {
    value: 'OWNER',
    label: 'Dueño / Propietario',
    category: 'GESTION',
    color: 'primary',
    description: 'Control total de la finca, administración de finanzas y personal.',
  },
  {
    value: 'FOREMAN',
    label: 'Capataz',
    category: 'GESTION',
    color: 'tertiary',
    description: 'Coordinación operativa, asignación y seguimiento de tareas en campo.',
  },
  {
    value: 'AGRONOMIST',
    label: 'Ingeniero Agrónomo',
    category: 'TECNICO',
    color: 'success',
    description: 'Supervisión de cultivos, recetas agronómicas y análisis satelital.',
  },
  {
    value: 'VETERINARIAN',
    label: 'Veterinario',
    category: 'TECNICO',
    color: 'warning',
    description: 'Manejo sanitario animal, caravaneo y control de collares IoT.',
  },
  {
    value: 'APPLICATOR',
    label: 'Aplicador',
    category: 'OPERATIVO',
    color: 'secondary',
    description: 'Ejecución de pulverización, fertilización y labores con maquinaria.',
  },
  {
    value: 'WORKER',
    label: 'Operario de Campo',
    category: 'OPERATIVO',
    color: 'medium',
    description: 'Ejecución de labores generales y reporte de novedades en lote.',
  },
];

export interface Persona {
  id: string;
  nombre: string;
  firstName?: string;
  lastName?: string;
  dni?: string;
  email: string;
  telefono?: string;
  direccion?: string;
  rol: UserRole;
  rolLabel: string;
  categoriaRol: 'GESTION' | 'TECNICO' | 'OPERATIVO';
  estado: 'Activo' | 'Pendiente';
  colorBadge: string;
  fincasAsignadas?: string[];
}

export interface AssignUserDto {
  email: string;
  role: UserRole;
  farmIds: string[];
}

export interface CreatePersonnelDto {
  name: string;
  lastName: string;
  dni: string;
  phone: string;
  address: string;
  email: string;
  password?: string;
  role: UserRole;
  sendEmail: boolean;
}

export interface UpdateAssignmentDto {
  role: UserRole;
  farmIds: string[];
}
