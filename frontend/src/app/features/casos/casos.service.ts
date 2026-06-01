import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  Caso,
  DocumentoGenerado,
  Evidencia,
  EstadoCaso,
  PdiSituacionMigratoria,
} from '../../core/models/caso.model';
import { PaginatedResponse } from '../../core/models/paginated.model';

export interface CerrarPdiPayload {
  ordenJudicialVigente: boolean;
  situacionMigratoria?: PdiSituacionMigratoria;
  reconducible?: boolean;
  observaciones?: string;
}

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

  recepcionarEnCarabineros(id: string) {
    return this.http.post<Caso>(`${this.apiUrl}/casos/${id}/recepcionar-carabineros`, {});
  }

  derivarDesdeCarabinerosAPdi(id: string) {
    return this.http.post<Caso>(`${this.apiUrl}/casos/${id}/derivar-a-pdi`, {});
  }

  enviarDerivacionPendiente(id: string) {
    return this.http.post<Caso>(`${this.apiUrl}/casos/${id}/enviar-derivacion`, {});
  }

  recepcionarEnPdi(id: string) {
    return this.http.post<Caso>(`${this.apiUrl}/casos/${id}/recepcionar-pdi`, {});
  }

  cerrarEnPdi(id: string, payload: CerrarPdiPayload) {
    return this.http.post<Caso>(`${this.apiUrl}/casos/${id}/cerrar-pdi`, payload);
  }

  agregarObservacionInstitucional(id: string, observacion: string) {
    return this.http.post<{ id: string; observaciones: string | null }>(
      `${this.apiUrl}/casos/${id}/observaciones/institucional`,
      { observacion },
    );
  }

  subirEvidencia(casoId: string, formData: FormData) {
    return this.http.post<Evidencia>(
      `${this.apiUrl}/casos/${casoId}/evidencias`,
      formData,
    );
  }

  convertirWordAPdf(formData: FormData) {
    return this.http.post(`${this.apiUrl}/evidencias/convertir-word-pdf`, formData, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  listarEvidencias(casoId: string) {
    return this.http.get<Evidencia[]>(`${this.apiUrl}/casos/${casoId}/evidencias`);
  }

  descargarEvidencia(id: string) {
    return this.http.get(`${this.apiUrl}/evidencias/${id}/download`, {
      responseType: 'blob',
    });
  }

  eliminarEvidencia(id: string) {
    return this.http.delete<{ id: string }>(`${this.apiUrl}/evidencias/${id}`);
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
