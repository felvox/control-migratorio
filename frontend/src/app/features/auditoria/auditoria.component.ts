import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuditoriaItem, AuditoriaService } from './auditoria.service';

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-grid">
      <h2>Auditoría</h2>

      <article class="card">
        <form [formGroup]="filtrosForm" class="form-grid" (ngSubmit)="buscar()">
          <div>
            <label>Acción</label>
            <input formControlName="accion" />
          </div>
          <div>
            <label>Entidad</label>
            <input formControlName="entidad" />
          </div>
          <div style="align-self: end;">
            <button class="btn-primary">Buscar</button>
          </div>
        </form>
      </article>

      <article class="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Acción</th>
              <th>Entidad</th>
              <th>Descripción</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of items">
              <td>{{ item.fechaHora | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ item.accion }}</td>
              <td>{{ item.entidad }}</td>
              <td>{{ item.descripcion || '-' }}</td>
              <td>{{ item.usuario?.nombreCompleto || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  `,
})
export class AuditoriaComponent implements OnInit {
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly fb = inject(FormBuilder);

  items: AuditoriaItem[] = [];

  readonly filtrosForm = this.fb.group({
    accion: [''],
    entidad: [''],
  });

  ngOnInit(): void {
    this.buscar();
  }

  buscar(): void {
    this.auditoriaService
      .listar(this.filtrosForm.getRawValue() as any)
      .subscribe((response) => {
        this.items = response.items;
      });
  }
}
