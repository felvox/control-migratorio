import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { DashboardService } from './dashboard.service';

type TipoControlDashboard = 'INGRESO' | 'EGRESO' | 'TERRITORIO';
type EstadoDashboard =
  | 'PENDIENTE'
  | 'DERIVADO_CARABINEROS'
  | 'DERIVADO_PDI'
  | 'CERRADO';
type InstitucionDerivacionDashboard = 'CARABINEROS' | 'PDI' | 'NINGUNA';

interface DashboardResumen {
  totales: {
    dia: number;
    semana: number;
    mes: number;
  };
  tendenciaDiaria: Array<{
    fecha: string;
    etiqueta: string;
    total: number;
  }>;
  porTipoControl: Array<{
    tipo: TipoControlDashboard;
    total: number;
  }>;
  documentacion: {
    si: number;
    no: number;
  };
  topNacionalidades: Array<{
    nacionalidad: string;
    total: number;
  }>;
  personasEtarias: {
    mayores: number;
    menores: number;
  };
  metricasOperativas: {
    actasHoy: number;
    menoresEdad: number;
    noDocumentados: number;
    conLesiones: number;
    pendientesFirma: number;
    casosCerrados: number;
  };
  alertas: {
    menoresPendientes: number;
    lesionesRevision: number;
    actasSinFirma: number;
    sinCierreOperativo: number;
  };
  ultimosCasos: CasoResumen[];
}

interface CasoResumen {
  id: string;
  codigo: string;
  fechaHoraProcedimiento: string;
  tipoControl: TipoControlDashboard;
  documentado: boolean;
  estadoSalud?: string | null;
  estado: EstadoDashboard;
  institucionDerivacion: InstitucionDerivacionDashboard;
  lugar: string;
  personas: Array<{
    tipoPersona: 'PRINCIPAL' | 'ACOMPANANTE' | 'MENOR';
    nombres: string;
    apellidos: string;
    numeroDocumento: string;
    nacionalidad: string;
    edad: number;
  }>;
}

interface FilaCaso {
  id: string;
  codigo: string;
  fechaHora: string;
  nombre: string;
  nacionalidad: string;
  tipoControl: TipoControlDashboard;
  documentado: boolean;
  lesiones: boolean;
  estado: EstadoDashboard;
  derivacion: InstitucionDerivacionDashboard;
}

interface PuntoLinea {
  x: number;
  y: number;
  etiqueta: string;
  total: number;
}

interface BarraNacionalidad {
  nacionalidad: string;
  total: number;
  pct: number;
  placeholder: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-page" *ngIf="resumen as data; else loadingTpl">
      <header class="top-head">
        <div>
          <h1>Panel de Control Migratorio</h1>
          <p>Resumen operativo diario y seguimiento de casos</p>
        </div>

        <div class="date-chip" aria-label="Fecha actual">
          <span class="date-icon">📅</span>
          <span>{{ fechaSeleccionada | date: 'dd "de" MMMM "de" yyyy' : '' : 'es-CL' }}</span>
          <span class="date-caret">▾</span>
        </div>
      </header>

      <section class="kpi-row" aria-label="Métricas principales">
        <article class="kpi-card kpi-blue">
          <div class="kpi-icon">📋</div>
          <div>
            <label>Actas registradas hoy</label>
            <strong>{{ data.metricasOperativas.actasHoy }}</strong>
          </div>
        </article>

        <article class="kpi-card kpi-green">
          <div class="kpi-icon">👶</div>
          <div>
            <label>Menores de edad</label>
            <strong>{{ data.metricasOperativas.menoresEdad }}</strong>
          </div>
        </article>

        <article class="kpi-card kpi-orange">
          <div class="kpi-icon">🪪</div>
          <div>
            <label>No documentados</label>
            <strong>{{ data.metricasOperativas.noDocumentados }}</strong>
          </div>
        </article>

        <article class="kpi-card kpi-red">
          <div class="kpi-icon">➕</div>
          <div>
            <label>Con lesiones</label>
            <strong>{{ data.metricasOperativas.conLesiones }}</strong>
          </div>
        </article>

