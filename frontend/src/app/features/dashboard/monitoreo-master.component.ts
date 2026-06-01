import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { Jaf } from '../../core/models/auth.model';
import { DashboardService } from './dashboard.service';

interface MonitoreoTotales {
  creados: number;
  pendientes: number;
  derivadosCarabineros: number;
  derivadosPdi: number;
  porRevisarCarabineros: number;
  porRevisarPdi: number;
  cerrados: number;
  noDocumentados: number;
  conMenores: number;
}

interface MonitoreoResponse {
  generadoAt: string;
  filtros: {
    fechaDesde: string | null;
    fechaHasta: string | null;
    jaf: Jaf | 'TODAS';
  };
  totales: MonitoreoTotales;
  nacionalidadTop: {
    nacionalidad: string;
    total: number;
  };
  porJaf: Array<{ jaf: Jaf } & MonitoreoTotales>;
}

@Component({
  selector: 'app-monitoreo-master',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './monitoreo-master.component.html',
  styleUrl: './monitoreo-master.component.css',
})
export class MonitoreoMasterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly hoyIso = new Date().toISOString().slice(0, 10);

  readonly filtrosForm = this.fb.group({
    fechaDesde: [this.hoyIso],
    fechaHasta: [this.hoyIso],
    jaf: [''],
  });

  cargando = false;
  errorCarga = '';
  data: MonitoreoResponse | null = null;

  ngOnInit(): void {
    this.filtrosForm.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargar());
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtrosForm.reset({
      fechaDesde: this.hoyIso,
      fechaHasta: this.hoyIso,
      jaf: '',
    });
  }

  etiquetaJaf(jaf: Jaf): string {
    if (jaf === 'TARAPACA') {
      return 'JAF Tarapacá';
    }
    if (jaf === 'ANTOFAGASTA') {
      return 'JAF Antofagasta';
    }
    return 'JAF Arica y Parinacota';
  }

  private cargar(): void {
    const raw = this.filtrosForm.getRawValue();
    this.cargando = true;
    this.errorCarga = '';

    this.dashboardService
      .obtenerMonitoreoMaster({
        fechaDesde: raw.fechaDesde || undefined,
        fechaHasta: raw.fechaHasta || undefined,
        jaf: (raw.jaf as Jaf | '') || undefined,
      })
      .subscribe({
        next: (response: MonitoreoResponse) => {
          this.data = response;
          this.cargando = false;
        },
        error: () => {
          this.data = null;
          this.errorCarga = 'No fue posible cargar el monitoreo general.';
          this.cargando = false;
        },
      });
  }
}
