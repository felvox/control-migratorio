import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Caso, DocumentoGenerado, Evidencia, EstadoCaso } from '../../core/models/caso.model';
import { PaginatedResponse } from '../../core/models/paginated.model';

@Injectable({ providedIn: 'root' })
export class CasosService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  listar(filtros: Record<string, string | undefined> = {}) {
    let params = new HttpParams();

    Object.entries(filtros).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });

    return this.http.get<PaginatedResponse<Caso>>(`${this.apiUrl}/casos`, {
      params,
    });
  }

  obtenerPorId(id: string) {
    return this.http.get<Caso>(`${this.apiUrl}/casos/${id}`);
  }

  crear(payload: any) {
    return this.http.post<Caso>(`${this.apiUrl}/casos`, payload);
  }

  actualizar(id: string, payload: any) {
    return this.http.patch<Caso>(`${this.apiUrl}/casos/${id}`, payload);
  }

  cambiarEstado(id: string, estado: EstadoCaso) {
    return this.http.patch(`${this.apiUrl}/casos/${id}/estado`, { estado });
  }

  subirEvidencia(casoId: string, formData: FormData) {
    return this.http.post<Evidencia>(
      `${this.apiUrl}/casos/${casoId}/evidencias`,
      formData,
    );
  }

  listarEvidencias(casoId: string) {
    return this.http.get<Evidencia[]>(`${this.apiUrl}/casos/${casoId}/evidencias`);
  }

  descargarEvidencia(id: string) {
    return this.http.get(`${this.apiUrl}/evidencias/${id}/download`, {
      responseType: 'blob',
    });
  }

  generarActaPdf(casoId: string) {
    return this.http.post<DocumentoGenerado>(
      `${this.apiUrl}/casos/${casoId}/documentos/pdf`,
      {},
    );
  }

  listarDocumentos(casoId: string) {
    return this.http.get<DocumentoGenerado[]>(`${this.apiUrl}/casos/${casoId}/documentos`);
  }

  descargarDocumento(id: string) {
    return this.http.get(`${this.apiUrl}/documentos/${id}/download`, {
      responseType: 'blob',
    });
  }
}
