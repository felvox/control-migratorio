import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CasosService } from './casos.service';
import { Caso } from '../../core/models/caso.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-casos-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-grid">
      <div class="header-row">
        <h2>Casos</h2>
        <button
          *ngIf="puedeEditar"
          class="btn-primary"
          [routerLink]="['/casos/nuevo']"
        >
          Nuevo caso
        </button>
      </div>

      <article class="card">
        <form [formGroup]="filtrosForm" class="form-grid" (ngSubmit)="buscar()">
          <div>
            <label>Nombre</label>
            <input formControlName="nombre" />
          </div>
          <div>
            <label>Documento</label>
            <input formControlName="documento" />
          </div>
          <div>
            <label>Ubicación</label>
            <input formControlName="ubicacion" />
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
          <div style="align-self: end; display: flex; gap: 0.5rem;">
            <button class="btn-primary">Buscar</button>
            <button type="button" class="btn-secondary" (click)="limpiar()">
              Limpiar
            </button>
          </div>
        </form>
      </article>

      <article class="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Lugar</th>
              <th>Estado</th>
              <th>Principal</th>
              <th>Operador</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let caso of casos">
              <td>{{ caso.codigo }}</td>
              <td>{{ caso.fechaHoraProcedimiento | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ caso.tipoControl }}</td>
              <td>{{ caso.lugar }}</td>
              <td><span class="badge">{{ caso.estado }}</span></td>
              <td>
                {{ obtenerPrincipal(caso).nombres }} {{ obtenerPrincipal(caso).apellidos }}
              </td>
              <td>{{ caso.creadoPor.nombreCompleto }}</td>
              <td>
                <button
                  class="btn-secondary"
                  (click)="verDetalle(caso.id)"
                >
                  Ver
                </button>
                <button
                  class="btn-secondary"
                  *ngIf="puedeEditar"
                  (click)="editar(caso.id)"
                >
                  Editar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  `,
  styles: [
    `
      .header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      h2 {
        margin: 0;
      }

      td:last-child {
        display: flex;
        gap: 0.4rem;
      }
    `,
  ],
})
export class CasosListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly casosService = inject(CasosService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  casos: Caso[] = [];

  get puedeEditar(): boolean {
    return this.authService.hasRole(['ADMINISTRADOR', 'OPERADOR']);
  }

  readonly filtrosForm = this.fb.group({
    nombre: [''],
    documento: [''],
    ubicacion: [''],
    estado: [''],
  });

  ngOnInit(): void {
    this.buscar();
  }

  buscar(): void {
    this.casosService.listar(this.filtrosForm.getRawValue() as any).subscribe((res) => {
      this.casos = res.items;
    });
  }

  limpiar(): void {
    this.filtrosForm.reset({
      nombre: '',
      documento: '',
      ubicacion: '',
      estado: '',
    });
    this.buscar();
  }

  verDetalle(id: string): void {
    this.router.navigate(['/casos', id]);
  }

  editar(id: string): void {
    this.router.navigate(['/casos', id, 'editar']);
  }

  obtenerPrincipal(caso: Caso) {
    return caso.personas[0] ?? { nombres: '-', apellidos: '-' };
  }
}
