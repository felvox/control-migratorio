import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Jaf } from '../../core/models/auth.model';

export type FeedbackPrioridad = 'BAJA' | 'MEDIA' | 'ALTA';
export type FeedbackEstado = 'PENDIENTE' | 'REVISADO';
export type FeedbackDireccion = 'A_MASTER' | 'A_OPERATIVOS';

export interface FeedbackItem {
  id: string;
  asunto: string;
  mensaje: string;
  prioridad: FeedbackPrioridad;
  estado: FeedbackEstado;
  direccion: FeedbackDireccion;
  jaf: Jaf;
  jafDestino: Jaf | null;
  creadoAt: string;
  revisadoAt: string | null;
  usuario: {
    id: string;
    nombreCompleto: string;
    run: string;
    jaf: Jaf | null;
  };
  revisadoPor: {
    id: string;
    nombreCompleto: string;
    run: string;
  } | null;
}

export interface FeedbackResponse {
  items: FeedbackItem[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  crear(payload: {
    asunto: string;
    mensaje: string;
    prioridad: FeedbackPrioridad;
    jafDestino?: Jaf;
  }) {
    return this.http.post<FeedbackItem>(`${this.apiUrl}/feedback`, payload);
  }

  listar(filtros: {
    estado?: FeedbackEstado;
    prioridad?: FeedbackPrioridad;
    direccion?: FeedbackDireccion;
    jaf?: Jaf;
    pagina?: number;
    limite?: number;
  } = {}) {
    let params = new HttpParams();
    if (filtros.estado) {
      params = params.set('estado', filtros.estado);
    }
    if (filtros.prioridad) {
      params = params.set('prioridad', filtros.prioridad);
    }
    if (filtros.direccion) {
      params = params.set('direccion', filtros.direccion);
    }
    if (filtros.jaf) {
      params = params.set('jaf', filtros.jaf);
    }
    if (typeof filtros.pagina === 'number') {
      params = params.set('pagina', String(filtros.pagina));
    }
    if (typeof filtros.limite === 'number') {
      params = params.set('limite', String(filtros.limite));
    }

    return this.http.get<FeedbackResponse>(`${this.apiUrl}/feedback`, { params });
  }

  obtenerPendientesCount() {
    return this.http.get<{ total: number }>(`${this.apiUrl}/feedback/pendientes-count`);
  }

  marcarRevisado(id: string) {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/feedback/${id}/revisar`, {});
  }
}
