import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CasosService } from '../casos/casos.service';
import { Caso } from '../../core/models/caso.model';

@Component({
  selector: 'app-consulta',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-grid">
      <h2>Vista Consulta</h2>
      <p>Acceso de solo lectura para búsqueda y revisión de casos.</p>

      <article class="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Lugar</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let caso of casos">
              <td>{{ caso.codigo }}</td>
              <td>{{ caso.fechaHoraProcedimiento | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ caso.estado }}</td>
              <td>{{ caso.lugar }}</td>
              <td>
                <button class="btn-secondary" [routerLink]="['/casos', caso.id]">
                  Ver detalle
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  `,
})
export class ConsultaComponent implements OnInit {
  private readonly casosService = inject(CasosService);

  casos: Caso[] = [];

  ngOnInit(): void {
    this.casosService.listar().subscribe((response) => {
      this.casos = response.items;
    });
  }
}
