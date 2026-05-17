import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../core/models/paginated.model';

export interface UsuarioListado {
  id: string;
  run: string;
  nombreCompleto: string;
  rol: 'ADMINISTRADOR' | 'OPERADOR' | 'CONSULTA' | 'AUDITOR';
  activo: boolean;
  ultimoAcceso: string | null;
}

export interface UsuarioActualizacion {
  run?: string;
  nombreCompleto?: string;
  rol?: 'ADMINISTRADOR' | 'OPERADOR' | 'CONSULTA' | 'AUDITOR';
  activo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  listar(filtros: { busqueda?: string } = {}) {
    let params = new HttpParams();

    if (filtros.busqueda) {
      params = params.set('busqueda', filtros.busqueda);
    }

    return this.http.get<PaginatedResponse<UsuarioListado>>(
      `${this.apiUrl}/usuarios`,
      { params },
    );
  }

  crear(payload: {
    run: string;
    grado: string;
    nombre: string;
    apellidos: string;
    rol: 'ADMINISTRADOR' | 'OPERADOR' | 'CONSULTA' | 'AUDITOR';
    password: string;
  }) {
    return this.http.post<UsuarioListado>(`${this.apiUrl}/usuarios`, payload);
  }

  desactivar(id: string) {
    return this.http.patch(`${this.apiUrl}/usuarios/${id}/desactivar`, {});
  }

  activar(id: string) {
    return this.http.patch(`${this.apiUrl}/usuarios/${id}/activar`, {});
  }

  resetearPassword(id: string, nuevaPassword: string) {
    return this.http.patch(`${this.apiUrl}/usuarios/${id}/reset-password`, {
      nuevaPassword,
    });
  }

  actualizar(id: string, payload: UsuarioActualizacion) {
    return this.http.patch<UsuarioListado>(`${this.apiUrl}/usuarios/${id}`, payload);
  }

  eliminarLogico(id: string) {
    return this.http.delete<{ id: string; message: string }>(`${this.apiUrl}/usuarios/${id}`);
  }
}
