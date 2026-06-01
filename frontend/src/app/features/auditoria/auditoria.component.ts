import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { Jaf, Rol } from '../../core/models/auth.model';
import { TrazabilidadUiService } from '../../core/services/trazabilidad-ui.service';
import {
  AuditoriaItem,
  AuditoriaService,
  AuditoriaUsuarioFiltrable,
  UsuarioConexionItem,
  UsuariosConexionResponse,
} from './auditoria.service';

interface AccionFiltro {
  key: string;
  label: string;
  acciones?: string[];
}

const ACCIONES: AccionFiltro[] = [
  { key: 'TODAS', label: 'Todas las acciones' },
  { key: 'LOGIN', label: 'Inicio de sesión', acciones: ['LOGIN'] },
  { key: 'LOGOUT', label: 'Cierre de sesión', acciones: ['LOGOUT'] },
  { key: 'CREAR_CASO', label: 'Crear caso', acciones: ['CREAR_CASO'] },
  { key: 'EDITAR_CASO', label: 'Editar caso', acciones: ['EDITAR_CASO'] },
  {
    key: 'DERIVAR',
    label: 'Derivar caso',
    acciones: ['ENVIAR_CASO_DERIVACION', 'DERIVAR_CASO_A_PDI'],
  },
  { key: 'CERRAR_CASO', label: 'Cerrar caso', acciones: ['CERRAR_CASO_PDI'] },
  {
    key: 'CARGAR_EVIDENCIA',
    label: 'Cargar evidencia',
    acciones: ['CARGAR_EVIDENCIA'],
  },
  {
    key: 'ELIMINAR_EVIDENCIA',
    label: 'Eliminar evidencia',
    acciones: ['ELIMINAR_EVIDENCIA'],
  },
  { key: 'GENERAR_PDF', label: 'Generar PDF', acciones: ['GENERAR_PDF_ACTA'] },
];

const ROLES_USUARIO: Rol[] = [
  'ADMINISTRADOR',
  'OPERADOR',
  'CONSULTA',
  'AUDITOR',
  'CARABINEROS',
  'PDI',
];

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auditoria.component.html',
  styleUrl: './auditoria.component.css',
})
export class AuditoriaComponent implements OnInit {
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly trazabilidadUiService = inject(TrazabilidadUiService);
  private readonly destroyRef = inject(DestroyRef);

  items: AuditoriaItem[] = [];
  usuariosFiltrables: AuditoriaUsuarioFiltrable[] = [];
  usuariosConexion: UsuarioConexionItem[] = [];
  eventosSeguridad: AuditoriaItem[] = [];
  filtroEventosSeguridad: 'PENDIENTES' | 'REVISADOS' = 'PENDIENTES';
  modalUsuariosActivosAbierto = false;
  modalEventosSeguridadAbierto = false;
  cargandoSesionesActivas = false;
  cargandoEventosSeguridad = false;
  resumenSesiones: Pick<
    UsuariosConexionResponse,
    'ventanaActivaMinutos' | 'totalUsuarios' | 'totalActivos' | 'totalDesconectados'
  > = {
    ventanaActivaMinutos: 5,
    totalUsuarios: 0,
    totalActivos: 0,
    totalDesconectados: 0,
  };
  filtroEstadoConexion: 'ACTIVOS' | 'DESCONECTADOS' = 'ACTIVOS';

  readonly roles = ROLES_USUARIO;
  readonly acciones = ACCIONES;

  filtroJaf: Jaf | '' = '';
  filtroRol: Rol | '' = '';
  filtroUsuarioId = '';
  filtroAccionKey = 'TODAS';

  ngOnInit(): void {
    this.trazabilidadUiService.abrirUsuariosActivos$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((estado) => this.abrirModalUsuariosActivos(estado));
    this.trazabilidadUiService.verEventosSeguridad$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.abrirModalEventosSeguridad());

    timer(0, 30000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarEventosSeguridadPendientes());

