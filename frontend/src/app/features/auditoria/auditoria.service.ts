import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../core/models/paginated.model';

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

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  listar(filtros: Record<string, string | undefined> = {}) {
    let params = new HttpParams();

    Object.entries(filtros).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });

    return this.http.get<PaginatedResponse<AuditoriaItem>>(
      `${this.apiUrl}/auditoria`,
      { params },
    );
  }
}
