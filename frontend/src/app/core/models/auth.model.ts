export type Rol = 'ADMINISTRADOR' | 'OPERADOR' | 'CONSULTA' | 'AUDITOR';
export type Jaf = 'TARAPACA' | 'ANTOFAGASTA' | 'ARICA_PARINACOTA';

export interface UsuarioSesion {
  id: string;
  run: string;
  nombreCompleto: string;
  rol: Rol;
  esMaster: boolean;
  jaf: Jaf | null;
}

export interface LoginRequest {
  run: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: UsuarioSesion;
}

export interface ChangePasswordRequest {
  passwordActual: string;
  nuevaPassword: string;
}

export interface TransferMasterRequest {
  passwordActual: string;
  targetUserId: string;
}

export interface MasterCandidate {
  id: string;
  run: string;
  nombreCompleto: string;
  rol: Rol;
  esMaster: boolean;
}
