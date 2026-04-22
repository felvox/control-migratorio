import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CasosService } from './casos.service';
import {
  Caso,
  DocumentoGenerado,
  EstadoCaso,
  Evidencia,
} from '../../core/models/caso.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-caso-detalle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-grid" *ngIf="caso">
      <div class="header-row">
        <h2>Detalle Caso {{ caso.codigo }}</h2>
        <div style="display: flex; gap: 0.5rem;">
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
        <p>
          <strong>Estado:</strong> {{ caso.estado }} | <strong>Derivación:</strong>
          {{ caso.institucionDerivacion }}
        </p>
        <p>
          <strong>Tipo de control:</strong> {{ caso.tipoControl }} | <strong>Fecha:</strong>
          {{ caso.fechaHoraProcedimiento | date: 'dd/MM/yyyy HH:mm' }}
        </p>
        <p><strong>Lugar:</strong> {{ caso.lugar }}</p>
        <p><strong>Observaciones:</strong> {{ caso.observaciones || 'Sin observaciones' }}</p>
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

      <article class="card" *ngIf="puedeEditar">
        <h3>Estado del caso</h3>
        <form [formGroup]="estadoForm" (ngSubmit)="actualizarEstado()" class="form-grid">
          <div>
            <label>Nuevo estado</label>
            <select formControlName="estado">
              <option value="PENDIENTE">Pendiente</option>
              <option value="DERIVADO_CARABINEROS">Derivado Carabineros</option>
              <option value="DERIVADO_PDI">Derivado PDI</option>
              <option value="CERRADO">Cerrado</option>
            </select>
          </div>
          <div style="align-self: end;">
            <button class="btn-primary">Actualizar estado</button>
          </div>
        </form>
      </article>

      <article class="card">
        <div class="header-row">
          <h3>Documentos generados</h3>
          <button class="btn-primary" *ngIf="puedeEditar" (click)="generarActa()">
            Generar acta PDF
          </button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let doc of documentos">
                <td>{{ doc.nombreOriginal }}</td>
                <td>{{ doc.creadoAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  <button class="btn-secondary" (click)="descargarDocumento(doc)">
                    Descargar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="card">
        <h3>Evidencias</h3>

        <form
          *ngIf="puedeEditar"
          [formGroup]="evidenciaForm"
          class="form-grid"
          (ngSubmit)="subirEvidencia()"
        >
          <div>
            <label>Tipo de evidencia</label>
            <select formControlName="tipoEvidencia">
              <option value="FOTO_PERSONA">Foto persona</option>
              <option value="DOCUMENTO_IDENTIDAD">Documento identidad</option>
              <option value="ADJUNTO_GENERAL">Adjunto general</option>
            </select>
          </div>
          <div>
            <label>Persona asociada (opcional)</label>
            <select formControlName="personaId">
              <option value="">Sin persona</option>
              <option *ngFor="let p of caso.personas" [value]="p.id">
                {{ p.nombres }} {{ p.apellidos }}
              </option>
            </select>
          </div>
          <div>
            <label>Archivo</label>
            <input type="file" (change)="onArchivoChange($event)" />
          </div>
          <div style="align-self: end;">
            <button class="btn-primary" [disabled]="!archivoSeleccionado">
              Subir evidencia
            </button>
          </div>
        </form>

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
      h2,
      h3 {
        margin: 0;
      }

      .header-row {
        display: flex;
        justify-content: space-between;
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
  private readonly fb = inject(FormBuilder);

  caso: Caso | null = null;
  evidencias: Evidencia[] = [];
  documentos: DocumentoGenerado[] = [];
  archivoSeleccionado: File | null = null;

  readonly estadoForm = this.fb.group({
    estado: ['PENDIENTE'],
  });

  readonly evidenciaForm = this.fb.group({
    tipoEvidencia: ['ADJUNTO_GENERAL'],
    personaId: [''],
  });

  get puedeEditar(): boolean {
    return this.authService.hasRole(['ADMINISTRADOR', 'OPERADOR']);
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
      this.estadoForm.patchValue({ estado: caso.estado });
      this.cargarEvidencias();
      this.cargarDocumentos();
    });
  }

  actualizarEstado(): void {
    if (!this.caso) {
      return;
    }

    const estado = this.estadoForm.getRawValue().estado as EstadoCaso;

    this.casosService.cambiarEstado(this.caso.id, estado).subscribe(() => {
      this.cargarCaso(this.caso!.id);
    });
  }

  onArchivoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.archivoSeleccionado = input.files?.[0] ?? null;
  }

  subirEvidencia(): void {
    if (!this.caso || !this.archivoSeleccionado) {
      return;
    }

    const payload = this.evidenciaForm.getRawValue();

    const formData = new FormData();
    formData.append('archivo', this.archivoSeleccionado);
    formData.append('tipoEvidencia', payload.tipoEvidencia ?? 'ADJUNTO_GENERAL');

    if (payload.personaId) {
      formData.append('personaId', payload.personaId);
    }

    this.casosService.subirEvidencia(this.caso.id, formData).subscribe(() => {
      this.archivoSeleccionado = null;
      this.evidenciaForm.patchValue({ personaId: '' });
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

  cargarDocumentos(): void {
    if (!this.caso) {
      return;
    }

    this.casosService.listarDocumentos(this.caso.id).subscribe((items) => {
      this.documentos = items;
    });
  }

  generarActa(): void {
    if (!this.caso) {
      return;
    }

    this.casosService.generarActaPdf(this.caso.id).subscribe(() => {
      this.cargarDocumentos();
    });
  }

  descargarDocumento(doc: DocumentoGenerado): void {
    this.casosService.descargarDocumento(doc.id).subscribe((blob) => {
      this.descargarBlob(blob, doc.nombreOriginal);
    });
  }

  descargarEvidencia(evidencia: Evidencia): void {
    this.casosService.descargarEvidencia(evidencia.id).subscribe((blob) => {
      this.descargarBlob(blob, evidencia.nombreOriginal);
    });
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
