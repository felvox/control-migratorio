import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TrazabilidadUiService } from '../../../core/services/trazabilidad-ui.service';
import { Jaf, MasterCandidate, Rol } from '../../../core/models/auth.model';
import { AlertModalComponent } from '../alert-modal.component';
import { ProgressivePasswordMaskDirective } from '../../directives/progressive-password-mask.directive';
import { CasosService } from '../../../features/casos/casos.service';
import { SidebarCountersService } from '../../../core/services/sidebar-counters.service';
import { forkJoin } from 'rxjs';
import { FeedbackService } from '../../../features/feedback/feedback.service';

type IconoMenu =
  | 'dashboard'
  | 'casos'
  | 'usuarios'
  | 'reportes'
  | 'consulta'
  | 'feedback';
type VistaModalCuenta = 'OPCIONES' | 'PASSWORD' | 'TRANSFER';

interface MenuItem {
  label: string;
  path: string;
  roles: Rol[];
  icon: IconoMenu;
  exact?: boolean;
  dividerBefore?: boolean;
  disabled?: boolean;
  masterOnly?: boolean;
  badgeCount?: number;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AlertModalComponent,
    ProgressivePasswordMaskDirective,
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly trazabilidadUiService = inject(TrazabilidadUiService);
  private readonly casosService = inject(CasosService);
  private readonly sidebarCountersService = inject(SidebarCountersService);
  private readonly feedbackService = inject(FeedbackService);

  sidebarOculta = false;
  menuItemsVisibles: MenuItem[] = [];
  tituloPaginaActual = 'Sistema Web de Control Migratorio';
  esDashboardActivo = false;
  esAuditoriaActiva = false;
  eventosSeguridadPendientes = 0;
  fechaDashboardIso = this.formatearFechaIso(new Date());
  casosPorRevisarCarabineros = 0;
  casosDerivadosPdiCarabineros = 0;
  casosPorRevisarPdi = 0;
  feedbackPendientes = 0;
  modalCambioPasswordAbierto = false;
  vistaModalCuenta: VistaModalCuenta = 'PASSWORD';
  loadingCambioPassword = false;
  loadingTransferMaster = false;
  mostrarPasswordActual = false;
  mostrarPasswordNueva = false;
  mostrarPasswordConfirmar = false;
  targetMasterUserId = '';
  masterCandidates: MasterCandidate[] = [];
  alertPerfilAbierto = false;
  alertPerfilTitulo = 'Notificación';
  alertPerfilMensaje = '';
  alertPerfilTipo: 'success' | 'warning' = 'success';
  private readonly passwordPattern =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/;

  readonly formCambioPassword = this.formBuilder.group({
    passwordActual: ['', [Validators.required]],
    nuevaPassword: ['', [Validators.required, Validators.pattern(this.passwordPattern)]],
    confirmarPassword: ['', [Validators.required]],
  });
  private readonly logoAdminAuditor = '/assets/logo-ejercito-chile.png';
  private readonly logoCarabineros = '/assets/logo-carabineros-chile.svg';
  private readonly logoPdi = '/assets/logo-pdi-chile.png';
  private readonly logosPorJaf: Record<Jaf, string> = {
    TARAPACA: '/assets/JAF_TAPARACA.png',
    ANTOFAGASTA: '/assets/JAF_ANTOFAGASTA.png',
    ARICA_PARINACOTA: '/assets/JAF_ARICA_PARINACOTA.png',
  };