        <article class="kpi-card kpi-purple">
          <div class="kpi-icon">✍️</div>
          <div>
            <label>Pendientes de firma</label>
            <strong>{{ data.metricasOperativas.pendientesFirma }}</strong>
          </div>
        </article>

        <article class="kpi-card kpi-teal">
          <div class="kpi-icon">✅</div>
          <div>
            <label>Casos cerrados</label>
            <strong>{{ data.metricasOperativas.casosCerrados }}</strong>
          </div>
        </article>
      </section>

      <section class="charts-grid" aria-label="Panel analítico">
        <article class="panel line-panel">
          <div class="panel-head">
            <h3>Actas por día</h3>
            <span class="panel-chip">Últimos 7 días</span>
          </div>

          <div class="line-wrap">
            <svg
              class="line-svg"
              [attr.viewBox]="'0 0 ' + chartWidth + ' ' + chartHeight"
              preserveAspectRatio="none"
            >
              <line
                *ngFor="let level of [0,1,2,3,4]"
                [attr.x1]="paddingX"
                [attr.x2]="chartWidth - paddingX"
                [attr.y1]="yGrid(level)"
                [attr.y2]="yGrid(level)"
                class="grid-line"
              />

              <polyline [attr.points]="linePointsString" class="line-path"></polyline>

              <g *ngFor="let p of linePoints">
                <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3.6" class="line-dot"></circle>
                <text [attr.x]="p.x" [attr.y]="p.y - 8" class="line-value">{{ p.total }}</text>
                <text [attr.x]="p.x" [attr.y]="chartHeight - 7" class="line-label">{{ p.etiqueta }}</text>
              </g>
            </svg>

            <div class="line-empty" *ngIf="!hayTendencia">Sin registros en los últimos 7 días</div>
          </div>
        </article>

        <article class="panel donut-panel">
          <h3>Tipo de situación</h3>
          <div class="donut" [style.background]="donutTipoStyle">
            <div class="donut-center">
              <strong>{{ totalSituacion }}</strong>
              <span>Total</span>
            </div>
          </div>
          <ul class="legend">
            <li *ngFor="let item of data.porTipoControl">
              <span class="dot" [style.background]="colorTipo(item.tipo)"></span>
              {{ etiquetaTipo(item.tipo) }}
              <strong>{{ item.total }} ({{ porcentaje(item.total, totalSituacion) }}%)</strong>
            </li>
          </ul>
        </article>

        <article class="panel donut-panel">
          <h3>Documentado / No documentado</h3>
          <div class="donut" [style.background]="donutDocumentadoStyle">
            <div class="donut-center">
              <strong>{{ totalDocumentacion }}</strong>
              <span>Total</span>
            </div>
          </div>
          <ul class="legend">
            <li>
              <span class="dot" style="background:#3b82f6"></span>
              Documentado
              <strong>{{ data.documentacion.si }} ({{ porcentaje(data.documentacion.si, totalDocumentacion) }}%)</strong>
            </li>
            <li>
              <span class="dot" style="background:#ef4444"></span>
              No documentado
              <strong>{{ data.documentacion.no }} ({{ porcentaje(data.documentacion.no, totalDocumentacion) }}%)</strong>
            </li>
          </ul>
        </article>

        <article class="panel bar-panel">
          <h3>Top nacionalidades</h3>
          <div class="bars">
            <div class="bar-col" *ngFor="let item of topNacionalidadesBars; let i = index">
              <div class="bar-num">{{ item.total }}</div>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  [class.placeholder]="item.placeholder"
                  [style.height.%]="item.pct"
                  [style.background]="item.placeholder ? '#dbe2ea' : colorNacionalidad(i)"
                ></div>
              </div>
              <div class="bar-label">{{ item.nacionalidad }}</div>
            </div>
          </div>
        </article>

        <article class="panel donut-panel">
          <h3>Mayores vs Menores</h3>
          <div class="donut" [style.background]="donutEdadesStyle">
            <div class="donut-center">
              <strong>{{ totalEtario }}</strong>
              <span>Total</span>
            </div>
          </div>
          <ul class="legend">
            <li>
              <span class="dot" style="background:#3b82f6"></span>
              Mayores de edad
              <strong>{{ data.personasEtarias.mayores }} ({{ porcentaje(data.personasEtarias.mayores, totalEtario) }}%)</strong>
            </li>
            <li>
              <span class="dot" style="background:#22c55e"></span>
              Menores de edad
              <strong>{{ data.personasEtarias.menores }} ({{ porcentaje(data.personasEtarias.menores, totalEtario) }}%)</strong>
            </li>
          </ul>
        </article>
      </section>

