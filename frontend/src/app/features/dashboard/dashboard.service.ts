import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Jaf } from '../../core/models/auth.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  obtenerResumen(fecha?: string) {
    let params = new HttpParams();

    if (fecha) {
      params = params.set('fecha', fecha);
    }

    return this.http.get<any>(`${this.apiUrl}/dashboard/resumen`, { params });
  }

  obtenerMonitoreoMaster(filtros: {
    fechaDesde?: string;
    fechaHasta?: string;
    jaf?: Jaf | '';
  } = {}) {
    let params = new HttpParams();

    if (filtros.fechaDesde) {
      params = params.set('fechaDesde', filtros.fechaDesde);
    }
    if (filtros.fechaHasta) {
      params = params.set('fechaHasta', filtros.fechaHasta);
    }
    if (filtros.jaf) {
      params = params.set('jaf', filtros.jaf);
    }

    return this.http.get<any>(`${this.apiUrl}/dashboard/monitoreo-master`, {
      params,
    });
  }
}
