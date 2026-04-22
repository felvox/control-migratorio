import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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

  exportarExcel(filtros: Record<string, string | undefined>) {
    return this.http.get(`${this.apiUrl}/reportes/casos/excel`, {
      params: this.buildParams(filtros),
      responseType: 'blob',
    });
  }

  exportarPdf(filtros: Record<string, string | undefined>) {
    return this.http.get(`${this.apiUrl}/reportes/casos/pdf`, {
      params: this.buildParams(filtros),
      responseType: 'blob',
    });
  }
}
