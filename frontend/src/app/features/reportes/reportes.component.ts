import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ReportesService } from './reportes.service';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-grid">
      <h2>Reportes</h2>

      <article class="card">
        <form [formGroup]="filtrosForm" class="form-grid">
          <div>
            <label>Fecha desde</label>
            <input type="date" formControlName="fechaDesde" />
          </div>
          <div>
            <label>Fecha hasta</label>
            <input type="date" formControlName="fechaHasta" />
          </div>
          <div>
            <label>Estado</label>
            <select formControlName="estado">
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="DERIVADO_CARABINEROS">Derivado Carabineros</option>
              <option value="DERIVADO_PDI">Derivado PDI</option>
              <option value="CERRADO">Cerrado</option>
            </select>
          </div>
          <div>
            <label>Tipo control</label>
            <select formControlName="tipoControl">
              <option value="">Todos</option>
              <option value="INGRESO">Ingreso</option>
              <option value="EGRESO">Egreso</option>
              <option value="TERRITORIO">Territorio</option>
            </select>
          </div>
          <div>
            <label>Nacionalidad</label>
            <input formControlName="nacionalidad" />
          </div>
          <div>
            <label>Ubicación</label>
            <input formControlName="ubicacion" />
          </div>
        </form>

        <div style="display: flex; gap: 0.5rem; margin-top: 0.8rem;">
          <button class="btn-primary" (click)="exportarExcel()">
            Exportar Excel
          </button>
          <button class="btn-secondary" (click)="exportarPdf()">
            Exportar PDF
          </button>
        </div>
      </article>
    </div>
  `,
})
export class ReportesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly reportesService = inject(ReportesService);

  readonly filtrosForm = this.fb.group({
    fechaDesde: [''],
    fechaHasta: [''],
    estado: [''],
    tipoControl: [''],
    nacionalidad: [''],
    ubicacion: [''],
  });

  exportarExcel(): void {
    const filtros = this.obtenerFiltrosSanitizados();
    this.reportesService
      .exportarExcel(filtros)
      .subscribe((blob) => this.descargar(blob, `reporte-casos-${Date.now()}.xlsx`));
  }

  exportarPdf(): void {
    const filtros = this.obtenerFiltrosSanitizados();
    this.reportesService
      .exportarPdf(filtros)
      .subscribe((blob) => this.descargar(blob, `reporte-casos-${Date.now()}.pdf`));
  }

  private obtenerFiltrosSanitizados(): Record<string, string | undefined> {
    const raw = this.filtrosForm.getRawValue();
    const filtros: Record<string, string | undefined> = {};

    Object.entries(raw).forEach(([key, value]) => {
      filtros[key] = value ? String(value) : undefined;
    });

    return filtros;
  }

  private descargar(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
