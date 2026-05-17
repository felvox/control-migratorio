import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CasosService } from './casos.service';
import {
  Caso,
  Evidencia,
} from '../../core/models/caso.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-caso-detalle',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-grid" *ngIf="caso">
      <div class="header-row">
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn-primary" *ngIf="puedeEditar" (click)="generarActa()">
            Generar PDF
          </button>
          <button
            class="btn-secondary"
            *ngIf="puedeEditar"
            [routerLink]="['/casos', caso.id, 'editar']"
          >
            Editar
          </button>
          <button class="btn-secondary" [routerLink]="['/casos']">Volver</button>
        </div>
      </div>

      <article class="card">
        <h3>Resumen</h3>
        <p><strong>Código:</strong> {{ caso.codigo }}</p>
        <p>
          <strong>Creado por:</strong> {{ caso.creadoPor.nombreCompleto || 'No disponible' }}
          | <strong>Creado el:</strong> {{ caso.creadoAt | date: 'dd/MM/yyyy HH:mm' }}
        </p>
        <p><strong>Estado:</strong> {{ etiquetaEstado(caso.estado) }}</p>
        <p>
          <strong>Tipo de control:</strong> {{ caso.tipoControl }} | <strong>Fecha:</strong>
          {{ caso.fechaHoraProcedimiento | date: 'dd/MM/yyyy HH:mm' }}
        </p>
        <p><strong>Lugar:</strong> {{ caso.lugar }}</p>
        <p><strong>Observaciones:</strong> {{ observacionesLimpias || 'Sin observaciones' }}</p>
      </article>

      <article class="card">
        <h3>Personas</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Nacionalidad</th>
                <th>Edad</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let persona of caso.personas">
                <td>{{ persona.tipoPersona }}</td>
                <td>{{ persona.nombres }} {{ persona.apellidos }}</td>
                <td>{{ persona.numeroDocumento }}</td>
                <td>{{ persona.nacionalidad }}</td>
                <td>{{ persona.edad }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="card">
        <h3>Evidencias</h3>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nombre</th>
                <th>Tamaño</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let evidencia of evidencias">
                <td>{{ evidencia.tipoEvidencia }}</td>
                <td>{{ evidencia.nombreOriginal }}</td>
                <td>{{ evidencia.tamanoBytes | number }} bytes</td>
                <td>{{ evidencia.creadoAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  <button class="btn-secondary" (click)="descargarEvidencia(evidencia)">
                    Descargar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>
  `,
  styles: [
    `
      h3 {
        margin: 0;
      }

      .header-row {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 0.8rem;
      }
    `,
  ],
})
export class CasoDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly casosService = inject(CasosService);
  private readonly authService = inject(AuthService);
  private readonly marcadorConformidad = '[CONFORMIDAD_SISTEMA]';

  caso: Caso | null = null;
  evidencias: Evidencia[] = [];

  get puedeEditar(): boolean {
    return this.authService.hasRole(['ADMINISTRADOR', 'OPERADOR']);
  }

  get observacionesLimpias(): string {
    return this.extraerObservacionesBase(this.caso?.observaciones);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.cargarCaso(id);
  }

  cargarCaso(id: string): void {
    this.casosService.obtenerPorId(id).subscribe((caso) => {
      this.caso = caso;
      this.cargarEvidencias();
    });
  }

  cargarEvidencias(): void {
    if (!this.caso) {
      return;
    }

    this.casosService.listarEvidencias(this.caso.id).subscribe((items) => {
      this.evidencias = items;
    });
  }

  generarActa(): void {
    if (!this.caso) {
      return;
    }

    this.casosService.generarActaPdf(this.caso.id).subscribe((doc) => {
      this.casosService.descargarDocumento(doc.id).subscribe((blob) => {
        this.descargarBlob(blob, doc.nombreOriginal);
      });
    });
  }

  descargarEvidencia(evidencia: Evidencia): void {
    this.casosService.descargarEvidencia(evidencia.id).subscribe((blob) => {
      this.descargarBlob(blob, evidencia.nombreOriginal);
    });
  }

  etiquetaEstado(estado: string): string {
    if (estado === 'DERIVADO_CARABINEROS') {
      return 'Derivado Carabineros';
    }

    if (estado === 'DERIVADO_PDI') {
      return 'Derivado PDI';
    }

    if (estado === 'CERRADO') {
      return 'Cerrado';
    }

    return 'Pendiente';
  }

  private extraerObservacionesBase(observaciones: string | null | undefined): string {
    if (!observaciones) {
      return '';
    }

    const markerIndex = observaciones.indexOf(this.marcadorConformidad);
    if (markerIndex < 0) {
      return observaciones.trim();
    }

    return observaciones.slice(0, markerIndex).trim();
  }

  private descargarBlob(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = nombre;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}
