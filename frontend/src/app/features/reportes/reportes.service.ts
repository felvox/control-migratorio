import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type TipoReporte =
  | 'casos-creados'
  | 'casos-carabineros'
  | 'casos-pdi'
  | 'casos-cerrados';

export interface ReportePreviewResponse {
  tipo: TipoReporte;
  total: number;
  columnas: string[];
  filas: string[][];
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  private buildParams(filtros: Record<string, string | undefined>) {
    let params = new HttpParams();
    Object.entries(filtros).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });
    return params;
  }

  exportarExcel(
    tipo: TipoReporte,
    filtros: Record<string, string | undefined>,
  ) {
    return this.http.get(`${this.apiUrl}/reportes/${tipo}/excel`, {
      params: this.buildParams(filtros),
      responseType: 'blob',
    });
  }

  exportarPdf(
    tipo: TipoReporte,
    filtros: Record<string, string | undefined>,
  ) {
    return this.http.get(`${this.apiUrl}/reportes/${tipo}/pdf`, {
      params: this.buildParams(filtros),
      responseType: 'blob',
    });
  }

  obtenerVistaPrevia(
    tipo: TipoReporte,
    filtros: Record<string, string | undefined>,
  ) {
    const params = this.buildParams(filtros).set('tipo', tipo);
    return this.http.get<ReportePreviewResponse>(`${this.apiUrl}/reportes/preview`, {
      params,
    });
  }
}