  private readonly menuItems: MenuItem[] = [
    {
      label: 'Inicio',
      path: '/dashboard',
      roles: ['ADMINISTRADOR'],
      icon: 'dashboard',
      exact: true,
    },
    {
      label: 'Monitoreo general',
      path: '/dashboard/monitoreo-master',
      roles: ['ADMINISTRADOR'],
      icon: 'reportes',
      exact: true,
      masterOnly: true,
    },
    {
      label: 'Crear Caso',
      path: '/casos/nuevo',
      roles: ['ADMINISTRADOR', 'OPERADOR'],
      icon: 'casos',
      exact: true,
    },
    {
      label: 'Consultar Casos',
      path: '/casos',
      roles: ['ADMINISTRADOR', 'OPERADOR', 'CONSULTA', 'AUDITOR', 'CARABINEROS', 'PDI'],
      icon: 'casos',
      exact: true,
    },
    {
      label: 'Casos por revisar',
      path: '/casos/por-revisar-carabineros',
      roles: ['CARABINEROS'],
      icon: 'casos',
      exact: true,
    },
    {
      label: 'Casos derivados a PDI',
      path: '/casos/derivados-pdi',
      roles: ['CARABINEROS'],
      icon: 'casos',
      exact: true,
    },
    {
      label: 'Casos por revisar',
      path: '/casos/por-revisar-pdi',
      roles: ['PDI'],
      icon: 'casos',
      exact: true,
    },
    {
      label: 'Gestión de Usuarios',
      path: '/usuarios',
      roles: ['ADMINISTRADOR'],
      icon: 'usuarios',
      dividerBefore: true,
    },
    {
      label: 'Trazabilidad',
      path: '/auditoria',
      roles: ['ADMINISTRADOR'],
      icon: 'reportes',
      masterOnly: true,
    },
    {
      label: 'Reportes',
      path: '/reportes',
      roles: ['ADMINISTRADOR'],
      icon: 'reportes',
    },
    {
      label: 'Feedback',
      path: '/feedback',
      roles: ['ADMINISTRADOR'],
      icon: 'feedback',
      dividerBefore: true,
    },
    {
      label: 'Consulta',
      path: '/consulta',
      roles: ['CONSULTA'],
      icon: 'consulta',
      exact: true,
    },
  ];

  get logoSidebarUrl(): string {
    const rol = this.authService.currentUser?.rol;
    if (rol === 'ADMINISTRADOR' || rol === 'AUDITOR') {
      return this.logoAdminAuditor;
    }

    if (rol === 'CARABINEROS') {
      return this.logoCarabineros;
    }

    if (rol === 'PDI') {
      return this.logoPdi;
    }

    const jaf = this.authService.currentUser?.jaf;
    if (!jaf) {
      return '/assets/logo-corneta.png';
    }

    return this.logosPorJaf[jaf] ?? '/assets/logo-corneta.png';
  }

  get esLogoJaf(): boolean {
    const rol = this.authService.currentUser?.rol;
    return rol !== 'ADMINISTRADOR' && rol !== 'AUDITOR';
  }

  get esPerfilCarabineros(): boolean {
    return this.authService.currentUser?.rol === 'CARABINEROS';
  }

  get esPerfilPdi(): boolean {
    return this.authService.currentUser?.rol === 'PDI';
  }

  get esPerfilAdminAuditor(): boolean {
    const rol = this.authService.currentUser?.rol;
    return rol === 'ADMINISTRADOR' || rol === 'AUDITOR';
  }

  get subtituloSidebar(): string {
    const user = this.authService.currentUser;
    const rol = user?.rol;
    const jaf = this.authService.currentUser?.jaf;

    if (user?.esMaster) {
      return 'ADMINISTRACION GENERAL';
    }

    if ((rol === 'ADMINISTRADOR' || rol === 'AUDITOR') && !jaf) {
      return 'ADMINISTRACION GENERAL';
    }

    return this.etiquetaJaf(jaf);
  }

  get institucionSidebar(): string {
    if (this.authService.currentUser?.rol === 'CARABINEROS') {
      return 'Carabineros de Chile';
    }

    if (this.authService.currentUser?.rol === 'PDI') {
      return 'PDI';
    }

    return '';
  }

  get passwordsNoCoinciden(): boolean {
    const nueva = this.formCambioPassword.get('nuevaPassword')?.value ?? '';
    const confirmar = this.formCambioPassword.get('confirmarPassword')?.value ?? '';
    return Boolean(nueva && confirmar && nueva !== confirmar);
  }

