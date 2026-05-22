import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../core/models/paginated.model';
import { Jaf } from '../../core/models/auth.model';

export interface AuditoriaItem {
  id: string;
  accion: string;
  entidad: string;
  entidadId?: string;
  descripcion?: string;
  fechaHora: string;
  usuario?: {
    nombreCompleto: string;
    rol: string;
  };
}

export interface AuditoriaFiltros {
  accion?: string;
  entidad?: string;
  usuarioId?: string;
  acciones?: string[];
  entidades?: string[];
  jaf?: Jaf;
  pagina?: number;
  limite?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  listar(filtros: AuditoriaFiltros = {}) {
    let params = new HttpParams();

    Object.entries(filtros).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          params = params.set(key, value.join(','));
        }
        return;
      }

      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<PaginatedResponse<AuditoriaItem>>(
      `${this.apiUrl}/auditoria`,
      { params },
    );
  }
}
