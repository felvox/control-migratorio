import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { formatRunForInput } from '../../core/utils/run.util';
import { ProgressivePasswordMaskDirective } from '../../shared/directives/progressive-password-mask.directive';

const LOGIN_RUN_KEY = 'cm_login_run';
const LOGIN_PASSWORD_KEY = 'cm_login_password';
const DEMO_PASSWORD = 'Demo123*';

type DemoLoginProfile = {
  titulo: string;
  detalle: string;
  run: string;
  password: string;
};

const DEMO_LOGIN_PROFILES: DemoLoginProfile[] = [
  {
    titulo: 'Administrador Master',
    detalle: 'Control total del sistema',
    run: '15.960.680-5',
    password: 'Admin123*',
  },
  {
    titulo: 'Admin Tarapacá',
    detalle: 'Administrador operativo JAF',
    run: '21.000.001-1',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'Admin Antofagasta',
    detalle: 'Administrador operativo JAF',
    run: '21.000.002-K',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'Admin Arica',
    detalle: 'Administrador operativo JAF',
    run: '21.000.003-8',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'Operador Tarapacá',
    detalle: 'Registro y gestión de casos',
    run: '21.000.004-6',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'Operador Antofagasta',
    detalle: 'Registro y gestión de casos',
    run: '21.000.005-4',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'Operador Arica',
    detalle: 'Registro y gestión de casos',
    run: '21.000.006-2',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'Consulta Tarapacá',
    detalle: 'Consulta de casos JAF Tarapacá',
    run: '21.000.014-3',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'Consulta Antofagasta',
    detalle: 'Consulta de casos JAF Antofagasta',
    run: '21.000.015-1',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'Consulta Arica',
    detalle: 'Consulta de casos JAF Arica',
    run: '21.000.016-K',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'Auditor',
    detalle: 'Consulta y trazabilidad',
    run: '21.000.007-0',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'Carabineros Tarapacá',
    detalle: 'Mesa institucional JAF Tarapacá',
    run: '21.000.008-9',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'Carabineros Antofagasta',
    detalle: 'Mesa institucional JAF Antofagasta',
    run: '21.000.009-7',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'Carabineros Arica',
    detalle: 'Mesa institucional JAF Arica',
    run: '21.000.010-0',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'PDI Tarapacá',
    detalle: 'Recepción y cierre JAF Tarapacá',
    run: '21.000.011-9',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'PDI Antofagasta',
    detalle: 'Recepción y cierre JAF Antofagasta',
    run: '21.000.012-7',
    password: DEMO_PASSWORD,
  },
  {
    titulo: 'PDI Arica',
    detalle: 'Recepción y cierre JAF Arica',
    run: '21.000.013-5',
    password: DEMO_PASSWORD,
  },
];

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ProgressivePasswordMaskDirective],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  loading = false;
  mostrarClave = false;
  modalErrorAbierto = false;
  modalErrorMensaje = '';
  readonly perfilesDemo = environment.production ? [] : DEMO_LOGIN_PROFILES;

  readonly form = this.fb.group({
    run: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    recordar: [false],
  });

  constructor() {
    this.cargarCredencialesRecordadas();
  }

  ngOnInit(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'inactividad') {
      this.abrirModalError('Tu sesión se cerró por inactividad. Inicia sesión nuevamente.');
      return;
    }

    if (reason === 'expirada') {
      this.abrirModalError('Tu sesión expiró o ya no es válida. Inicia sesión nuevamente.');
    }
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

        if (
          error.status === 401 &&
          typeof error.error?.message === 'string' &&
          error.error.message.includes('sesión activa de administrador')
        ) {
          this.abrirModalError(
            'Acceso restringido: el administrador ya tiene una sesión activa.',
          );
          return;
        }

        if (error.status === 429) {
          this.abrirModalError(
            'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.',
          );
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

  ingresarComoDemo(perfil: DemoLoginProfile): void {
    if (this.loading) {
      return;
    }

    const ingresar = () => {
      this.form.patchValue(
        {
          run: perfil.run,
          password: perfil.password,
          recordar: false,
        },
        { emitEvent: false },
      );
      this.submit();
    };

    if (!this.authService.isAuthenticated()) {
      ingresar();
      return;
    }

    this.loading = true;
    this.authService.logout().pipe(
      finalize(() => {
        this.loading = false;
        ingresar();
      }),
    ).subscribe();
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
    localStorage.removeItem(LOGIN_PASSWORD_KEY);

    if (!run) {
      return;
    }

    this.form.patchValue(
      {
        run: formatRunForInput(run),
        recordar: true,
      },
      { emitEvent: false },
    );
  }

  private guardarCredencialesRecordadas(
    run: string,
    recordar: boolean,
  ): void {
    if (!recordar) {
      localStorage.removeItem(LOGIN_RUN_KEY);
      localStorage.removeItem(LOGIN_PASSWORD_KEY);
      return;
    }

    localStorage.setItem(LOGIN_RUN_KEY, run);
    localStorage.removeItem(LOGIN_PASSWORD_KEY);
  }
}
