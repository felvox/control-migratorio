export type Rol = 'ADMINISTRADOR' | 'OPERADOR' | 'CONSULTA';

export interface UsuarioSesion {
  id: string;
  run: string;
  email?: string | null;
  nombreCompleto: string;
  rol: Rol;
}

export interface LoginRequest {
  run: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: UsuarioSesion;
}