      <section class="alerts-panel">
        <div class="alerts-head">
          <h3>Alertas críticas</h3>
        </div>

        <div class="alerts-grid">
          <div class="alert-item" *ngFor="let alerta of alertasVista">
            <span>⚠️</span>
            <p>
              <strong>{{ alerta.total }}</strong>
              {{ alerta.texto }}
            </p>
          </div>
        </div>
      </section>

      <section class="table-panel">
        <h3>Últimos casos registrados</h3>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N° Acta</th>
                <th>Fecha / Hora</th>
                <th>Nombre</th>
                <th>Nacionalidad</th>
                <th>Tipo</th>
                <th>Documentado</th>
                <th>Lesiones</th>
                <th>Estado</th>
                <th>Organismo receptor</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="filasTabla.length === 0">
                <td colspan="10" class="table-empty">No hay casos registrados aún.</td>
              </tr>

              <tr *ngFor="let fila of filasPagina">
                <td>{{ fila.codigo }}</td>
                <td>{{ fila.fechaHora | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>{{ fila.nombre }}</td>
                <td>{{ fila.nacionalidad }}</td>
                <td>
                  <span
                    class="badge"
                    [class.badge-blue]="fila.tipoControl === 'INGRESO'"
                    [class.badge-green]="fila.tipoControl === 'EGRESO'"
                    [class.badge-orange]="fila.tipoControl === 'TERRITORIO'"
                  >
                    {{ etiquetaTipo(fila.tipoControl) }}
                  </span>
                </td>
                <td>
                  <span class="badge" [class.badge-green]="fila.documentado" [class.badge-red]="!fila.documentado">
                    {{ fila.documentado ? 'Sí' : 'No' }}
                  </span>
                </td>
                <td>
                  <span class="badge" [class.badge-red]="fila.lesiones" [class.badge-muted]="!fila.lesiones">
                    {{ fila.lesiones ? 'Sí' : 'No' }}
                  </span>
                </td>
                <td>
                  <span
                    class="badge"
                    [class.badge-yellow]="fila.estado === 'PENDIENTE'"
                    [class.badge-blue]="fila.estado === 'DERIVADO_PDI'"
                    [class.badge-purple]="fila.estado === 'DERIVADO_CARABINEROS'"
                    [class.badge-green]="fila.estado === 'CERRADO'"
                  >
                    {{ etiquetaEstado(fila.estado) }}
                  </span>
                </td>
                <td>{{ etiquetaDerivacion(fila.derivacion) }}</td>
                <td><button class="btn-ver" type="button" disabled>Ver</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="table-footer">
          <span>Mostrando {{ filasPagina.length }} de {{ filasTabla.length }} registros</span>
          <div class="pagination" *ngIf="filasTabla.length > tamPagina">
            <button type="button" (click)="irPagina(paginaActual - 1)" [disabled]="paginaActual === 1">‹</button>
            <button
              *ngFor="let p of paginas"
              type="button"
              [class.activo]="p === paginaActual"
              (click)="irPagina(p)"
            >
              {{ p }}
            </button>
            <button type="button" (click)="irPagina(paginaActual + 1)" [disabled]="paginaActual === totalPaginas">›</button>
          </div>
        </div>
      </section>
    </div>

    <ng-template #loadingTpl>
      <div class="loading-state">Cargando panel de control...</div>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .dashboard-page {
        display: grid;
        gap: 0.72rem;
      }

      .top-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.2rem 0.15rem 0.35rem;
      }

      .top-head h1 {
        margin: 0;
        font-size: clamp(1.45rem, 2vw, 2.08rem);
        line-height: 1.1;
        color: #0f172a;
      }

      .top-head p {
        margin: 0.18rem 0 0;
        color: #64748b;
        font-size: 1rem;
      }

      .date-chip {
        border: 1px solid #d9e1eb;
        border-radius: 11px;
        background: #ffffff;
        padding: 0.66rem 0.85rem;
        display: inline-flex;
        align-items: center;
        gap: 0.52rem;
        color: #334155;
        font-weight: 600;
        white-space: nowrap;
      }

      .date-icon,
      .date-caret {
        opacity: 0.72;
      }

      .kpi-row {
        display: grid;
        grid-template-columns: repeat(6, minmax(145px, 1fr));
        gap: 0.55rem;
      }

      .kpi-card {
        position: relative;
        border: 1px solid #d8e0ea;
        border-radius: 12px;
        background: #ffffff;
        padding: 0.6rem 0.7rem;
        display: grid;
        grid-template-columns: 40px 1fr;
        gap: 0.5rem;
        align-items: center;
        box-shadow: 0 2px 5px rgba(15, 23, 42, 0.04);
      }

      .kpi-card::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 4px;
        border-bottom-left-radius: 12px;
        border-bottom-right-radius: 12px;
      }

