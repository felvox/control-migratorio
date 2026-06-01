import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CasosService } from './casos.service';
import { Caso } from '../../core/models/caso.model';
import { AuthService } from '../../core/services/auth.service';
import {
  etiquetaEstado as etiquetaEstadoPresentacion,
  etiquetaTipoControl as etiquetaTipoControlPresentacion,
  estadoClase as estadoClasePresentacion,
} from './casos-presentacion.utils';

@Component({
  selector: 'app-casos-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './casos-list.component.html',
  styleUrl: './casos-list.component.css',
})
export class CasosListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly casosService = inject(CasosService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private presetFilters: Record<string, string> = {};

  casos: Caso[] = [];

  get puedeEditar(): boolean {
    return this.authService.hasRole(['ADMINISTRADOR', 'OPERADOR']);
  }

  puedeEditarCaso(caso: Caso): boolean {
    if (!(this.puedeEditar && caso.estado === 'PENDIENTE')) {
      return false;
    }

    const user = this.authService.currentUser;
    return caso.creadoPor?.id === user?.id;
  }

  get esConsultaHistoricaInstitucional(): boolean {
    const rol = this.authService.currentUser?.rol;
    return (
      (rol === 'CARABINEROS' || rol === 'PDI') &&
      this.router.url.split('?')[0] === '/casos'
    );
  }

  get ocultarFiltroEstado(): boolean {
    const ruta = this.router.url.split('?')[0];
    return (
      ruta === '/casos/por-revisar-carabineros' ||
      ruta === '/casos/derivados-pdi' ||
      ruta === '/casos/por-revisar-pdi'
    );
  }

  readonly filtrosForm = this.fb.group({
    nombre: [''],
    documento: [''],
    ubicacion: [''],
    fecha: [''],
    estado: [''],
  });

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.presetFilters = this.normalizarPresetFilters(
        (data?.['presetFilters'] as Record<string, unknown> | undefined) ?? {},
      );
      this.sincronizarFiltrosConVista();
      this.buscar();
    });
  }

  buscar(): void {
    const filtros = this.filtrosForm.getRawValue() as Record<string, string>;
    const payload: Record<string, string> = {
      ...filtros,
      ...this.presetFilters,
    };

    if (this.esConsultaHistoricaInstitucional) {
      delete payload['documento'];
      delete payload['estado'];

      if (filtros['fecha']) {
        payload['fechaDesde'] = this.inicioDiaIso(filtros['fecha']);
        payload['fechaHasta'] = this.finDiaIso(filtros['fecha']);
      }
    }

    delete payload['fecha'];

    this.casosService.listar(payload).subscribe((res) => {
      this.casos = res.items;
    });
  }

  limpiar(): void {
    this.filtrosForm.reset({
      nombre: '',
      documento: '',
      ubicacion: '',
      fecha: '',
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

  etiquetaTipoControl(tipoControl: string): string {
    return etiquetaTipoControlPresentacion(tipoControl);
  }

  etiquetaEstado(estado: string): string {
    const etiqueta = etiquetaEstadoPresentacion(estado);
    return etiqueta.replace('Derivado a ', 'Derivado ');
  }

  estadoClase(estado: string): string {
    return estadoClasePresentacion(estado);
  }

  private normalizarPresetFilters(
    source: Record<string, unknown>,
  ): Record<string, string> {
    const entries = Object.entries(source).flatMap(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return [];
      }

      if (typeof value === 'boolean') {
        return [[key, value ? 'true' : 'false']];
      }

      return [[key, String(value)]];
    });

    return Object.fromEntries(entries);
  }

  private sincronizarFiltrosConVista(): void {
    if (this.esConsultaHistoricaInstitucional) {
      this.filtrosForm.patchValue(
        {
          documento: '',
          estado: '',
        },
        { emitEvent: false },
      );
      return;
    }

    this.filtrosForm.patchValue(
      {
        fecha: '',
      },
      { emitEvent: false },
    );
  }

  private inicioDiaIso(fecha: string): string {
    return new Date(`${fecha}T00:00:00.000`).toISOString();
  }

  private finDiaIso(fecha: string): string {
    return new Date(`${fecha}T23:59:59.999`).toISOString();
  }
}
