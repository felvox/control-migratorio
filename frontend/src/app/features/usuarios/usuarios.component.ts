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
type RolUsuario = 'ADMINISTRADOR' | 'OPERADOR' | 'CONSULTA' | 'AUDITOR';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AlertModalComponent, ProgressivePasswordMaskDirective],
  template: `
    <div class="page-grid usuarios-page">
      <article class="card acciones-card">
        <div class="acciones-row">
          <button class="btn-primary" type="button" (click)="abrirModal('CREAR')">
            Crear usuario
          </button>
          <button
            class="btn-secondary"
            type="button"
            [disabled]="!puedeResetearSeleccionado"
            (click)="abrirModal('RESET')"
          >
            Resetear clave
          </button>
          <button
            class="btn-secondary"
            type="button"
            [disabled]="!puedeDesactivarSeleccionado"
            (click)="abrirModal('DESACTIVAR')"
          >
            Desactivar
          </button>
          <button
            class="btn-success"
            type="button"
            *ngIf="puedeActivarSeleccionado"
            (click)="abrirModal('ACTIVAR')"
          >
            Activar
          </button>
          <button
            class="btn-danger"
            type="button"
            [disabled]="!puedeEliminarSeleccionado"
            (click)="abrirModal('ELIMINAR')"
          >
            Eliminar
          </button>
        </div>
      </article>

      <article class="card">
        <div class="list-header">
          <h3>Listado de usuarios</h3>
          <input
            [value]="busqueda"
            (input)="onBuscar($event)"
            placeholder="Buscar por nombre o RUN"
          />
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="select-col"></th>
                <th>Nombre</th>
                <th>RUN</th>
                <th>Rol</th>
                <th>JAF</th>
                <th>Estado</th>
                <th>Último acceso</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let usuario of usuarios"
                [class.row-selected]="isUsuarioSeleccionadoListado(usuario.id)"
              >
                <td class="select-col">
                  <input
                    type="radio"
                    name="usuarioListado"
                    [checked]="isUsuarioSeleccionadoListado(usuario.id)"
                    (change)="seleccionarUsuarioListado(usuario.id)"
                  />
                </td>
                <td>{{ usuario.nombreCompleto }}</td>
                <td>{{ formatRun(usuario.run) }}</td>
                <td>{{ usuario.rol }}</td>
                <td>{{ etiquetaJaf(usuario.jaf) }}</td>
                <td>
                  <span class="badge" [class.success]="usuario.activo">
                    {{ usuario.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>
                  {{
                    usuario.ultimoAcceso
                      ? (usuario.ultimoAcceso | date: 'dd/MM/yyyy HH:mm')
                      : '-'
                  }}
                </td>
              </tr>

              <tr *ngIf="usuarios.length === 0">
                <td colspan="7" class="empty-cell">No hay usuarios para mostrar.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <div class="modal-backdrop" *ngIf="modalAbierto">
        <section class="modal-card" [ngSwitch]="modalAbierto" role="dialog" aria-modal="true">
          <ng-container *ngSwitchCase="'CREAR'">
            <h3>Crear usuario</h3>
            <form [formGroup]="formCrear" (ngSubmit)="confirmarCrear()" class="page-grid">
              <div class="form-grid">
                <div>
                  <label>RUN</label>
                  <input
                    formControlName="run"
                    type="text"
                    placeholder="12.345.678-5"
                    (input)="onRunInputCrear($event)"
                  />
                </div>

                <div>
                  <label>Grado</label>
                  <input formControlName="grado" type="text" placeholder="Ej: Mayor" />
                </div>

                <div>
                  <label>Nombre</label>
                  <input formControlName="nombre" type="text" />
                </div>

                <div>
                  <label>Apellidos</label>
                  <input formControlName="apellidos" type="text" />
                </div>

                <div>
                  <label>Rol</label>
                  <select formControlName="rol" (change)="onRolCrearChange()">
                    <option *ngFor="let rolOption of rolesDisponiblesCrear" [value]="rolOption.valor">
                      {{ rolOption.etiqueta }}
                    </option>
                  </select>
                </div>

                <div>
                  <label>JAF</label>
                  <select formControlName="jaf" [disabled]="!requiereJafCrear || !puedeEditarJafCrear">
                    <option value="">Seleccionar JAF</option>
                    <option *ngFor="let option of jafOptions" [value]="option.valor">
                      {{ option.etiqueta }}
                    </option>
                  </select>
                </div>

                <div>
                  <label>Contraseña temporal</label>
                  <div class="password-field">
                    <input
                      formControlName="password"
                      [type]="mostrarPasswordCrear ? 'text' : 'password'"
                      [appProgressivePasswordMask]="!mostrarPasswordCrear"
                    />
                    <button
                      type="button"
                      class="password-toggle"
                      (click)="mostrarPasswordCrear = !mostrarPasswordCrear"
                    >
                      {{ mostrarPasswordCrear ? 'Ocultar' : 'Mostrar' }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn-secondary" [disabled]="loadingModal" (click)="cerrarModal()">
                  Cancelar
                </button>
                <button class="btn-primary" [disabled]="loadingModal">
                  {{ loadingModal ? 'Guardando...' : 'Crear usuario' }}
                </button>
              </div>
            </form>
          </ng-container>

          <ng-container *ngSwitchCase="'RESET'">
            <h3>Resetear clave</h3>

            <form [formGroup]="formReset" (ngSubmit)="confirmarResetClave()" class="page-grid">
              <p class="modal-text" *ngIf="usuarioSeleccionado as seleccionado">
                Usuario: <strong>{{ seleccionado.nombreCompleto }}</strong>
                ({{ formatRun(seleccionado.run) }})
              </p>

              <div>
                <label>Nueva contraseña</label>
                <div class="password-field">
                  <input
                    formControlName="nuevaPassword"
                    [type]="mostrarPasswordReset ? 'text' : 'password'"
                    [appProgressivePasswordMask]="!mostrarPasswordReset"
                  />
                  <button
                    type="button"
                    class="password-toggle"
                    (click)="mostrarPasswordReset = !mostrarPasswordReset"
                  >
                    {{ mostrarPasswordReset ? 'Ocultar' : 'Mostrar' }}
                  </button>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn-secondary" [disabled]="loadingModal" (click)="cerrarModal()">
                  Cancelar
                </button>
                <button class="btn-primary" [disabled]="loadingModal">
                  {{ loadingModal ? 'Guardando...' : 'Actualizar clave' }}
                </button>
              </div>
            </form>
          </ng-container>

          <ng-container *ngSwitchCase="'DESACTIVAR'">
            <h3>Desactivar usuario</h3>
            <form [formGroup]="formDesactivar" (ngSubmit)="confirmarDesactivar()" class="page-grid">
              <p *ngIf="usuarioSeleccionado as seleccionado" class="modal-text">
                ¿Seguro que deseas desactivar a
                <strong>{{ seleccionado.nombreCompleto }}</strong>
                ({{ formatRun(seleccionado.run) }})?
              </p>

              <div class="modal-actions">
                <button type="button" class="btn-secondary" [disabled]="loadingModal" (click)="cerrarModal()">
                  Cancelar
                </button>
                <button class="btn-danger" [disabled]="loadingModal || formDesactivar.invalid">
                  {{ loadingModal ? 'Desactivando...' : 'Desactivar' }}
                </button>
              </div>
            </form>
          </ng-container>

          <ng-container *ngSwitchCase="'ACTIVAR'">
            <h3>Activar usuario</h3>
            <form [formGroup]="formActivar" (ngSubmit)="confirmarActivar()" class="page-grid">
              <p *ngIf="usuarioSeleccionado as seleccionado" class="modal-text">
                ¿Seguro que deseas activar nuevamente a
                <strong>{{ seleccionado.nombreCompleto }}</strong>
                ({{ formatRun(seleccionado.run) }})?
              </p>

              <div class="modal-actions">
                <button type="button" class="btn-secondary" [disabled]="loadingModal" (click)="cerrarModal()">
                  Cancelar
                </button>
                <button class="btn-success" [disabled]="loadingModal || formActivar.invalid">
                  {{ loadingModal ? 'Activando...' : 'Activar' }}
                </button>
              </div>
            </form>
          </ng-container>

          <ng-container *ngSwitchCase="'ELIMINAR'">
            <h3>Eliminar usuario</h3>
            <form [formGroup]="formEliminar" (ngSubmit)="confirmarEliminar()" class="page-grid">
              <p *ngIf="usuarioSeleccionado as seleccionado" class="modal-text">
                Esta acción elimina lógicamente al usuario
                <strong>{{ seleccionado.nombreCompleto }}</strong>
                ({{ formatRun(seleccionado.run) }}).
              </p>

              <div class="modal-actions">
                <button type="button" class="btn-secondary" [disabled]="loadingModal" (click)="cerrarModal()">
                  Cancelar
                </button>
                <button class="btn-danger" [disabled]="loadingModal || formEliminar.invalid">
                  {{ loadingModal ? 'Eliminando...' : 'Eliminar' }}
                </button>
              </div>
            </form>
          </ng-container>
        </section>
      </div>

      <app-alert-modal
        [open]="alertExitoAbierto"
        title="Operación completada"
        [message]="alertaExitoMensaje"
        variant="success"
        (accepted)="cerrarAlertaExito()"
      />

      <app-alert-modal
        [open]="alertAvisoAbierto"
        title="Revisa la información"
        [message]="alertaAvisoMensaje"
        variant="warning"
        (accepted)="cerrarAlertaAviso()"
      />
    </div>
  `,
  styles: [
    `
      h3 {
        margin: 0;
      }

      .usuarios-page {
        max-width: 1320px;
      }

      .acciones-card {
        display: grid;
        gap: 0.6rem;
      }

      .acciones-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .btn-success {
        background: #e9f8ef;
        color: #1c7a4a;
        border: 1px solid #a8dbba;
      }

      .list-header {
        display: flex;
        gap: 0.8rem;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.8rem;
      }

      .list-header input {
        max-width: 360px;
      }

      .select-col {
        width: 42px;
        text-align: center;
      }

      .select-col input[type='radio'] {
        width: 16px;
        height: 16px;
        padding: 0;
        margin: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        appearance: auto;
        -webkit-appearance: radio;
        accent-color: #2f6dc8;
        cursor: pointer;
      }

      .row-selected {
        background: #eef5ff;
      }

      tbody tr {
        cursor: default;
      }

      .empty-cell {
        text-align: center;
        color: var(--color-muted);
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(10, 21, 34, 0.52);
        backdrop-filter: blur(2px);
        display: grid;
        place-items: center;
        padding: 1rem;
        z-index: 1200;
      }

      .modal-card {
        width: min(760px, 100%);
        background: #fff;
        border: 1px solid #d7e0ea;
        border-radius: 14px;
        box-shadow: 0 16px 48px rgba(10, 29, 54, 0.22);
        padding: 1rem;
        display: grid;
        gap: 0.8rem;
      }

      .modal-text {
        margin: 0;
        font-size: 0.92rem;
        color: #42556a;
      }

      .password-field {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 0.45rem;
      }

      .password-toggle {
        border: 1px solid #c7d2df;
        background: #f8fafc;
        color: #25354a;
        border-radius: 10px;
        padding: 0.35rem 0.7rem;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
      }

      .password-toggle:hover {
        background: #eef3f9;
      }

      .usuarios-selector-scroll {
        max-height: 260px;
        overflow: auto;
        border: 1px solid #d7e0ea;
        border-radius: 10px;
        background: #f8fafd;
        padding: 0.45rem;
        display: grid;
        gap: 0.45rem;
      }

      .rol-group {
        border: 1px solid #d9e3ee;
        border-radius: 9px;
        overflow: hidden;
        background: #fff;
      }

      .rol-toggle {
        width: 100%;
        border: none;
        border-bottom: 1px solid #e7edf5;
        background: #f3f7fc;
        color: #23364b;
        padding: 0.55rem 0.68rem;
        font-weight: 650;
        font-size: 0.92rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
      }

      .rol-toggle .chevron {
        transition: transform 120ms ease;
      }

      .rol-toggle.expanded .chevron {
        transform: rotate(180deg);
      }

      .rol-items {
        display: grid;
        gap: 0.35rem;
        padding: 0.45rem;
      }

      .usuario-item {
        border: 1px solid #d8e3ef;
        border-radius: 8px;
        background: #fff;
        padding: 0.44rem 0.56rem;
        text-align: left;
        display: grid;
        gap: 0.08rem;
        cursor: pointer;
      }

      .usuario-item:hover {
        background: #f4f8ff;
        border-color: #9dbbe6;
      }

      .usuario-item.active {
        background: #e9f2ff;
        border-color: #2f6dc8;
      }

      .usuario-item-title {
        font-size: 0.9rem;
        font-weight: 600;
        color: #1f3146;
      }

      .usuario-item-sub {
        font-size: 0.81rem;
        color: #58708b;
      }

      .usuario-radio {
        border: 1px solid #d8e3ef;
        border-radius: 8px;
        background: #fff;
        padding: 0.44rem 0.56rem;
        display: grid;
        grid-template-columns: 18px 1fr;
        gap: 0.5rem;
        align-items: start;
        cursor: pointer;
      }

      .usuario-radio:hover {
        background: #f4f8ff;
        border-color: #9dbbe6;
      }

      .usuario-radio.active {
        background: #e9f2ff;
        border-color: #2f6dc8;
      }

      .usuario-radio input[type='radio'] {
        width: 16px;
        height: 16px;
        padding: 0;
        margin: 0.18rem 0 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        appearance: auto;
        -webkit-appearance: radio;
        accent-color: #2f6dc8;
        cursor: pointer;
      }

      .usuario-radio-content {
        display: grid;
        gap: 0.08rem;
      }

      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.45rem;
      }

      @media (max-width: 860px) {
        .list-header {
          flex-direction: column;
          align-items: stretch;
        }

        .list-header input {
          max-width: none;
        }
      }
    `,
  ],
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
    { valor: 'AUDITOR', etiqueta: 'Auditor' },
  ];
  readonly rolesOperativo: Array<{ valor: RolUsuario; etiqueta: string }> = [
    { valor: 'OPERADOR', etiqueta: 'Operador' },
    { valor: 'CONSULTA', etiqueta: 'Consulta' },
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
    return rol === 'ADMINISTRADOR' || rol === 'OPERADOR' || rol === 'CONSULTA';
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
      rol === 'ADMINISTRADOR' || rol === 'OPERADOR' || rol === 'CONSULTA';
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