      .kpi-icon {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        color: #ffffff;
        font-size: 0.95rem;
      }

      .kpi-card label {
        display: block;
        margin-bottom: 0.2rem;
        color: #334155;
        font-size: 0.72rem;
      }

      .kpi-card strong {
        display: block;
        color: #0f172a;
        line-height: 1;
        font-size: 1.85rem;
      }

      .kpi-blue .kpi-icon,
      .kpi-blue::after {
        background: #3b82f6;
      }

      .kpi-green .kpi-icon,
      .kpi-green::after {
        background: #22c55e;
      }

      .kpi-orange .kpi-icon,
      .kpi-orange::after {
        background: #f59e0b;
      }

      .kpi-red .kpi-icon,
      .kpi-red::after {
        background: #ef4444;
      }

      .kpi-purple .kpi-icon,
      .kpi-purple::after {
        background: #8b5cf6;
      }

      .kpi-teal .kpi-icon,
      .kpi-teal::after {
        background: #14b8a6;
      }

      .charts-grid {
        display: grid;
        grid-template-columns: 2.28fr 1fr 1fr 1fr 1fr;
        gap: 0.55rem;
      }

      .panel,
      .alerts-panel,
      .table-panel,
      .loading-state {
        border: 1px solid #d8e0ea;
        border-radius: 12px;
        background: #ffffff;
        padding: 0.7rem 0.72rem;
      }

      .panel h3,
      .alerts-panel h3,
      .table-panel h3 {
        margin: 0;
        color: #1f2f44;
        font-size: 0.9rem;
      }

      .panel-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .panel-chip {
        border: 1px solid #d9e1eb;
        border-radius: 8px;
        background: #f8fafc;
        color: #475569;
        font-size: 0.7rem;
        padding: 0.2rem 0.5rem;
      }

      .line-wrap {
        position: relative;
      }

      .line-svg {
        width: 100%;
        height: 238px;
        border-radius: 8px;
        background: #fcfdff;
      }

      .grid-line {
        stroke: #e2e8f0;
        stroke-width: 1;
        stroke-dasharray: 3 5;
      }

      .line-path {
        fill: none;
        stroke: #2563eb;
        stroke-width: 2.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .line-dot {
        fill: #2563eb;
      }

      .line-value {
        fill: #2563eb;
        font-size: 13px;
        text-anchor: middle;
        font-weight: 700;
      }

      .line-label {
        fill: #64748b;
        font-size: 12px;
        text-anchor: middle;
      }

      .line-empty {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        pointer-events: none;
        color: #64748b;
        font-size: 0.86rem;
      }

      .donut-panel,
      .bar-panel {
        display: grid;
        align-content: start;
        gap: 0.62rem;
      }

      .donut {
        width: min(170px, 100%);
        aspect-ratio: 1 / 1;
        height: auto;
        margin: 0 auto;
        border-radius: 999px;
        position: relative;
      }

      .donut::before {
        content: '';
        position: absolute;
        inset: 22%;
        border-radius: 999px;
        background: #ffffff;
      }

      .donut-center {
        position: absolute;
        inset: 0;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.12rem;
        text-align: center;
      }

      .donut-center strong {
        font-size: 1.7rem;
        line-height: 1;
        color: #111827;
      }

      .donut-center span {
        color: #64748b;
        font-size: 0.83rem;
      }

      .legend {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.26rem;
        color: #334155;
        font-size: 0.73rem;
      }

      .legend li {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 0.36rem;
      }

      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
      }