    this.cargarUsuariosFiltrables();
    this.buscar();
  }

  get accionSeleccionada(): AccionFiltro {
    return this.acciones.find((accion) => accion.key === this.filtroAccionKey) ?? this.acciones[0]!;
  }

  onJafChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.filtroJaf = (target.value as Jaf | '') ?? '';
    this.filtroUsuarioId = '';
    this.cargarUsuariosFiltrables();
    this.buscar();
    this.recargarSesionesActivasSiModalAbierto();
  }

  onRolChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.filtroRol = (target.value as Rol | '') ?? '';
    this.filtroUsuarioId = '';
    this.cargarUsuariosFiltrables();
    this.buscar();
    this.recargarSesionesActivasSiModalAbierto();
  }

  onUsuarioChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.filtroUsuarioId = target.value ?? '';
    this.buscar();
    this.recargarSesionesActivasSiModalAbierto();
  }

  onAccionChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.filtroAccionKey = target.value || 'TODAS';
    this.buscar();
  }

  limpiarFiltros(): void {
    this.filtroJaf = '';
    this.filtroRol = '';
    this.filtroUsuarioId = '';
    this.filtroAccionKey = 'TODAS';
    this.cargarUsuariosFiltrables();
    this.buscar();
    this.recargarSesionesActivasSiModalAbierto();
  }

  buscar(): void {
    this.auditoriaService
      .listar({
        jaf: this.filtroJaf || undefined,
        rol: this.filtroRol || undefined,
        usuarioId: this.filtroUsuarioId || undefined,
        acciones: this.accionSeleccionada.acciones,
      })
      .subscribe((response) => {
        this.items = response.items;
      });
  }

  etiquetaRol(rol: Rol): string {
    if (rol === 'ADMINISTRADOR') {
      return 'Administrador';
    }
    if (rol === 'OPERADOR') {
      return 'Operador';
    }
    if (rol === 'CONSULTA') {
      return 'Consulta';
    }
    if (rol === 'AUDITOR') {
      return 'Auditor';
    }
    if (rol === 'CARABINEROS') {
      return 'Carabineros';
    }
    return 'PDI';
  }

  etiquetaJaf(jaf: Jaf | null): string {
    if (!jaf) {
      return '-';
    }
    if (jaf === 'TARAPACA') {
      return 'JAF Tarapacá';
    }
    if (jaf === 'ANTOFAGASTA') {
      return 'JAF Antofagasta';
    }
    return 'JAF Arica y Parinacota';
  }

  etiquetaUsuarioFiltro(usuario: AuditoriaUsuarioFiltrable): string {
    if (usuario.esMaster) {
      return `${usuario.nombreCompleto} · Administrador Master`;
    }

    return `${usuario.nombreCompleto} · ${this.etiquetaRol(usuario.rol)}`;
  }

  descripcionVisible(item: AuditoriaItem): string {
    const descripcion = item.descripcion?.trim() || '-';
    if (item.accion !== 'CREAR_CASO') {
      return descripcion;
    }

    return descripcion.replace(/\s+creado$/i, '').trim();
  }

  personaInvolucrada(item: AuditoriaItem): string {
    const personas = item.caso?.personas ?? [];
    if (!personas.length) {
      return '-';
    }

    const principal = personas.find((persona) => persona.tipoPersona === 'PRINCIPAL') ?? personas[0]!;
    const nombreCompleto = `${principal.nombres} ${principal.apellidos}`.trim();

    if (!nombreCompleto) {
      return principal.edad >= 18 ? 'Mayor de edad' : 'Menor de edad';
    }

    return principal.edad >= 18
      ? `${nombreCompleto} (Mayor de edad)`
      : `${nombreCompleto} (Menor de edad)`;
  }

  etiquetaEstadoSesion(estado: UsuarioConexionItem['estadoConexion']): string {
    return estado === 'ACTIVO' ? 'Activo' : 'Desconectado';
  }

  etiquetaAccionSeguridad(accion: string): string {
    if (accion === 'LOGIN_FALLIDO') {
      return 'Inicio de sesión fallido';
    }
    if (accion === 'LOGIN_BLOQUEADO_TEMPORAL') {
      return 'Bloqueo temporal de acceso';
    }
    if (accion === 'LOGIN_IP_NUEVA') {
      return 'Acceso desde IP no reconocida';
    }
    return accion;
  }

  ipVisible(ip: string | null | undefined): string {
    if (!ip) {
      return '-';
    }

    if (ip === '::1') {
      return '127.0.0.1';
    }

    if (ip.startsWith('::ffff:')) {
      return ip.slice(7);
    }

    return ip;
  }

  abrirModalUsuariosActivos(estado: 'ACTIVOS' | 'DESCONECTADOS'): void {
    this.filtroEstadoConexion = estado;
    this.modalUsuariosActivosAbierto = true;
    this.cargarSesionesActivas();
  }

  cerrarModalUsuariosActivos(): void {
    this.modalUsuariosActivosAbierto = false;
  }

  recargarSesionesActivas(): void {
    this.cargarSesionesActivas();
  }

  abrirModalEventosSeguridad(): void {
    this.filtroEventosSeguridad = 'PENDIENTES';
    this.modalEventosSeguridadAbierto = true;
    this.cargarEventosSeguridad();
  }

  cerrarModalEventosSeguridad(): void {
    this.modalEventosSeguridadAbierto = false;
  }

  recargarEventosSeguridad(): void {
    this.cargarEventosSeguridad();
  }

  cambiarFiltroEventosSeguridad(estado: 'PENDIENTES' | 'REVISADOS'): void {
    if (this.filtroEventosSeguridad === estado) {
      return;
    }

    this.filtroEventosSeguridad = estado;
    this.cargarEventosSeguridad();
  }

  marcarPendientesComoRevisados(): void {
    if (this.cargandoEventosSeguridad || !this.eventosSeguridad.length) {
      return;
    }

    this.auditoriaService.marcarEventosSeguridadRevisados().subscribe({
      next: () => {
        this.filtroEventosSeguridad = 'REVISADOS';
        this.cargarEventosSeguridad();
        this.cargarEventosSeguridadPendientes();
      },
      error: () => {
        this.cargarEventosSeguridadPendientes();
      },
    });
  }

  private cargarUsuariosFiltrables(): void {
    this.auditoriaService
      .listarUsuariosFiltrables({
        jaf: this.filtroJaf || undefined,
        rol: this.filtroRol || undefined,
      })
      .subscribe((usuarios) => {
        this.usuariosFiltrables = usuarios;
      });
  }

  private cargarSesionesActivas(): void {
    this.cargandoSesionesActivas = true;
    this.auditoriaService
      .listarUsuariosConexion({
        estadoConexion: this.filtroEstadoConexion,
      })
      .subscribe({
        next: (response) => {
          this.usuariosConexion = response.items;
          this.resumenSesiones = {
            ventanaActivaMinutos: response.ventanaActivaMinutos,
            totalUsuarios: response.totalUsuarios,
            totalActivos: response.totalActivos,
            totalDesconectados: response.totalDesconectados,
          };
          this.cargandoSesionesActivas = false;
        },
        error: () => {
          this.usuariosConexion = [];
          this.cargandoSesionesActivas = false;
        },
      });
  }

  private recargarSesionesActivasSiModalAbierto(): void {
    if (!this.modalUsuariosActivosAbierto) {
      return;
    }

    this.cargarSesionesActivas();
  }

  private cargarEventosSeguridad(): void {
    this.cargandoEventosSeguridad = true;
    this.auditoriaService
      .listarEventosSeguridadPendientes(this.filtroEventosSeguridad)
      .subscribe({
      next: (items) => {
        this.eventosSeguridad = items ?? [];
        this.cargandoEventosSeguridad = false;
      },
      error: () => {
        this.eventosSeguridad = [];
        this.cargandoEventosSeguridad = false;
        this.cargarEventosSeguridadPendientes();
      },
    });
  }

  private cargarEventosSeguridadPendientes(): void {
    this.auditoriaService.obtenerEventosSeguridadPendientes().subscribe({
      next: (response) => {
        this.trazabilidadUiService.actualizarEventosSeguridadPendientes(
          response.totalPendientes ?? 0,
        );
      },
      error: () => {
        this.trazabilidadUiService.actualizarEventosSeguridadPendientes(0);
      },
    });
  }

}
