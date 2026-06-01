import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { UsuarioListado, UsuariosService } from './usuarios.service';
import {
  formatRunForDisplay,
  formatRunForInput,
  isRunChilenoValido,
} from '../../core/utils/run.util';
import { AlertModalComponent } from '../../shared/components/alert-modal.component';
import { AuthService } from '../../core/services/auth.service';
import { ProgressivePasswordMaskDirective } from '../../shared/directives/progressive-password-mask.directive';

type ModalUsuarios = 'CREAR' | 'RESET' | 'DESACTIVAR' | 'ACTIVAR' | 'ELIMINAR' | null;
type Jaf = 'TARAPACA' | 'ANTOFAGASTA' | 'ARICA_PARINACOTA';
type RolUsuario =
  | 'ADMINISTRADOR'
  | 'OPERADOR'
  | 'CONSULTA'
  | 'AUDITOR'
  | 'CARABINEROS'
  | 'PDI';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AlertModalComponent, ProgressivePasswordMaskDirective],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css',
})
export class UsuariosComponent implements OnInit {
  private readonly usuariosService = inject(UsuariosService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/;

  usuarios: UsuarioListado[] = [];
  busqueda = '';
  usuarioSeleccionadoId: string | null = null;

  modalAbierto: ModalUsuarios = null;
  loadingModal = false;
  alertExitoAbierto = false;
  alertaExitoMensaje = '';
  alertAvisoAbierto = false;
  alertaAvisoMensaje = '';
  mostrarPasswordCrear = false;
  mostrarPasswordReset = false;

  errorOperacion = '';
  readonly jafOptions: Array<{ valor: Jaf; etiqueta: string }> = [
    { valor: 'TARAPACA', etiqueta: 'JAF Tarapacá' },
    { valor: 'ANTOFAGASTA', etiqueta: 'JAF Antofagasta' },
    { valor: 'ARICA_PARINACOTA', etiqueta: 'JAF Arica y Parinacota' },
  ];
  readonly rolesMaster: Array<{ valor: RolUsuario; etiqueta: string }> = [
    { valor: 'ADMINISTRADOR', etiqueta: 'Administrador' },
    { valor: 'OPERADOR', etiqueta: 'Operador' },
    { valor: 'CONSULTA', etiqueta: 'Consulta' },
    { valor: 'CARABINEROS', etiqueta: 'Carabineros' },
    { valor: 'PDI', etiqueta: 'PDI' },
    { valor: 'AUDITOR', etiqueta: 'Auditor' },
  ];
  readonly rolesOperativo: Array<{ valor: RolUsuario; etiqueta: string }> = [
    { valor: 'OPERADOR', etiqueta: 'Operador' },
    { valor: 'CONSULTA', etiqueta: 'Consulta' },
    { valor: 'CARABINEROS', etiqueta: 'Carabineros' },
    { valor: 'PDI', etiqueta: 'PDI' },
  ];

  readonly formCrear = this.fb.group({
    run: ['', [Validators.required, this.validarRunChileno]],
    grado: ['', [Validators.required]],
    nombre: ['', [Validators.required]],
    apellidos: ['', [Validators.required]],
    rol: ['OPERADOR', [Validators.required]],
    jaf: ['TARAPACA'],
    password: ['', [Validators.required, Validators.pattern(this.passwordPattern)]],
  });

  readonly formReset = this.fb.group({
    usuarioId: ['', [Validators.required]],
    nuevaPassword: ['', [Validators.required, Validators.pattern(this.passwordPattern)]],
  });

  readonly formDesactivar = this.fb.group({
    usuarioId: ['', [Validators.required]],
  });

  readonly formActivar = this.fb.group({
    usuarioId: ['', [Validators.required]],
  });

  readonly formEliminar = this.fb.group({
    usuarioId: ['', [Validators.required]],
  });

  get usuariosActivos(): UsuarioListado[] {
    return this.usuarios.filter((usuario) => usuario.activo);
  }

  get usuarioSeleccionado(): UsuarioListado | null {
    if (!this.usuarioSeleccionadoId) {
      return null;
    }

    return this.obtenerUsuarioPorId(this.usuarioSeleccionadoId);
  }

  get puedeDesactivarSeleccionado(): boolean {
    return Boolean(this.usuarioSeleccionado?.activo && !this.esAutoseleccion);
  }

  get puedeActivarSeleccionado(): boolean {
    const seleccionado = this.usuarioSeleccionado;
    return Boolean(seleccionado && !seleccionado.activo);
  }

  get puedeResetearSeleccionado(): boolean {
    return Boolean(this.usuarioSeleccionado && !this.esAutoseleccion);
  }

  get puedeEliminarSeleccionado(): boolean {
    return Boolean(this.usuarioSeleccionado && !this.esAutoseleccion);
  }

  get esAutoseleccion(): boolean {
    const actualId = this.authService.currentUser?.id;
    const seleccionadoId = this.usuarioSeleccionado?.id;
    return Boolean(actualId && seleccionadoId && actualId === seleccionadoId);
  }

  get requiereJafCrear(): boolean {
    const rol = this.formCrear.get('rol')?.value;
    return (
      rol === 'ADMINISTRADOR' ||
      rol === 'OPERADOR' ||
      rol === 'CONSULTA' ||
      rol === 'CARABINEROS' ||
      rol === 'PDI'
    );
  }

  get esAdminMasterActual(): boolean {
    return Boolean(this.authService.currentUser?.esMaster);
  }

  get puedeEditarJafCrear(): boolean {
    return this.esAdminMasterActual;
  }

  get jafAdminOperativo(): Jaf | null {
    const jaf = this.authService.currentUser?.jaf;
    if (jaf === 'TARAPACA' || jaf === 'ANTOFAGASTA' || jaf === 'ARICA_PARINACOTA') {
      return jaf;
    }
    return null;
  }

  get rolesDisponiblesCrear(): Array<{ valor: RolUsuario; etiqueta: string }> {
    return this.esAdminMasterActual ? this.rolesMaster : this.rolesOperativo;
  }

  isUsuarioSeleccionadoListado(usuarioId: string): boolean {
    return this.usuarioSeleccionadoId === usuarioId;
  }

  seleccionarUsuarioListado(usuarioId: string): void {
    this.usuarioSeleccionadoId = usuarioId;
    this.formReset.patchValue({ usuarioId });
    this.formDesactivar.patchValue({ usuarioId });
    this.formActivar.patchValue({ usuarioId });
    this.formEliminar.patchValue({ usuarioId });
  }

  ngOnInit(): void {
    this.formCrear.get('rol')?.valueChanges.subscribe(() => {
      this.actualizarValidacionJafCrear();
    });
    this.actualizarValidacionJafCrear();
    this.cargar();
  }

  cargar(): void {
    this.usuariosService
      .listar({ busqueda: this.busqueda || undefined })
      .subscribe({
        next: (response) => {
          this.usuarios = response.items;
          if (
            this.usuarioSeleccionadoId &&
            !this.usuarios.some((usuario) => usuario.id === this.usuarioSeleccionadoId)
          ) {
            this.usuarioSeleccionadoId = null;
            this.formReset.patchValue({ usuarioId: '' });
            this.formDesactivar.patchValue({ usuarioId: '' });
            this.formActivar.patchValue({ usuarioId: '' });
            this.formEliminar.patchValue({ usuarioId: '' });
          }
        },
        error: (error) => {
          this.abrirAlertaAviso(this.getErrorMessage(error));
        },
      });
  }

  onBuscar(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.busqueda = target.value;
    this.cargar();
  }

  abrirModal(modal: Exclude<ModalUsuarios, null>): void {
    this.resetMensajes();

    if (modal !== 'CREAR' && !this.usuarioSeleccionado) {
      this.abrirAlertaAviso('Debes seleccionar un usuario en el listado.');
      return;
    }

    if (
      this.esAutoseleccion &&
      (modal === 'RESET' || modal === 'DESACTIVAR' || modal === 'ELIMINAR')
    ) {
      this.abrirAlertaAviso(
        'No puedes aplicar esta acción sobre tu propio usuario.',
      );
      return;
    }

    this.loadingModal = false;

    if (modal === 'CREAR') {
      const rolInicial: RolUsuario = this.esAdminMasterActual ? 'OPERADOR' : 'OPERADOR';
      const jafInicial = this.esAdminMasterActual
        ? 'TARAPACA'
        : (this.jafAdminOperativo ?? 'TARAPACA');
      this.formCrear.reset({ rol: rolInicial, jaf: jafInicial });
      this.actualizarValidacionJafCrear();
      this.mostrarPasswordCrear = false;
    }

    if (modal === 'RESET') {
      this.formReset.reset({
        usuarioId: this.usuarioSeleccionadoId ?? '',
        nuevaPassword: '',
      });
      this.mostrarPasswordReset = false;
    }

    if (modal === 'DESACTIVAR') {
      this.formDesactivar.reset({ usuarioId: this.usuarioSeleccionadoId ?? '' });
    }

    if (modal === 'ACTIVAR') {
      this.formActivar.reset({ usuarioId: this.usuarioSeleccionadoId ?? '' });
    }

    if (modal === 'ELIMINAR') {
      this.formEliminar.reset({ usuarioId: this.usuarioSeleccionadoId ?? '' });
    }

    this.modalAbierto = modal;
  }

  cerrarModal(): void {
    if (this.loadingModal) {
      return;
    }

    this.modalAbierto = null;
  }

  confirmarCrear(): void {
    this.resetMensajes();

    if (this.formCrear.invalid || this.loadingModal) {
      this.formCrear.markAllAsTouched();
      if (this.formCrear.invalid) {
        this.abrirAlertaAviso(this.getCreateValidationMessage());
      }
      return;
    }

    this.loadingModal = true;
    const raw = this.formCrear.getRawValue();
    const rol = (raw.rol as RolUsuario) ?? 'OPERADOR';
    const rolPermitido = this.rolesDisponiblesCrear.some((option) => option.valor === rol);
    if (!rolPermitido) {
      this.loadingModal = false;
      this.abrirAlertaAviso('No tienes permisos para crear usuarios con ese rol.');
      return;
    }
    const requiereJaf =
      rol === 'ADMINISTRADOR' ||
      rol === 'OPERADOR' ||
      rol === 'CONSULTA' ||
      rol === 'CARABINEROS' ||
      rol === 'PDI';
    const jafOperativo = this.jafAdminOperativo;
    const jaf =
      requiereJaf && raw.jaf
        ? (this.esAdminMasterActual
            ? (raw.jaf as Jaf)
            : (jafOperativo ?? (raw.jaf as Jaf)))
        : undefined;

    this.usuariosService
      .crear({
        run: raw.run ?? '',
        grado: raw.grado ?? '',
        nombre: raw.nombre ?? '',
        apellidos: raw.apellidos ?? '',
        rol,
        jaf,
        password: raw.password ?? '',
      })
      .subscribe({
        next: () => {
          this.loadingModal = false;
          this.modalAbierto = null;
          this.abrirAlertaExito('Usuario creado correctamente.');
          this.cargar();
        },
        error: (error) => {
          this.loadingModal = false;
          this.abrirAlertaAviso(this.getErrorMessage(error));
        },
      });
  }

  confirmarResetClave(): void {
    this.resetMensajes();

    if (this.formReset.invalid || this.loadingModal) {
      this.formReset.markAllAsTouched();
      if (this.formReset.invalid) {
        this.abrirAlertaAviso(this.getResetValidationMessage());
      }
      return;
    }

    this.loadingModal = true;
    const usuarioId = this.formReset.get('usuarioId')?.value ?? '';
    const nuevaPassword = this.formReset.get('nuevaPassword')?.value ?? '';

    this.usuariosService.resetearPassword(usuarioId, nuevaPassword).subscribe({
      next: () => {
        this.loadingModal = false;
        this.modalAbierto = null;
        this.abrirAlertaExito('Clave actualizada');
      },
      error: (error) => {
        this.loadingModal = false;
        this.abrirAlertaAviso(this.getErrorMessage(error));
      },
    });
  }

  confirmarDesactivar(): void {
    this.resetMensajes();

    if (this.formDesactivar.invalid || this.loadingModal) {
      this.formDesactivar.markAllAsTouched();
      return;
    }

    const seleccionado = this.usuarioSeleccionado;
    if (!seleccionado) {
      this.abrirAlertaAviso('Debes seleccionar un usuario.');
      return;
    }

    if (!seleccionado.activo) {
      this.abrirAlertaAviso('El usuario seleccionado ya está inactivo.');
      return;
    }

    this.loadingModal = true;

    this.usuariosService.desactivar(seleccionado.id).subscribe({
      next: () => {
        this.loadingModal = false;
        this.modalAbierto = null;
        this.abrirAlertaExito('Usuario desactivado correctamente.');
        this.cargar();
      },
      error: (error) => {
        this.loadingModal = false;
        this.abrirAlertaAviso(this.getErrorMessage(error));
      },
    });
  }

  confirmarActivar(): void {
    this.resetMensajes();

    if (this.formActivar.invalid || this.loadingModal) {
      this.formActivar.markAllAsTouched();
      return;
    }

    const seleccionado = this.usuarioSeleccionado;
    if (!seleccionado) {
      this.abrirAlertaAviso('Debes seleccionar un usuario.');
      return;
    }

    if (seleccionado.activo) {
      this.abrirAlertaAviso('El usuario seleccionado ya está activo.');
      return;
    }

    this.loadingModal = true;

    this.usuariosService.activar(seleccionado.id).subscribe({
      next: () => {
        this.loadingModal = false;
        this.modalAbierto = null;
        this.abrirAlertaExito('Usuario activado correctamente.');
        this.cargar();
      },
      error: (error) => {
        this.loadingModal = false;
        this.abrirAlertaAviso(this.getErrorMessage(error));
      },
    });
  }

  confirmarEliminar(): void {
    this.resetMensajes();

    if (this.formEliminar.invalid || this.loadingModal) {
      this.formEliminar.markAllAsTouched();
      return;
    }

    const seleccionado = this.usuarioSeleccionado;
    if (!seleccionado) {
      this.abrirAlertaAviso('Debes seleccionar un usuario.');
      return;
    }

    this.loadingModal = true;

    this.usuariosService.eliminarLogico(seleccionado.id).subscribe({
      next: () => {
        this.loadingModal = false;
        this.modalAbierto = null;
        this.abrirAlertaExito('Usuario eliminado correctamente.');
        this.cargar();
      },
      error: (error) => {
        this.loadingModal = false;
        this.abrirAlertaAviso(this.getErrorMessage(error));
      },
    });
  }

  onRunInputCrear(event: Event): void {
    const target = event.target as HTMLInputElement;
    const formateado = formatRunForInput(target.value);

    this.formCrear.patchValue({ run: formateado }, { emitEvent: false });
    this.formCrear.get('run')?.updateValueAndValidity({ emitEvent: false });
  }

  onRolCrearChange(): void {
    this.actualizarValidacionJafCrear();
  }

  etiquetaJaf(jaf: UsuarioListado['jaf']): string {
    if (jaf === 'TARAPACA') {
      return 'JAF Tarapacá';
    }

    if (jaf === 'ANTOFAGASTA') {
      return 'JAF Antofagasta';
    }

    if (jaf === 'ARICA_PARINACOTA') {
      return 'JAF Arica y Parinacota';
    }

    return '-';
  }

  private obtenerUsuarioPorId(usuarioId: string | null | undefined): UsuarioListado | null {
    if (!usuarioId) {
      return null;
    }

    return this.usuarios.find((usuario) => usuario.id === usuarioId) ?? null;
  }
  formatRun(run: string): string {
    return formatRunForDisplay(run);
  }

  abrirAlertaExito(mensaje: string): void {
    this.alertaExitoMensaje = mensaje;
    this.alertExitoAbierto = true;
  }

  cerrarAlertaExito(): void {
    this.alertExitoAbierto = false;
    this.alertaExitoMensaje = '';
  }

  cerrarAlertaAviso(): void {
    this.alertAvisoAbierto = false;
    this.alertaAvisoMensaje = '';
  }

  abrirAlertaAviso(mensaje: string): void {
    this.alertaAvisoMensaje = mensaje;
    this.alertAvisoAbierto = true;
  }

  private resetMensajes(): void {
    this.errorOperacion = '';
  }

  private getCreateValidationMessage(): string {
    const faltantes: string[] = [];
    const run = this.formCrear.get('run');
    const grado = this.formCrear.get('grado');
    const nombre = this.formCrear.get('nombre');
    const apellidos = this.formCrear.get('apellidos');
    const rol = this.formCrear.get('rol');
    const jaf = this.formCrear.get('jaf');
    const password = this.formCrear.get('password');

    if (run?.invalid) faltantes.push('RUN');
    if (grado?.invalid) faltantes.push('grado');
    if (nombre?.invalid) faltantes.push('nombre');
    if (apellidos?.invalid) faltantes.push('apellidos');
    if (rol?.invalid) faltantes.push('rol');
    if (this.requiereJafCrear && jaf?.invalid) faltantes.push('JAF');

    if (password?.hasError('required')) {
      faltantes.push('contraseña temporal');
    }
    if (password?.hasError('pattern')) {
      return 'La contraseña temporal debe tener 10 o más caracteres, incluir mayúscula, minúscula, número y símbolo.';
    }

    if (run?.hasError('runChilenoInvalido')) {
      return 'El RUN ingresado no es válido para Chile. Verifica el formato y el dígito verificador.';
    }

    if (faltantes.length > 0) {
      return `Falta completar: ${faltantes.join(', ')}.`;
    }

    return 'Revisa los datos del usuario antes de continuar.';
  }

  private validarRunChileno(
    control: AbstractControl,
  ): ValidationErrors | null {
    const value = String(control.value ?? '').trim();

    if (!value) {
      return null;
    }

    return isRunChilenoValido(value) ? null : { runChilenoInvalido: true };
  }

  private getResetValidationMessage(): string {
    const password = this.formReset.get('nuevaPassword');

    if (password?.hasError('required')) {
      return 'Debes ingresar la nueva contraseña.';
    }

    if (password?.hasError('pattern')) {
      return 'La nueva contraseña debe tener 10 o más caracteres, incluir mayúscula, minúscula, número y símbolo.';
    }

    return 'Revisa la información antes de actualizar la clave.';
  }

  private actualizarValidacionJafCrear(): void {
    const jafControl = this.formCrear.get('jaf');
    if (!jafControl) {
      return;
    }

    if (this.requiereJafCrear) {
      jafControl.setValidators([Validators.required]);
      if (this.esAdminMasterActual) {
        if (!jafControl.value) {
          jafControl.setValue('TARAPACA', { emitEvent: false });
        }
        jafControl.enable({ emitEvent: false });
      } else {
        const jafOperativo = this.jafAdminOperativo;
        if (!jafOperativo) {
          this.abrirAlertaAviso(
            'Tu cuenta de Administrador Operativo no tiene JAF asignada. Contacta al Administrador Master.',
          );
        }
        jafControl.setValue(jafOperativo ?? 'TARAPACA', { emitEvent: false });
        jafControl.disable({ emitEvent: false });
      }
    } else {
      jafControl.clearValidators();
      jafControl.setValue('', { emitEvent: false });
      jafControl.disable({ emitEvent: false });
    }

    jafControl.updateValueAndValidity({ emitEvent: false });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (Array.isArray(error.error?.message)) {
        return error.error.message.join(' | ');
      }

      const backendMessage =
        typeof error.error?.message === 'string' ? error.error.message : null;

      if (backendMessage) {
        return backendMessage;
      }

      if (typeof error.message === 'string' && error.message.length > 0) {
        return error.message;
      }
    }

    return 'No fue posible completar la operación.';
  }
}
