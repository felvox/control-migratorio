import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Jaf } from '../../core/models/auth.model';
import { AuditoriaItem, AuditoriaService } from './auditoria.service';

type FiltroModulo = 'TODOS' | 'CASOS' | 'USUARIOS';
type FiltroAccion = 'TODAS' | 'ACCESOS' | 'CASO_CREA_EDITA' | 'PDF';

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-grid">
      <article class="card filtros-card">
        <div class="filtros-grid">
          <div>
            <label>JAF</label>
            <select [value]="filtroJaf" (change)="onJafChange($event)">
              <option value="">Todas las JAF</option>
              <option value="TARAPACA">JAF Tarapacá</option>
              <option value="ANTOFAGASTA">JAF Antofagasta</option>
              <option value="ARICA_PARINACOTA">JAF Arica y Parinacota</option>
            </select>
          </div>
        </div>

        <div class="chips-block">
          <label>Módulo</label>
          <div class="chips-row">
            <button
              type="button"
              class="chip-btn"
              [class.chip-active]="filtroModulo === 'TODOS'"
              (click)="seleccionarModulo('TODOS')"
            >
              Todos
            </button>
            <button
              type="button"
              class="chip-btn"
              [class.chip-active]="filtroModulo === 'CASOS'"
              (click)="seleccionarModulo('CASOS')"
            >
              Casos
            </button>
            <button
              type="button"
              class="chip-btn"
              [class.chip-active]="filtroModulo === 'USUARIOS'"
              (click)="seleccionarModulo('USUARIOS')"
            >
              Usuarios
            </button>
          </div>
        </div>

        <div class="chips-block">
          <label>Acción</label>
          <div class="chips-row">
            <button
              type="button"
              class="chip-btn"
              [class.chip-active]="filtroAccion === 'TODAS'"
              (click)="seleccionarAccion('TODAS')"
            >
              Todas
            </button>
            <button
              type="button"
              class="chip-btn"
              [class.chip-active]="filtroAccion === 'ACCESOS'"
              (click)="seleccionarAccion('ACCESOS')"
            >
              Accesos (login/logout)
            </button>
            <button
              type="button"
              class="chip-btn"
              [class.chip-active]="filtroAccion === 'CASO_CREA_EDITA'"
              (click)="seleccionarAccion('CASO_CREA_EDITA')"
            >
              Crear/Editar caso
            </button>
            <button
              type="button"
              class="chip-btn"
              [class.chip-active]="filtroAccion === 'PDF'"
              (click)="seleccionarAccion('PDF')"
            >
              Generar/Descargar PDF
            </button>

            <button type="button" class="chip-btn chip-clear" (click)="limpiarFiltros()">
              Limpiar filtros
            </button>
          </div>
        </div>
      </article>

      <article class="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Acción</th>
              <th>Módulo</th>
              <th>Descripción</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of items">
              <td>{{ item.fechaHora | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ etiquetaAccion(item.accion) }}</td>
              <td>{{ etiquetaModulo(item.entidad) }}</td>
              <td>{{ item.descripcion || '-' }}</td>
              <td>{{ item.usuario?.nombreCompleto || '-' }}</td>
            </tr>
            <tr *ngIf="!items.length">
              <td colspan="5" class="empty-cell">No hay actividad para los filtros seleccionados.</td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  `,
  styles: [
    `
      .filtros-card {
        display: grid;
        gap: 0.8rem;
      }

      .filtros-grid {
        display: grid;
        grid-template-columns: minmax(240px, 360px);
        gap: 0.8rem;
      }

      .chips-block {
        display: grid;
        gap: 0.45rem;
      }

      .chips-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .chip-btn {
        border: 1px solid #c6d3e3;
        background: #f7fbff;
        color: #2b425b;
        border-radius: 999px;
        padding: 0.4rem 0.8rem;
        font-size: 0.9rem;
        font-weight: 600;
      }

      .chip-btn:hover {
        background: #eef5ff;
      }

      .chip-btn.chip-active {
        border-color: #2567bd;
        background: #0f5e84;
        color: #ffffff;
      }

      .chip-btn.chip-clear {
        border-color: #cfd8e4;
        background: #ffffff;
        color: #425b75;
      }

      .empty-cell {
        text-align: center;
        color: #647a92;
        padding: 1rem;
      }
    `,
  ],
})
export class AuditoriaComponent implements OnInit {
  private readonly auditoriaService = inject(AuditoriaService);

  items: AuditoriaItem[] = [];
  filtroJaf: Jaf | '' = '';
  filtroModulo: FiltroModulo = 'TODOS';
  filtroAccion: FiltroAccion = 'TODAS';

  ngOnInit(): void {
    this.buscar();
  }

  onJafChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value as Jaf | '';
    this.filtroJaf = value;
    this.buscar();
  }

  seleccionarModulo(modulo: FiltroModulo): void {
    if (this.filtroModulo === modulo) {
      return;
    }
    this.filtroModulo = modulo;
    this.buscar();
  }

  seleccionarAccion(accion: FiltroAccion): void {
    if (this.filtroAccion === accion) {
      return;
    }
    this.filtroAccion = accion;
    this.buscar();
  }

  limpiarFiltros(): void {
    this.filtroJaf = '';
    this.filtroModulo = 'TODOS';
    this.filtroAccion = 'TODAS';
    this.buscar();
  }

  buscar(): void {
    this.auditoriaService
      .listar({
        jaf: this.filtroJaf || undefined,
        entidades: this.entidadesPorModulo(this.filtroModulo),
        acciones: this.accionesPorFiltro(this.filtroAccion),
      })
      .subscribe((response) => {
        this.items = response.items;
      });
  }

  etiquetaModulo(entidad: string): string {
    if (entidad === 'CASO') {
      return 'Casos';
    }
    if (entidad === 'USUARIO') {
      return 'Usuarios';
    }
    if (entidad === 'AUTH') {
      return 'Autenticación';
    }
    if (entidad === 'DOCUMENTO') {
      return 'Documentos';
    }
    if (entidad === 'EVIDENCIA') {
      return 'Evidencias';
    }
    if (entidad === 'REPORTE') {
      return 'Reportes';
    }
    return entidad;
  }

  etiquetaAccion(accion: string): string {
    const mapa: Record<string, string> = {
      LOGIN: 'Inicio de sesión',
      LOGOUT: 'Cierre de sesión',
      CREAR_CASO: 'Crear caso',
      EDITAR_CASO: 'Editar caso',
      GENERAR_PDF_ACTA: 'Generar PDF',
      DESCARGAR_DOCUMENTO: 'Descargar PDF',
    };
    return mapa[accion] ?? accion;
  }

  private entidadesPorModulo(modulo: FiltroModulo): string[] | undefined {
    if (modulo === 'CASOS') {
      return ['CASO'];
    }
    if (modulo === 'USUARIOS') {
      return ['USUARIO'];
    }
    return undefined;
  }

  private accionesPorFiltro(accion: FiltroAccion): string[] | undefined {
    if (accion === 'ACCESOS') {
      return ['LOGIN', 'LOGOUT'];
    }
    if (accion === 'CASO_CREA_EDITA') {
      return ['CREAR_CASO', 'EDITAR_CASO'];
    }
    if (accion === 'PDF') {
      return ['GENERAR_PDF_ACTA', 'DESCARGAR_DOCUMENTO'];
    }
    return undefined;
  }
}
