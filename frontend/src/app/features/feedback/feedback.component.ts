import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { Jaf } from '../../core/models/auth.model';
import { SidebarCountersService } from '../../core/services/sidebar-counters.service';
import {
  FeedbackEstado,
  FeedbackItem,
  FeedbackPrioridad,
  FeedbackService,
} from './feedback.service';
import { AlertModalComponent } from '../../shared/components/alert-modal.component';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AlertModalComponent],
  templateUrl: './feedback.component.html',
  styleUrl: './feedback.component.css',
})
export class FeedbackComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly feedbackService = inject(FeedbackService);
  private readonly sidebarCountersService = inject(SidebarCountersService);

  readonly formFeedback = this.fb.group({
    asunto: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(120)]],
    mensaje: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(3000)]],
    prioridad: ['MEDIA' as FeedbackPrioridad, [Validators.required]],
    jafDestino: ['' as '' | Jaf],
  });

  readonly estadoOptions: Array<{ value: FeedbackEstado; label: string }> = [
    { value: 'PENDIENTE', label: 'Pendientes' },
    { value: 'REVISADO', label: 'Revisados' },
  ];

  cargando = false;
  guardando = false;
  items: FeedbackItem[] = [];
  total = 0;
  estadoFiltro: FeedbackEstado = 'PENDIENTE';

  alertExitoAbierto = false;
  alertaExitoMensaje = '';
  alertAvisoAbierto = false;
  alertaAvisoMensaje = '';
  modalMensajeAbierto = false;
  feedbackSeleccionado: FeedbackItem | null = null;

  get esMaster(): boolean {
    return Boolean(this.authService.currentUser?.esMaster);
  }

  get textoFormulario(): string {
    return this.esMaster
      ? 'Envía avisos operativos a administradores de una JAF o a todas las JAF.'
      : 'Comparte sugerencias para mejora del sistema con el Administrador General.';
  }

  ngOnInit(): void {
    this.cargar();
  }

  cambiarEstadoFiltro(value: string): void {
    if (value !== 'PENDIENTE' && value !== 'REVISADO') {
      return;
    }

    this.estadoFiltro = value;
    this.cargar();
  }

  enviarFeedback(): void {
    if (this.formFeedback.invalid || this.guardando) {
      this.formFeedback.markAllAsTouched();
      return;
    }

    const raw = this.formFeedback.getRawValue();
    const prioridad = raw.prioridad;
    if (prioridad !== 'BAJA' && prioridad !== 'MEDIA' && prioridad !== 'ALTA') {
      this.abrirAlertaAviso('Prioridad inválida.');
      return;
    }

    const payload: {
      asunto: string;
      mensaje: string;
      prioridad: FeedbackPrioridad;
      jafDestino?: Jaf;
    } = {
      asunto: (raw.asunto ?? '').trim(),
      mensaje: (raw.mensaje ?? '').trim(),
      prioridad,
    };

    if (this.esMaster && raw.jafDestino) {
      payload.jafDestino = raw.jafDestino;
    }

    this.guardando = true;
    this.feedbackService.crear(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.formFeedback.reset({
          asunto: '',
          mensaje: '',
          prioridad: 'MEDIA',
          jafDestino: '',
        });
        this.abrirAlertaExito(
          this.esMaster
            ? 'Aviso enviado a administradores operativos.'
            : 'Feedback enviado al Administrador General.',
        );
        this.sidebarCountersService.solicitarRefresh();
        this.cargar();
      },
      error: (error: HttpErrorResponse) => {
        this.guardando = false;
        this.abrirAlertaAviso(this.getErrorMessage(error));
      },
    });
  }

  puedeMarcarRevisado(item: FeedbackItem): boolean {
    if (item.estado === 'REVISADO') {
      return false;
    }

    if (this.esMaster) {
      return item.direccion === 'A_MASTER';
    }

    return item.direccion === 'A_OPERATIVOS';
  }

  verMensaje(item: FeedbackItem): void {
    this.feedbackSeleccionado = item;
    this.modalMensajeAbierto = true;

    if (!this.puedeMarcarRevisado(item)) {
      return;
    }

    this.feedbackService.marcarRevisado(item.id).subscribe({
      next: () => {
        if (this.feedbackSeleccionado?.id === item.id) {
          this.feedbackSeleccionado = {
            ...this.feedbackSeleccionado,
            estado: 'REVISADO',
            revisadoAt: new Date().toISOString(),
          };
        }
        this.sidebarCountersService.solicitarRefresh();
        this.cargar();
      },
      error: (error: HttpErrorResponse) => {
        this.abrirAlertaAviso(this.getErrorMessage(error));
      },
    });
  }

  etiquetaJaf(jaf: string): string {
    if (jaf === 'TARAPACA') {
      return 'JAF Tarapacá';
    }
    if (jaf === 'ANTOFAGASTA') {
      return 'JAF Antofagasta';
    }
    return 'JAF Arica y Parinacota';
  }

  etiquetaDestino(item: FeedbackItem): string {
    if (item.direccion === 'A_MASTER') {
      return 'Administrador General';
    }

    if (!item.jafDestino) {
      return 'Todas las JAF';
    }

    return this.etiquetaJaf(item.jafDestino);
  }

  etiquetaDireccion(item: FeedbackItem): string {
    return item.direccion === 'A_MASTER' ? 'Sugerencia' : 'Aviso operativo';
  }

  etiquetaPrioridad(prioridad: FeedbackPrioridad): string {
    if (prioridad === 'ALTA') {
      return 'Alta';
    }
    if (prioridad === 'BAJA') {
      return 'Baja';
    }
    return 'Media';
  }

  cerrarModalMensaje(): void {
    this.modalMensajeAbierto = false;
    this.feedbackSeleccionado = null;
  }

  private cargar(): void {
    this.cargando = true;

    this.feedbackService
      .listar({
        estado: this.estadoFiltro,
        pagina: 1,
        limite: 100,
      })
      .subscribe({
        next: (response) => {
          this.items = response.items;
          this.total = response.total;
          this.cargando = false;
        },
        error: (error: HttpErrorResponse) => {
          this.items = [];
          this.total = 0;
          this.cargando = false;
          this.abrirAlertaAviso(this.getErrorMessage(error));
        },
      });
  }

  private abrirAlertaExito(mensaje: string): void {
    this.alertaExitoMensaje = mensaje;
    this.alertExitoAbierto = true;
  }

  private abrirAlertaAviso(mensaje: string): void {
    this.alertaAvisoMensaje = mensaje;
    this.alertAvisoAbierto = true;
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    const message = error.error?.message;
    if (Array.isArray(message)) {
      return message.join('. ');
    }
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
    return 'No fue posible completar la operación.';
  }
}
