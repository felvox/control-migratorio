import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Jaf } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import {
  ReportePreviewResponse,
  ReportesService,
  TipoReporte,
} from './reportes.service';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.css',
})
export class ReportesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly reportesService = inject(ReportesService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly tiposReporte: Array<{ value: TipoReporte; label: string }> = [
    { value: 'casos-creados', label: 'Casos creados' },
    { value: 'casos-carabineros', label: 'Casos Carabineros' },
    { value: 'casos-pdi', label: 'Casos PDI' },
    { value: 'casos-cerrados', label: 'Casos cerrados' },
  ];

  readonly filtrosForm = this.fb.group({
    tipoReporte: ['casos-creados'],
    fechaDesde: [''],
    fechaHasta: [''],
    jaf: [''],
    tipoControl: [''],
    conMenores: [''],
  });

  modalSelectorTipoAbierto = true;
  preview: ReportePreviewResponse | null = null;
  cargandoPreview = false;
  errorVistaPrevia = '';
  jafFijaAdminOperativo: Jaf | null = null;

  get tipoReporteSeleccionado(): TipoReporte {
    const value = this.filtrosForm.get('tipoReporte')?.value as TipoReporte | null;
    return value ?? 'casos-creados';
  }

  get etiquetaTipoReporteSeleccionado(): string {
    const item = this.tiposReporte.find(
      (tipo) => tipo.value === this.tipoReporteSeleccionado,
    );
    return item?.label ?? 'Casos creados';
  }

  get esAdminOperativo(): boolean {
    const user = this.authService.currentUser;
    return user?.rol === 'ADMINISTRADOR' && !user.esMaster;
  }

  ngOnInit(): void {
    this.aplicarRestriccionJaf();

    this.filtrosForm.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarVistaPrevia());
  }

  abrirSelectorTipo(): void {
    this.modalSelectorTipoAbierto = true;
  }

  cancelarSelectorTipo(): void {
    this.modalSelectorTipoAbierto = false;
    this.router.navigate(['/dashboard']);
  }

  seleccionarTipoReporte(tipo: TipoReporte): void {
    this.filtrosForm.patchValue({ tipoReporte: tipo });
    this.modalSelectorTipoAbierto = false;
    this.cargarVistaPrevia();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (!this.modalSelectorTipoAbierto) {
      return;
    }

    this.cancelarSelectorTipo();
  }

  exportarExcel(): void {
    const tipo = this.tipoReporteSeleccionado;
    const filtros = this.obtenerFiltrosSanitizados();
    this.reportesService
      .exportarExcel(tipo, filtros)
      .subscribe((blob) => this.descargar(blob, `reporte-${tipo}-${Date.now()}.xlsx`));
  }

  exportarPdf(): void {
    const tipo = this.tipoReporteSeleccionado;
    const filtros = this.obtenerFiltrosSanitizados();
    this.reportesService
      .exportarPdf(tipo, filtros)
      .subscribe((blob) => this.descargar(blob, `reporte-${tipo}-${Date.now()}.pdf`));
  }

  limpiarFiltros(): void {
    const jafDefault = this.jafFijaAdminOperativo ?? '';
    this.filtrosForm.patchValue({
      fechaDesde: '',
      fechaHasta: '',
      jaf: jafDefault,
      tipoControl: '',
      conMenores: '',
    });
  }

  private cargarVistaPrevia(): void {
    if (this.modalSelectorTipoAbierto) {
      return;
    }

    const tipo = this.tipoReporteSeleccionado;
    const filtros = this.obtenerFiltrosSanitizados();
    this.cargandoPreview = true;
    this.errorVistaPrevia = '';

    this.reportesService.obtenerVistaPrevia(tipo, filtros).subscribe({
      next: (response) => {
        this.preview = response;
        this.cargandoPreview = false;
      },
      error: () => {
        this.errorVistaPrevia = 'No fue posible cargar la vista previa con esos filtros.';
        this.cargandoPreview = false;
      },
    });
  }

  private obtenerFiltrosSanitizados(): Record<string, string | undefined> {
    const raw = this.filtrosForm.getRawValue();
    const filtros: Record<string, string | undefined> = {};

    Object.entries(raw).forEach(([key, value]) => {
      if (key === 'tipoReporte') {
        return;
      }
      filtros[key] = value ? String(value) : undefined;
    });

    return filtros;
  }

  private aplicarRestriccionJaf(): void {
    const user = this.authService.currentUser;
    const jafControl = this.filtrosForm.get('jaf');
    if (!jafControl) {
      return;
    }

    if (user?.rol === 'ADMINISTRADOR' && !user.esMaster && user.jaf) {
      this.jafFijaAdminOperativo = user.jaf;
      jafControl.setValue(user.jaf, { emitEvent: false });
      jafControl.disable({ emitEvent: false });
      return;
    }

    this.jafFijaAdminOperativo = null;
    jafControl.enable({ emitEvent: false });
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
