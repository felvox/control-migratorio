import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../core/models/paginated.model';
import { Jaf, Rol } from '../../core/models/auth.model';

export interface AuditoriaItem {
  id: string;
  accion: string;
  entidad: string;
  entidadId?: string;
  descripcion?: string;
  fechaHora: string;
  ip?: string;
  userAgent?: string;
  usuario?: {
    id?: string;
    nombreCompleto: string;
    rol: string;
  };
  caso?: {
    id: string;
    personas: Array<{
      tipoPersona: 'PRINCIPAL' | 'ACOMPANANTE' | 'MENOR';
      nombres: string;
      apellidos: string;
      edad: number;
    }>;
  };
}

export interface AuditoriaFiltros {
  accion?: string;
  entidad?: string;
  usuarioId?: string;
  acciones?: string[];
  entidades?: string[];
  fechaDesde?: string;
  fechaHasta?: string;
  jaf?: Jaf;
  rol?: Rol;
  pagina?: number;
  limite?: number;
}

export interface AuditoriaUsuarioFiltrable {
  id: string;
  nombreCompleto: string;
  rol: Rol;
  jaf: Jaf | null;
  esMaster: boolean;
}

export interface SesionActivaItem {
  id: string;
  inicioSesion: string;
  ultimaActividadAt: string;
  ip?: string | null;
  userAgent?: string | null;
  estado: 'ACTIVO_AHORA' | 'INACTIVO';
  usuario: {
    id: string;
    nombreCompleto: string;
    rol: Rol;
    jaf: Jaf | null;
  };
}

export interface SesionesActivasResponse {
  ventanaActivaMinutos: number;
  totalSesionesAbiertas: number;
  totalActivosAhora: number;
  items: SesionActivaItem[];
}

export interface UsuarioConexionItem {
  usuario: {
    id: string;
    nombreCompleto: string;
    rol: Rol;
    jaf: Jaf | null;
  };
  sesionId: string | null;
  inicioSesion: string | null;
  ultimaActividadAt: string | null;
  estadoConexion: 'ACTIVO' | 'DESCONECTADO';
}

export interface UsuariosConexionResponse {
  ventanaActivaMinutos: number;
  totalUsuarios: number;
  totalActivos: number;
  totalDesconectados: number;
  items: UsuarioConexionItem[];
}

export interface EventosSeguridadPendientesResponse {
  totalPendientes: number;
}

export interface MarcarEventosSeguridadRevisadosResponse {
  totalMarcados: number;
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

  listarUsuariosFiltrables(filtros: { jaf?: Jaf; rol?: Rol } = {}) {
    let params = new HttpParams();

    if (filtros.jaf) {
      params = params.set('jaf', filtros.jaf);
    }

    if (filtros.rol) {
      params = params.set('rol', filtros.rol);
    }

    return this.http.get<AuditoriaUsuarioFiltrable[]>(
      `${this.apiUrl}/auditoria/usuarios-filtrables`,
      { params },
    );
  }

  listarSesionesActivas(filtros: { jaf?: Jaf; rol?: Rol; usuarioId?: string } = {}) {
    let params = new HttpParams();

    if (filtros.jaf) {
      params = params.set('jaf', filtros.jaf);
    }

    if (filtros.rol) {
      params = params.set('rol', filtros.rol);
    }

    if (filtros.usuarioId) {
      params = params.set('usuarioId', filtros.usuarioId);
    }

    return this.http.get<SesionesActivasResponse>(
      `${this.apiUrl}/auditoria/sesiones-activas`,
      { params },
    );
  }

  listarUsuariosConexion(
    filtros: {
      jaf?: Jaf;
      rol?: Rol;
      usuarioId?: string;
      estadoConexion?: 'ACTIVOS' | 'DESCONECTADOS';
    } = {},
  ) {
    let params = new HttpParams();

    if (filtros.jaf) {
      params = params.set('jaf', filtros.jaf);
    }

    if (filtros.rol) {
      params = params.set('rol', filtros.rol);
    }

    if (filtros.usuarioId) {
      params = params.set('usuarioId', filtros.usuarioId);
    }

    if (filtros.estadoConexion) {
      params = params.set('estadoConexion', filtros.estadoConexion);
    }

    return this.http.get<UsuariosConexionResponse>(
      `${this.apiUrl}/auditoria/usuarios-conexion`,
      { params },
    );
  }

  obtenerEventosSeguridadPendientes() {
    return this.http.get<EventosSeguridadPendientesResponse>(
      `${this.apiUrl}/auditoria/eventos-seguridad/resumen`,
    );
  }

  marcarEventosSeguridadRevisados() {
    return this.http.post<MarcarEventosSeguridadRevisadosResponse>(
      `${this.apiUrl}/auditoria/eventos-seguridad/marcar-revisados`,
      {},
    );
  }

  listarEventosSeguridadPendientes(
    estado: 'PENDIENTES' | 'REVISADOS' = 'PENDIENTES',
  ) {
    const params = new HttpParams().set('estado', estado);
    return this.http.get<AuditoriaItem[]>(
      `${this.apiUrl}/auditoria/eventos-seguridad/pendientes`,
      { params },
    );
  }
}