      .bars {
        min-height: 206px;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        align-items: end;
        gap: 0.45rem;
      }

      .bar-col {
        display: grid;
        gap: 0.35rem;
        justify-items: center;
      }

      .bar-num {
        font-weight: 700;
        color: #334155;
      }

      .bar-track {
        width: 64%;
        height: 135px;
        background: #edf2f7;
        border-radius: 4px;
        position: relative;
        overflow: hidden;
      }

      .bar-fill {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        border-radius: 4px 4px 0 0;
        min-height: 2px;
      }

      .bar-fill.placeholder {
        min-height: 0;
      }

      .bar-label {
        text-align: center;
        color: #475569;
        font-size: 0.68rem;
      }

      .alerts-panel {
        background: #fffaf0;
        border-color: #f1d9ac;
      }

      .alerts-head {
        margin-bottom: 0.5rem;
      }

      .alerts-head h3 {
        color: #b76e05;
      }

      .alerts-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.55rem;
      }

      .alert-item {
        border: 1px solid #efd8ac;
        background: #fffdf8;
        border-radius: 10px;
        padding: 0.54rem 0.62rem;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.45rem;
      }

      .alert-item p {
        margin: 0;
        color: #5b4c33;
        font-size: 0.83rem;
      }

      .alert-item strong {
        color: #d33f2f;
      }

      .table-panel {
        display: grid;
        gap: 0.58rem;
      }

      .table-wrap {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        padding: 0.56rem 0.46rem;
        border-bottom: 1px solid #e5ebf1;
        text-align: left;
        font-size: 0.82rem;
        white-space: nowrap;
      }

      th {
        background: #f8fafc;
        color: #3a4c60;
        font-weight: 700;
      }

      .table-empty {
        text-align: center;
        color: #64748b;
        font-style: italic;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 0.18rem 0.57rem;
        font-size: 0.72rem;
        font-weight: 600;
      }

      .badge-blue {
        background: #e8f1ff;
        color: #2f63c1;
      }

      .badge-green {
        background: #e8f8ee;
        color: #1b7a4a;
      }

      .badge-orange {
        background: #fff3e2;
        color: #ae6f13;
      }

      .badge-red {
        background: #feeceb;
        color: #c73232;
      }

      .badge-purple {
        background: #f1ebff;
        color: #6b46c1;
      }

      .badge-yellow {
        background: #fff8de;
        color: #9a7200;
      }

      .badge-muted {
        background: #edf2f7;
        color: #64748b;
      }

      .btn-ver {
        border: 1px solid #b9d3f7;
        background: #edf4ff;
        color: #2d63c1;
        border-radius: 8px;
        padding: 0.18rem 0.56rem;
        font-weight: 600;
      }

      .table-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.7rem;
        color: #64748b;
        font-size: 0.82rem;
      }

      .pagination {
        display: inline-flex;
        gap: 0.32rem;
      }

      .pagination button {
        border: 1px solid #d6dee9;
        background: #ffffff;
        color: #334155;
        border-radius: 8px;
        min-width: 32px;
        height: 32px;
        font-weight: 600;
      }

      .pagination button.activo {
        border-color: #2563eb;
        background: #2563eb;
        color: #ffffff;
      }

      .pagination button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .loading-state {
        color: #475569;
      }

      @media (max-width: 1024px) {
        .kpi-row {
          grid-template-columns: repeat(3, minmax(180px, 1fr));
        }

        .charts-grid {
          grid-template-columns: repeat(2, minmax(280px, 1fr));
        }

        .line-panel {
          grid-column: 1 / -1;
        }

        .alerts-grid {
          grid-template-columns: repeat(2, minmax(230px, 1fr));
        }
      }

      @media (max-width: 760px) {
        .top-head {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.6rem;
        }

        .kpi-row,
        .charts-grid,
        .alerts-grid {
          grid-template-columns: 1fr;
        }

        .donut {
          width: 185px;
          height: 185px;
        }

        .table-footer {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  resumen: DashboardResumen | null = null;
  fechaSeleccionada = new Date();

  paginaActual = 1;
  readonly tamPagina = 5;

  readonly chartWidth = 820;
  readonly chartHeight = 320;
  readonly paddingX = 36;
  readonly paddingTop = 20;
  readonly paddingBottom = 32;

  ngOnInit(): void {
    this.dashboardService.obtenerResumen().subscribe((resumen: DashboardResumen) => {
      this.resumen = resumen;
      this.paginaActual = 1;
    });
  }

  etiquetaTipo(tipo: TipoControlDashboard): string {
    if (tipo === 'INGRESO') {
      return 'Ingresando';
    }
    if (tipo === 'EGRESO') {
      return 'Egresando';
    }
    return 'En territorio nacional';
  }

  etiquetaEstado(estado: EstadoDashboard): string {
    if (estado === 'PENDIENTE') {
      return 'Pendiente';
    }
    if (estado === 'DERIVADO_CARABINEROS') {
      return 'En revisión';
    }
    if (estado === 'DERIVADO_PDI') {
      return 'Derivado PDI';
    }
    return 'Cerrado';
  }

  etiquetaDerivacion(institucion: InstitucionDerivacionDashboard): string {
    if (institucion === 'CARABINEROS') {
      return 'Carabineros';
    }
    if (institucion === 'PDI') {
      return 'PDI';
    }
    return 'Sin derivación';
  }

  colorTipo(tipo: TipoControlDashboard): string {
    if (tipo === 'INGRESO') {
      return '#3b82f6';
    }
    if (tipo === 'EGRESO') {
      return '#22c55e';
    }
    return '#f59e0b';
  }

  colorNacionalidad(index: number): string {
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'];
    return colors[index % colors.length];
  }

  porcentaje(value: number, total: number): string {
    if (!total) {
      return '0.0';
    }
    return ((value / total) * 100).toFixed(1);
  }

  private conic(values: number[], colors: string[]): string {
    const total = values.reduce((acc, val) => acc + val, 0);
    if (!total) {
      return 'conic-gradient(#e5e7eb 0 100%)';
    }

    let acumulado = 0;
    const parts = values.map((value, index) => {
      const start = (acumulado / total) * 100;
      acumulado += value;
      const end = (acumulado / total) * 100;
      return `${colors[index]} ${start}% ${end}%`;
    });

    return `conic-gradient(${parts.join(',')})`;
  }

  get donutTipoStyle(): string {
    const items = this.resumen?.porTipoControl ?? [];
    return this.conic(
      items.map((item) => item.total),
      items.map((item) => this.colorTipo(item.tipo)),
    );
  }

  get donutDocumentadoStyle(): string {
    return this.conic(
      [this.resumen?.documentacion.si ?? 0, this.resumen?.documentacion.no ?? 0],
      ['#3b82f6', '#ef4444'],
    );
  }

  get donutEdadesStyle(): string {
    return this.conic(
      [
        this.resumen?.personasEtarias.mayores ?? 0,
        this.resumen?.personasEtarias.menores ?? 0,
      ],
      ['#3b82f6', '#22c55e'],
    );
  }

  get totalSituacion(): number {
    return (this.resumen?.porTipoControl ?? []).reduce((acc, item) => acc + item.total, 0);
  }

  get totalDocumentacion(): number {
    const doc = this.resumen?.documentacion;
    return (doc?.si ?? 0) + (doc?.no ?? 0);
  }

  get totalEtario(): number {
    const data = this.resumen?.personasEtarias;
    return (data?.mayores ?? 0) + (data?.menores ?? 0);
  }

  private tendenciaBase(): Array<{ fecha: string; etiqueta: string; total: number }> {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 6);

    return Array.from({ length: 7 }, (_, i) => {
      const fecha = new Date(inicio);
      fecha.setDate(inicio.getDate() + i);

      const dia = `${fecha.getDate()}`.padStart(2, '0');
      const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
      const anio = `${fecha.getFullYear()}`.slice(-2);

      return {
        fecha: fecha.toISOString().slice(0, 10),
        etiqueta: `${dia}/${mes}/${anio}`,
        total: 0,
      };
    });
  }

  get tendenciaSegura(): Array<{ fecha: string; etiqueta: string; total: number }> {
    const tendencia = this.resumen?.tendenciaDiaria ?? [];
    return tendencia.length > 0 ? tendencia : this.tendenciaBase();
  }

  get hayTendencia(): boolean {
    return this.tendenciaSegura.some((item) => item.total > 0);
  }

  yGrid(level: number): number {
    const usable = this.chartHeight - this.paddingTop - this.paddingBottom;
    return this.paddingTop + (usable / 4) * level;
  }

  get linePoints(): PuntoLinea[] {
    const trend = this.tendenciaSegura;
    const maxValue = Math.max(...trend.map((item) => item.total), 1);
    const usableWidth = this.chartWidth - this.paddingX * 2;
    const usableHeight = this.chartHeight - this.paddingTop - this.paddingBottom;

    return trend.map((item, index) => {
      const x = this.paddingX + (index * usableWidth) / Math.max(trend.length - 1, 1);
      const y = this.paddingTop + usableHeight - (item.total / maxValue) * usableHeight;

      return {
        x,
        y,
        etiqueta: item.etiqueta,
        total: item.total,
      };
    });
  }

  get linePointsString(): string {
    return this.linePoints.map((point) => `${point.x},${point.y}`).join(' ');
  }

  get topNacionalidadesBars(): BarraNacionalidad[] {
    const items = (this.resumen?.topNacionalidades ?? []).slice(0, 4);
    while (items.length < 4) {
      items.push({ nacionalidad: 'Sin dato', total: 0 });
    }

    const max = Math.max(...items.map((item) => item.total), 1);

    return items.map((item) => ({
      nacionalidad: item.nacionalidad,
      total: item.total,
      pct: item.total > 0 ? (item.total / max) * 100 : 0,
      placeholder: item.total === 0,
    }));
  }

  private tieneLesion(estadoSalud?: string | null): boolean {
    const text = (estadoSalud ?? '').toLowerCase();
    return text.includes('lesion') || text.includes('lesión');
  }

  get filasTabla(): FilaCaso[] {
    const casos = this.resumen?.ultimosCasos ?? [];

    return casos.map((caso) => {
      const principal = caso.personas.find((p) => p.tipoPersona === 'PRINCIPAL') ?? caso.personas[0];

      return {
        id: caso.id,
        codigo: caso.codigo,
        fechaHora: caso.fechaHoraProcedimiento,
        nombre: principal ? `${principal.nombres} ${principal.apellidos}` : 'Sin registro',
        nacionalidad: principal?.nacionalidad ?? 'No registra',
        tipoControl: caso.tipoControl,
        documentado: caso.documentado,
        lesiones: this.tieneLesion(caso.estadoSalud),
        estado: caso.estado,
        derivacion: caso.institucionDerivacion,
      };
    });
  }

  get alertasVista(): Array<{ total: number; texto: string }> {
    const alertas = this.resumen?.alertas;
    if (!alertas) {
      return [
        { total: 0, texto: 'casos de menor de edad pendientes' },
        { total: 0, texto: 'personas con lesiones requieren revisión' },
        { total: 0, texto: 'actas sin firma de conformidad' },
        { total: 0, texto: 'casos sin cierre operativo' },
      ];
    }

    return [
      { total: alertas.menoresPendientes, texto: 'casos de menor de edad pendientes' },
      { total: alertas.lesionesRevision, texto: 'personas con lesiones requieren revisión' },
      { total: alertas.actasSinFirma, texto: 'actas sin firma de conformidad' },
      { total: alertas.sinCierreOperativo, texto: 'casos sin cierre operativo' },
    ];
  }

  get totalPaginas(): number {
    return Math.max(Math.ceil(this.filasTabla.length / this.tamPagina), 1);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  get filasPagina(): FilaCaso[] {
    const start = (this.paginaActual - 1) * this.tamPagina;
    return this.filasTabla.slice(start, start + this.tamPagina);
  }

  irPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) {
      return;
    }

    this.paginaActual = pagina;
  }
}
