import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { UsuariosService, UsuarioListado } from './usuarios.service';
import { formatRunForDisplay, formatRunForInput } from '../../core/utils/run.util';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-grid">
      <h2>Gestión de Usuarios</h2>

      <article class="card">
        <h3>Crear usuario</h3>

        <form [formGroup]="form" (ngSubmit)="crear()" class="form-grid">
          <div>
            <label>RUN</label>
            <input
              formControlName="run"
              type="text"
              placeholder="12.345.678-5"
              (input)="onRunInput($event)"
            />
          </div>
          <div>
            <label>Nombre completo</label>
            <input formControlName="nombreCompleto" type="text" />
          </div>
          <div>
            <label>Email (opcional)</label>
            <input formControlName="email" type="email" />
          </div>
          <div>
            <label>Rol</label>
            <select formControlName="rol">
              <option value="ADMINISTRADOR">Administrador</option>
              <option value="OPERADOR">Operador</option>
              <option value="CONSULTA">Consulta</option>
            </select>
          </div>
          <div>
            <label>Contraseña temporal</label>
            <input formControlName="password" type="password" />
          </div>
          <div style="align-self: end;">
            <button class="btn-primary" [disabled]="loadingCreate">
              {{ loadingCreate ? 'Guardando...' : 'Crear usuario' }}
            </button>
          </div>
        </form>
      </article>

      <article class="card">
        <div class="list-header">
          <h3>Listado</h3>
          <input
            [value]="busqueda"
            (input)="onBuscar($event)"
            placeholder="Buscar por nombre, RUN o email"
          />
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>RUN</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let usuario of usuarios">
                <td>{{ usuario.nombreCompleto }}</td>
                <td>{{ formatRun(usuario.run) }}</td>
                <td>{{ usuario.email || '-' }}</td>
                <td>{{ usuario.rol }}</td>
                <td>
                  <span class="badge" [class.success]="usuario.activo">
                    {{ usuario.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>
                  {{ usuario.ultimoAcceso ? (usuario.ultimoAcceso | date: 'dd/MM/yyyy HH:mm') : '-' }}
                </td>
                <td>
                  <button class="btn-secondary" (click)="resetear(usuario)">
                    Reset clave
                  </button>
                  <button
                    class="btn-danger"
                    [disabled]="!usuario.activo"
                    (click)="desactivar(usuario)"
                  >
                    Desactivar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>
  `,
  styles: [
    `
      h2,
      h3 {
        margin: 0;
      }

      .list-header {
        display: flex;
        gap: 0.8rem;
        justify-content: space-between;
        margin-bottom: 0.8rem;
      }

      .list-header input {
        max-width: 360px;
      }

      td:last-child {
        display: flex;
        gap: 0.4rem;
      }
    `,
  ],
})
export class UsuariosComponent implements OnInit {
  private readonly usuariosService = inject(UsuariosService);
  private readonly fb = inject(FormBuilder);

  usuarios: UsuarioListado[] = [];
  busqueda = '';
  loadingCreate = false;

  readonly form = this.fb.group({
    run: ['', [Validators.required]],
    nombreCompleto: ['', [Validators.required]],
    email: ['', [Validators.email]],
    rol: ['OPERADOR', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.usuariosService
      .listar({ busqueda: this.busqueda || undefined })
      .subscribe((response) => {
        this.usuarios = response.items;
      });
  }

  crear(): void {
    if (this.form.invalid || this.loadingCreate) {
      this.form.markAllAsTouched();
      return;
    }

    this.loadingCreate = true;

    this.usuariosService.crear(this.form.getRawValue() as any).subscribe({
      next: () => {
        this.loadingCreate = false;
        this.form.reset({ rol: 'OPERADOR' });
        this.cargar();
      },
      error: () => {
        this.loadingCreate = false;
      },
    });
  }

  onBuscar(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.busqueda = target.value;
    this.cargar();
  }

  desactivar(usuario: UsuarioListado): void {
    if (!confirm(`¿Desactivar a RUN ${usuario.run}?`)) {
      return;
    }

    this.usuariosService.desactivar(usuario.id).subscribe(() => this.cargar());
  }

  resetear(usuario: UsuarioListado): void {
    const nueva = prompt(
      `Nueva contraseña para RUN ${usuario.run} (mínimo 8 caracteres):`,
    );

    if (!nueva || nueva.length < 8) {
      return;
    }

    this.usuariosService
      .resetearPassword(usuario.id, nueva)
      .subscribe(() => alert('Contraseña actualizada'));
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

  formatRun(run: string): string {
    return formatRunForDisplay(run);
  }
}
