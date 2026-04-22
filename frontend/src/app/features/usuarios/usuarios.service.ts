import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../core/models/paginated.model';

export interface UsuarioListado {
  id: string;
  run: string;
  email?: string | null;
  nombreCompleto: string;
  rol: 'ADMINISTRADOR' | 'OPERADOR' | 'CONSULTA';
  activo: boolean;
  ultimoAcceso: string | null;
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
    email?: string;
    nombreCompleto: string;
    rol: 'ADMINISTRADOR' | 'OPERADOR' | 'CONSULTA';
    password: string;
  }) {
    return this.http.post<UsuarioListado>(`${this.apiUrl}/usuarios`, payload);
  }

  desactivar(id: string) {
    return this.http.patch(`${this.apiUrl}/usuarios/${id}/desactivar`, {});
  }

  resetearPassword(id: string, nuevaPassword: string) {
    return this.http.patch(`${this.apiUrl}/usuarios/${id}/reset-password`, {
      nuevaPassword,
    });
  }
}
