import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuarioListado, UsuariosService } from './usuarios.service';
import { formatRunForDisplay, formatRunForInput } from '../../core/utils/run.util';

type ModalUsuarios = 'CREAR' | 'RESET' | 'DESACTIVAR' | 'ACTIVAR' | 'ELIMINAR' | null;

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
            [disabled]="!usuarioSeleccionado"
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
            [disabled]="!usuarioSeleccionado"
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
                <td colspan="6" class="empty-cell">No hay usuarios para mostrar.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <div class="modal-backdrop" *ngIf="modalAbierto">
        <section class="modal-card" [ngSwitch]="modalAbierto" role="dialog" aria-modal="true">
          <p class="error-text modal-error" *ngIf="errorOperacion">{{ errorOperacion }}</p>

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
                  <select formControlName="rol">
                    <option value="ADMINISTRADOR">Administrador</option>
                    <option value="OPERADOR">Operador</option>
                    <option value="CONSULTA">Consulta</option>
                    <option value="AUDITOR">Auditor</option>
                  </select>
                </div>

                <div>
                  <label>Contraseña temporal</label>
                  <input formControlName="password" type="password" />
                  <small
                    class="field-help"
                    *ngIf="
                      formCrear.get('password')?.touched &&
                      formCrear.get('password')?.hasError('pattern')
                    "
                  >
                    Debe tener 10+ caracteres, mayúscula, minúscula, número y símbolo.
                  </small>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn-secondary" [disabled]="loadingModal" (click)="cerrarModal()">
                  Cancelar
                </button>
                <button class="btn-primary" [disabled]="loadingModal || formCrear.invalid">
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
                <input formControlName="nuevaPassword" type="password" />
                <small
                  class="field-help"
                  *ngIf="
                    formReset.get('nuevaPassword')?.touched &&
                    formReset.get('nuevaPassword')?.hasError('pattern')
                  "
                >
                  Debe tener 10+ caracteres, mayúscula, minúscula, número y símbolo.
                </small>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn-secondary" [disabled]="loadingModal" (click)="cerrarModal()">
                  Cancelar
                </button>
                <button class="btn-primary" [disabled]="loadingModal || formReset.invalid">
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

      <div class="alert-backdrop" *ngIf="alertExitoAbierto">
        <section class="alert-card" role="alertdialog" aria-modal="true" aria-label="Notificación">
          <div class="alert-icon" aria-hidden="true">✓</div>
          <div class="alert-content">
            <h4>Operación completada</h4>
            <p>{{ alertaExitoMensaje }}</p>
          </div>
          <div class="alert-actions">
            <button type="button" class="btn-primary" (click)="cerrarAlertaExito()">Aceptar</button>
          </div>
        </section>
      </div>
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

      .modal-error {
        margin: 0;
      }

      .field-help {
        display: inline-block;
        margin-top: 0.35rem;
        font-size: 0.82rem;
        color: #7d4c00;
      }

      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.45rem;
      }

      .alert-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(10, 21, 34, 0.45);
        display: grid;
        place-items: center;
        padding: 1rem;
        z-index: 1300;
      }

      .alert-card {
        width: min(420px, 100%);
        background: #ffffff;
        border: 1px solid #d7e0ea;
        border-radius: 12px;
        box-shadow: 0 18px 48px rgba(10, 29, 54, 0.24);
        padding: 1rem;
        display: grid;
        gap: 0.75rem;
      }

      .alert-icon {
        width: 36px;
        height: 36px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: #e8f6ee;
        color: #1c7a4a;
        font-weight: 700;
      }

      .alert-content h4 {
        margin: 0;
        font-size: 1.03rem;
        color: #1f3146;
      }

      .alert-content p {
        margin: 0.3rem 0 0;
        color: #4c6178;
      }

      .alert-actions {
        display: flex;
        justify-content: flex-end;
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
  private readonly fb = inject(FormBuilder);
  private readonly passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/;

  usuarios: UsuarioListado[] = [];
  busqueda = '';
  usuarioSeleccionadoId: string | null = null;

  modalAbierto: ModalUsuarios = null;
  loadingModal = false;
  alertExitoAbierto = false;
  alertaExitoMensaje = '';

  errorOperacion = '';

  readonly formCrear = this.fb.group({
    run: ['', [Validators.required]],
    grado: ['', [Validators.required]],
    nombre: ['', [Validators.required]],
    apellidos: ['', [Validators.required]],
    rol: ['OPERADOR', [Validators.required]],
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
    return Boolean(this.usuarioSeleccionado?.activo);
  }

  get puedeActivarSeleccionado(): boolean {
    const seleccionado = this.usuarioSeleccionado;
    return Boolean(seleccionado && !seleccionado.activo);
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
          this.errorOperacion = this.getErrorMessage(error);
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
      this.errorOperacion = 'Debes seleccionar un usuario en el listado.';
      return;
    }

    this.loadingModal = false;

    if (modal === 'CREAR') {
      this.formCrear.reset({ rol: 'OPERADOR' });
    }

    if (modal === 'RESET') {
      this.formReset.reset({
        usuarioId: this.usuarioSeleccionadoId ?? '',
        nuevaPassword: '',
      });
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
        this.errorOperacion =
          'Revisa los campos obligatorios. La contraseña debe cumplir la política de seguridad.';
      }
      return;
    }

    this.loadingModal = true;
    const raw = this.formCrear.getRawValue();

    this.usuariosService
      .crear({
        run: raw.run ?? '',
        grado: raw.grado ?? '',
        nombre: raw.nombre ?? '',
        apellidos: raw.apellidos ?? '',
        rol:
          (raw.rol as 'ADMINISTRADOR' | 'OPERADOR' | 'CONSULTA' | 'AUDITOR') ??
          'OPERADOR',
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
          this.errorOperacion = this.getErrorMessage(error);
        },
      });
  }

  confirmarResetClave(): void {
    this.resetMensajes();

    if (this.formReset.invalid || this.loadingModal) {
      this.formReset.markAllAsTouched();
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
        this.errorOperacion = this.getErrorMessage(error);
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
      this.errorOperacion = 'Debes seleccionar un usuario.';
      return;
    }

    if (!seleccionado.activo) {
      this.errorOperacion = 'El usuario seleccionado ya está inactivo.';
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
        this.errorOperacion = this.getErrorMessage(error);
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
      this.errorOperacion = 'Debes seleccionar un usuario.';
      return;
    }

    if (seleccionado.activo) {
      this.errorOperacion = 'El usuario seleccionado ya está activo.';
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
        this.errorOperacion = this.getErrorMessage(error);
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
      this.errorOperacion = 'Debes seleccionar un usuario.';
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
        this.errorOperacion = this.getErrorMessage(error);
      },
    });
  }

  onRunInputCrear(event: Event): void {
    const target = event.target as HTMLInputElement;
    const formateado = formatRunForInput(target.value);

    this.formCrear.patchValue(
      {
        run: formateado,
      },
      { emitEvent: false },
    );
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

  private resetMensajes(): void {
    this.errorOperacion = '';
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