  ngOnInit(): void {
    this.actualizarMenuItemsVisibles();
    this.actualizarContadoresCasosPorRevisar();
    this.actualizarContadorFeedback();
    this.actualizarTituloPagina();

    this.authService.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.actualizarMenuItemsVisibles();
        this.actualizarContadoresCasosPorRevisar();
        this.actualizarContadorFeedback();
      });

    this.sidebarCountersService.refresh$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.actualizarContadoresCasosPorRevisar());
    this.sidebarCountersService.refresh$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.actualizarContadorFeedback());

    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.actualizarTituloPagina();
          this.actualizarContadoresCasosPorRevisar();
          this.actualizarContadorFeedback();
        }
      });

    this.trazabilidadUiService.eventosSeguridadPendientes$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((total) => {
        this.eventosSeguridadPendientes = total;
      });
  }

  toggleSidebar(): void {
    this.sidebarOculta = !this.sidebarOculta;
  }

  onMenuClick(event: Event, item: MenuItem): void {
    if (!item.disabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  abrirModalCambioPassword(): void {
    if (!this.authService.currentUser) {
      return;
    }

    this.modalCambioPasswordAbierto = true;
    this.loadingCambioPassword = false;
    this.mostrarPasswordActual = false;
    this.mostrarPasswordNueva = false;
    this.mostrarPasswordConfirmar = false;
    this.formCambioPassword.reset({
      passwordActual: '',
      nuevaPassword: '',
      confirmarPassword: '',
    });
    this.targetMasterUserId = '';
    this.masterCandidates = [];
    this.loadingTransferMaster = false;
    this.vistaModalCuenta = this.authService.currentUser.esMaster
      ? 'OPCIONES'
      : 'PASSWORD';

    if (this.authService.currentUser.esMaster) {
      this.cargarMasterCandidates();
    }
  }

  cerrarModalCambioPassword(): void {
    if (this.loadingCambioPassword) {
      return;
    }

    this.modalCambioPasswordAbierto = false;
    this.targetMasterUserId = '';
    this.masterCandidates = [];
    this.loadingTransferMaster = false;
    this.vistaModalCuenta = 'PASSWORD';
  }

  cerrarAlertaPerfil(): void {
    this.alertPerfilAbierto = false;
  }

  confirmarCambioPassword(): void {
    if (this.loadingCambioPassword) {
      return;
    }

    this.formCambioPassword.markAllAsTouched();
    if (this.formCambioPassword.invalid) {
      this.abrirAlertaPerfil(
        'Revisa la información',
        'Completa todos los campos y valida la nueva contraseña.',
        'warning',
      );
      return;
    }

    if (this.passwordsNoCoinciden) {
      this.abrirAlertaPerfil(
        'Revisa la información',
        'La confirmación no coincide con la nueva contraseña.',
        'warning',
      );
      return;
    }

    const passwordActual = this.formCambioPassword.get('passwordActual')?.value ?? '';
    const nuevaPassword = this.formCambioPassword.get('nuevaPassword')?.value ?? '';

    this.loadingCambioPassword = true;
    this.authService
      .changePassword({ passwordActual, nuevaPassword })
      .subscribe({
        next: () => {
          this.loadingCambioPassword = false;
          this.modalCambioPasswordAbierto = false;
          this.abrirAlertaPerfil(
            'Contraseña actualizada',
            'Tu nueva contraseña fue guardada correctamente.',
            'success',
          );
        },
        error: (error: HttpErrorResponse) => {
          this.loadingCambioPassword = false;
          const backendMessage =
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'No fue posible actualizar la contraseña. Intenta nuevamente.';
          this.abrirAlertaPerfil('Acción no completada', backendMessage, 'warning');
        },
      });
  }

  confirmarTransferMaster(): void {
    if (this.loadingTransferMaster || this.loadingCambioPassword) {
      return;
    }

    const passwordActual = this.formCambioPassword.get('passwordActual')?.value ?? '';
    if (!passwordActual) {
      this.abrirAlertaPerfil(
        'Revisa la información',
        'Ingresa tu contraseña actual para traspasar la cuenta master.',
        'warning',
      );
      return;
    }

    if (!this.targetMasterUserId) {
      this.abrirAlertaPerfil(
        'Revisa la información',
        'Selecciona un usuario destino para traspasar la cuenta master.',
        'warning',
      );
      return;
    }

    this.loadingTransferMaster = true;
    this.authService
      .transferMaster({
        passwordActual,
        targetUserId: this.targetMasterUserId,
      })
      .subscribe({
        next: (response) => {
          this.loadingTransferMaster = false;
          this.modalCambioPasswordAbierto = false;
          this.targetMasterUserId = '';
          this.masterCandidates = [];
          this.abrirAlertaPerfil(
            'Traspaso completado',
            `${response.message || 'La cuenta master fue transferida correctamente.'} Se cerrará tu sesión automáticamente.`,
            'success',
          );
          setTimeout(() => {
            this.authService.logout().subscribe(() => {
              this.router.navigate(['/login']);
            });
          }, 900);
        },
        error: (error: HttpErrorResponse) => {
          this.loadingTransferMaster = false;
          const backendMessage =
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'No fue posible traspasar la cuenta master. Intenta nuevamente.';
          this.abrirAlertaPerfil('Acción no completada', backendMessage, 'warning');
        },
      });
  }

  abrirVistaCambioPassword(): void {
    this.vistaModalCuenta = 'PASSWORD';
  }

  abrirVistaTransferMaster(): void {
    this.vistaModalCuenta = 'TRANSFER';
    if (!this.masterCandidates.length) {
      this.cargarMasterCandidates();
    }
  }

  volverOpcionesCuenta(): void {
    if (this.authService.currentUser?.esMaster) {
      this.vistaModalCuenta = 'OPCIONES';
      return;
    }
    this.vistaModalCuenta = 'PASSWORD';
  }

  private actualizarMenuItemsVisibles(): void {
    const rolActual = this.authService.currentUser?.rol;

    if (!rolActual) {
      this.menuItemsVisibles = [];
      return;
    }

    let menuPorRol: MenuItem[] = [];

    if (rolActual === 'ADMINISTRADOR') {
      menuPorRol = this.getMenuByPaths([
        '/dashboard',
        '/dashboard/monitoreo-master',
        '/casos/nuevo',
        '/casos',
        '/usuarios',
        '/auditoria',
        '/reportes',
        '/feedback',
      ]);
    } else if (rolActual === 'OPERADOR') {
      menuPorRol = this.getMenuByPaths(['/casos/nuevo', '/casos']);
    } else if (rolActual === 'CARABINEROS') {
      menuPorRol = this.getMenuByPaths([
        '/casos/por-revisar-carabineros',
        '/casos/derivados-pdi',
        '/casos',
      ]);
    } else if (rolActual === 'PDI') {
      menuPorRol = this.getMenuByPaths(['/casos/por-revisar-pdi', '/casos']);
    } else if (rolActual === 'AUDITOR') {
      menuPorRol = this.getMenuByPaths(['/casos']);
    } else {
      menuPorRol = this.getMenuByPaths(['/consulta']);
    }

    this.menuItemsVisibles = menuPorRol;
  }

  private actualizarContadoresCasosPorRevisar(): void {
    const rolActual = this.authService.currentUser?.rol;

    if (rolActual === 'CARABINEROS') {
      forkJoin({
        porRevisar: this.casosService.listar({
          estado: 'DERIVADO_CARABINEROS',
          institucionDerivacion: 'CARABINEROS',
          pagina: '1',
          limite: '1',
        }),
        derivadosPdi: this.casosService.listar({
          estado: 'DERIVADO_PDI',
          institucionDerivacion: 'PDI',
          existenMenores: 'true',
          pagina: '1',
          limite: '1',
        }),
      })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: ({ porRevisar, derivadosPdi }) => {
            this.casosPorRevisarCarabineros = porRevisar.total ?? 0;
            this.casosDerivadosPdiCarabineros = derivadosPdi.total ?? 0;
            this.actualizarMenuItemsVisibles();
          },
          error: () => {
            this.casosPorRevisarCarabineros = 0;
            this.casosDerivadosPdiCarabineros = 0;
            this.actualizarMenuItemsVisibles();
          },
        });
      return;
    }

    if (rolActual === 'PDI') {
      this.casosService
        .listar({
          estado: 'DERIVADO_PDI',
          institucionDerivacion: 'PDI',
          pagina: '1',
          limite: '1',
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (respuesta) => {
            this.casosPorRevisarPdi = respuesta.total ?? 0;
            this.actualizarMenuItemsVisibles();
          },
          error: () => {
            this.casosPorRevisarPdi = 0;
            this.actualizarMenuItemsVisibles();
          },
        });
      return;
    }

    this.casosPorRevisarCarabineros = 0;
    this.casosDerivadosPdiCarabineros = 0;
    this.casosPorRevisarPdi = 0;
    this.actualizarMenuItemsVisibles();
  }

  private actualizarTituloPagina(): void {
    const rutaActiva = this.obtenerRutaActiva(this.activatedRoute);
    const titulo = rutaActiva.snapshot.data?.['pageTitle'];
    this.tituloPaginaActual =
      typeof titulo === 'string' && titulo.trim().length > 0
        ? titulo
        : 'Sistema Web de Control Migratorio';

    this.esDashboardActivo = rutaActiva.routeConfig?.path === 'dashboard';
    this.esAuditoriaActiva = rutaActiva.routeConfig?.path === 'auditoria';
    if (!this.esDashboardActivo) {
      return;
    }

    const fechaParam = rutaActiva.snapshot.queryParamMap.get('fecha') ?? '';
    const fechaNormalizada = this.normalizarFechaIso(fechaParam);
    this.fechaDashboardIso = fechaNormalizada ?? this.formatearFechaIso(new Date());
  }

  private obtenerRutaActiva(route: ActivatedRoute): ActivatedRoute {
    let actual = route;

    while (actual.firstChild) {
      actual = actual.firstChild;
    }

    return actual;
  }

  private getMenuByPaths(paths: string[]): MenuItem[] {
    return paths
      .map((path) => this.menuItems.find((item) => item.path === path))
      .filter((item): item is MenuItem => Boolean(item))
      .filter((item) => this.authService.hasRole(item.roles))
      .filter((item) => !item.masterOnly || Boolean(this.authService.currentUser?.esMaster))
      .map((item) => this.withMenuLabel(item));
  }

  private withMenuLabel(item: MenuItem): MenuItem {
    if (item.path === '/casos/por-revisar-carabineros') {
      return {
        ...item,
        label: 'Casos por revisar',
        badgeCount:
          this.casosPorRevisarCarabineros > 0
            ? this.casosPorRevisarCarabineros
            : undefined,
      };
    }

    if (item.path === '/casos/por-revisar-pdi') {
      return {
        ...item,
        label: 'Casos por revisar',
        badgeCount: this.casosPorRevisarPdi > 0 ? this.casosPorRevisarPdi : undefined,
      };
    }

    if (item.path === '/casos/derivados-pdi') {
      return {
        ...item,
        label: 'Casos derivados a PDI',
        badgeCount:
          this.casosDerivadosPdiCarabineros > 0
            ? this.casosDerivadosPdiCarabineros
            : undefined,
      };
    }

    if (item.path === '/feedback') {
      return {
        ...item,
        badgeCount: this.feedbackPendientes > 0 ? this.feedbackPendientes : undefined,
      };
    }

    return item;
  }

  private actualizarContadorFeedback(): void {
    const rolActual = this.authService.currentUser?.rol;
    if (rolActual !== 'ADMINISTRADOR') {
      this.feedbackPendientes = 0;
      this.actualizarMenuItemsVisibles();
      return;
    }

    this.feedbackService
      .obtenerPendientesCount()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.feedbackPendientes = response.total ?? 0;
          this.actualizarMenuItemsVisibles();
        },
        error: () => {
          this.feedbackPendientes = 0;
          this.actualizarMenuItemsVisibles();
        },
      });
  }

  private cargarMasterCandidates(): void {
    this.authService.listMasterCandidates().subscribe({
      next: (items) => {
        this.masterCandidates = items ?? [];
      },
      error: (error: HttpErrorResponse) => {
        this.masterCandidates = [];
        const backendMessage =
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible cargar los usuarios para traspaso master.';
        this.abrirAlertaPerfil('Acción no completada', backendMessage, 'warning');
      },
    });
  }

  private etiquetaJaf(jaf: Jaf | null | undefined): string {
    if (jaf === 'TARAPACA') {
      return 'JAF TARAPACÁ';
    }

    if (jaf === 'ANTOFAGASTA') {
      return 'JAF ANTOFAGASTA';
    }

    if (jaf === 'ARICA_PARINACOTA') {
      return 'JAF ARICA Y PARINACOTA';
    }

    return '';
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }

  private abrirAlertaPerfil(
    titulo: string,
    mensaje: string,
    tipo: 'success' | 'warning',
  ): void {
    this.alertPerfilTitulo = titulo;
    this.alertPerfilMensaje = mensaje;
    this.alertPerfilTipo = tipo;
    this.alertPerfilAbierto = true;
  }

  onDashboardFechaChange(event: Event): void {
    if (!this.esDashboardActivo) {
      return;
    }

    const target = event.target as HTMLInputElement | null;
    const fecha = this.normalizarFechaIso(target?.value ?? '');
    if (!fecha) {
      return;
    }

    this.fechaDashboardIso = fecha;
    this.router.navigate(['/dashboard'], { queryParams: { fecha } });
  }

  abrirModalUsuariosActivos(estado: 'ACTIVOS' | 'DESCONECTADOS'): void {
    if (!this.esAuditoriaActiva) {
      return;
    }

    this.trazabilidadUiService.solicitarAbrirUsuariosActivos(estado);
  }

  verEventosSeguridad(): void {
    if (!this.esAuditoriaActiva) {
      return;
    }

    this.trazabilidadUiService.solicitarVerEventosSeguridad();
  }

  private normalizarFechaIso(fecha: string): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return null;
    }

    const date = new Date(`${fecha}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return this.formatearFechaIso(date);
  }

  private formatearFechaIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
