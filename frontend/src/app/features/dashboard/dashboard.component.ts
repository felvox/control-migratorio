import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { DashboardService } from './dashboard.service';
import { AlertModalComponent } from '../../shared/components/alert-modal.component';

type TipoControlDashboard = 'INGRESO' | 'EGRESO';
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
    casosCerrados: number;
  };
  alertas: {
    menoresPendientes: number;
    lesionesRevision: number;
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
  imports: [CommonModule, AlertModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  resumen: DashboardResumen | null = null;
  errorCarga = '';
  alertAvisoAbierto = false;
  alertaAvisoMensaje = '';
  fechaSeleccionada = new Date();

  paginaActual = 1;
  readonly tamPagina = 5;

  readonly chartWidth = 820;
  readonly chartHeight = 320;
  readonly paddingX = 36;
  readonly paddingTop = 20;
  readonly paddingBottom = 32;

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const fechaParam = params.get('fecha') ?? '';
        const fecha = this.parsearFechaIso(fechaParam) ?? new Date();
        this.fechaSeleccionada = fecha;
        this.cargarResumen();
      });
  }

  get fechaSeleccionadaIso(): string {
    const year = this.fechaSeleccionada.getFullYear();
    const month = String(this.fechaSeleccionada.getMonth() + 1).padStart(2, '0');
    const day = String(this.fechaSeleccionada.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  get etiquetaKpiDia(): string {
    const hoy = new Date();
    const esHoy =
      hoy.getFullYear() === this.fechaSeleccionada.getFullYear() &&
      hoy.getMonth() === this.fechaSeleccionada.getMonth() &&
      hoy.getDate() === this.fechaSeleccionada.getDate();

    return esHoy ? 'Actas registradas hoy' : 'Actas del día seleccionado';
  }

  etiquetaTipo(tipo: TipoControlDashboard): string {
    if (tipo === 'INGRESO') {
      return 'Ingresando';
    }
    if (tipo === 'EGRESO') {
      return 'Egresando';
    }
    return 'No informado';
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
    return '#94a3b8';
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
    const inicio = new Date(this.fechaSeleccionada);
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
    const text = (estadoSalud ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    if (!text) {
      return false;
    }

    if (text.includes('sin lesion') || text.includes('no presenta lesion')) {
      return false;
    }

    return text.includes('lesion');
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

  verCaso(id: string): void {
    if (!id) {
      return;
    }

    this.router.navigate(['/casos', id]);
  }

  private cargarResumen(): void {
    this.resumen = null;
    this.errorCarga = '';
    this.dashboardService
      .obtenerResumen(this.fechaSeleccionadaIso)
      .subscribe({
        next: (resumen: DashboardResumen) => {
          this.resumen = resumen;
          this.paginaActual = 1;
        },
        error: () => {
          this.errorCarga = 'No se pudo cargar el panel de control.';
          this.abrirAlertaAviso(this.errorCarga);
        },
      });
  }

  reintentarCarga(): void {
    this.cargarResumen();
  }

  abrirAlertaAviso(mensaje: string): void {
    this.alertaAvisoMensaje = mensaje;
    this.alertAvisoAbierto = true;
  }

  cerrarAlertaAviso(): void {
    this.alertAvisoAbierto = false;
    this.alertaAvisoMensaje = '';
  }

  private parsearFechaIso(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
