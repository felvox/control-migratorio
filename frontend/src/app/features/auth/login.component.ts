import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { formatRunForInput } from '../../core/utils/run.util';

const LOGIN_RUN_KEY = 'cm_login_run';
const LOGIN_PASSWORD_KEY = 'cm_login_password';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-shell">
      <div class="login-overlay"></div>

      <div class="login-panel">
        <section class="left-column">
          <h1>Sistema Migratorio</h1>
          <p>
            Bienvenido al Sistema Web de Control Migratorio, plataforma para el
            registro, consulta y seguimiento.
          </p>
        </section>

        <section class="right-column">
          <h2>Iniciar sesión</h2>

          <form [formGroup]="form" (ngSubmit)="submit()" class="page-grid">
            <div>
              <label>Usuario</label>
              <input
                formControlName="run"
                type="text"
                placeholder="12.345.678-5"
                autocomplete="username"
                (input)="onRunInput($event)"
              />
            </div>

            <div>
              <label>Clave</label>
              <div class="password-field">
                <input
                  formControlName="password"
                  [type]="mostrarClave ? 'text' : 'password'"
                  placeholder="••••••••"
                  autocomplete="current-password"
                />
                <button
                  type="button"
                  class="toggle-password"
                  (click)="toggleMostrarClave()"
                >
                  {{ mostrarClave ? 'Ocultar' : 'Mostrar' }}
                </button>
              </div>
            </div>

            <label class="remember-row">
              <input type="checkbox" formControlName="recordar" />
              <span>Recordar sesión en este equipo</span>
            </label>

            <button class="btn-login" [disabled]="loading">
              {{ loading ? 'Ingresando...' : 'Ingresar' }}
            </button>
          </form>
        </section>
      </div>

      <div
        class="modal-overlay"
        *ngIf="modalErrorAbierto"
        (click)="cerrarModalError()"
      >
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Acceso no válido</h3>
          <p>{{ modalErrorMensaje }}</p>
          <button type="button" class="btn-modal" (click)="cerrarModalError()">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .login-shell {
        position: relative;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1rem;
        background-image: url('/assets/login-fondo.jpeg');
        background-size: cover;
        background-position: center;
      }

      .login-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgba(3, 15, 26, 0.75), rgba(8, 18, 26, 0.55));
      }

      .login-panel {
        position: relative;
        width: min(1040px, 100%);
        min-height: 430px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 18px;
        backdrop-filter: blur(2px);
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        overflow: hidden;
      }

      .left-column,
      .right-column {
        padding: 1.55rem 2rem;
        color: #fff;
      }

      .left-column {
        background: linear-gradient(180deg, rgba(4, 19, 34, 0.58), rgba(4, 19, 34, 0.25));
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.65rem;
      }

      .left-column h1 {
        margin: 0;
        font-size: clamp(2.3rem, 4.2vw, 3.7rem);
        line-height: 1.1;
      }

      .left-column p {
        margin: 0;
        max-width: 430px;
        color: rgba(240, 246, 252, 0.85);
      }

      .right-column {
        background: linear-gradient(180deg, rgba(6, 13, 20, 0.78), rgba(6, 13, 20, 0.88));
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.55rem;
      }

      .right-column form.page-grid {
        gap: 0.55rem;
      }

      .right-column h2 {
        margin: 0;
        font-size: 2rem;
      }

      .right-column label {
        color: rgba(238, 244, 250, 0.9);
        font-size: 0.87rem;
      }

      .right-column input[type='text'],
      .right-column input[type='password'] {
        border: 1px solid rgba(255, 255, 255, 0.35);
        background: rgba(255, 255, 255, 0.95);
        color: #1b2630;
      }

      .password-field {
        position: relative;
      }

      .password-field input {
        padding-right: 6.1rem;
      }

      .toggle-password {
        position: absolute;
        right: 0.35rem;
        top: 50%;
        transform: translateY(-50%);
        border: 1px solid #d4dbe3;
        background: #f4f7fb;
        color: #1b2630;
        border-radius: 7px;
        padding: 0.2rem 0.55rem;
        font-size: 0.78rem;
      }

      .remember-row {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        margin-top: 0;
      }

      .remember-row input {
        width: auto;
      }

      .btn-login {
        background: #d68831;
        color: #fff;
        border: none;
        padding: 0.62rem 0.9rem;
        font-weight: 600;
        margin-top: 0.2rem;
      }

      .btn-login:disabled {
        opacity: 0.7;
      }

      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(5, 9, 14, 0.55);
        display: grid;
        place-items: center;
        z-index: 1000;
        padding: 1rem;
      }

      .modal-content {
        width: min(420px, 100%);
        border-radius: 12px;
        border: 1px solid #d8dfe7;
        background: #ffffff;
        color: #1b2630;
        padding: 1rem;
        display: grid;
        gap: 0.65rem;
      }

      .modal-content h3 {
        margin: 0;
        font-size: 1.2rem;
      }

      .modal-content p {
        margin: 0;
        color: #41505d;
      }

      .btn-modal {
        justify-self: end;
        border: 1px solid #c8d1da;
        background: #f3f6f9;
        color: #1b2630;
      }

      @media (max-width: 900px) {
        .login-panel {
          grid-template-columns: 1fr;
          min-height: auto;
        }

        .left-column,
        .right-column {
          padding: 1.2rem;
        }
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  loading = false;
  mostrarClave = false;
  modalErrorAbierto = false;
  modalErrorMensaje = '';

  readonly form = this.fb.group({
    run: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    recordar: [false],
  });

  constructor() {
    this.cargarCredencialesRecordadas();
  }

  submit(): void {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.modalErrorAbierto = false;

    const raw = this.form.getRawValue();

    this.authService.login({
      run: raw.run || '',
      password: raw.password || '',
    }).pipe(
      timeout(12000),
      finalize(() => {
        this.loading = false;
      }),
    ).subscribe({
      next: () => {
        this.guardarCredencialesRecordadas(
          raw.run || '',
          raw.password || '',
          Boolean(raw.recordar),
        );

        const rol = this.authService.currentUser?.rol;
        if (rol === 'ADMINISTRADOR') {
          this.router.navigate(['/dashboard']).catch(() => {
            this.abrirModalError('No fue posible abrir el inicio.');
          });
          return;
        }

        const redirect = this.route.snapshot.queryParamMap.get('redirect');
        this.router
          .navigate([redirect ?? this.authService.resolveHomeByRole()])
          .catch(() => {
            this.abrirModalError('No fue posible abrir la pantalla principal.');
          });
      },
      error: (error: unknown) => {
        if ((error as { name?: string })?.name === 'TimeoutError') {
          this.abrirModalError(
            'El servidor demoró demasiado en responder. Intenta nuevamente.',
          );
          return;
        }

        if (!(error instanceof HttpErrorResponse)) {
          this.abrirModalError('No fue posible iniciar sesión. Intenta nuevamente.');
          return;
        }

        if (error.status === 0) {
          this.abrirModalError('No hay conexión con el servidor. Intenta nuevamente.');
          return;
        }

        if (
          error.status === 400 &&
          Array.isArray(error.error?.message) &&
          error.error.message.some((item: string) => item.includes('RUN inválido'))
        ) {
          this.abrirModalError('RUN inválido. Usa formato 15.960.680-5.');
          return;
        }

        this.abrirModalError('Usuario o clave inválidos');
      },
    });
  }

  onRunInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const formateado = formatRunForInput(target.value);
    this.form.patchValue(
      {
        run: formateado,
      },
      { emitEvent: false },
    );
  }

  toggleMostrarClave(): void {
    this.mostrarClave = !this.mostrarClave;
  }

  abrirModalError(mensaje: string): void {
    this.modalErrorMensaje = mensaje;
    this.modalErrorAbierto = true;
  }

  cerrarModalError(): void {
    this.modalErrorAbierto = false;
  }

  private cargarCredencialesRecordadas(): void {
    const run = localStorage.getItem(LOGIN_RUN_KEY);
    const password = localStorage.getItem(LOGIN_PASSWORD_KEY);

    if (!run || !password) {
      return;
    }

    this.form.patchValue(
      {
        run: formatRunForInput(run),
        password,
        recordar: true,
      },
      { emitEvent: false },
    );
  }

  private guardarCredencialesRecordadas(
    run: string,
    password: string,
    recordar: boolean,
  ): void {
    if (!recordar) {
      localStorage.removeItem(LOGIN_RUN_KEY);
      localStorage.removeItem(LOGIN_PASSWORD_KEY);
      return;
    }

    localStorage.setItem(LOGIN_RUN_KEY, run);
    localStorage.setItem(LOGIN_PASSWORD_KEY, password);
  }
}
