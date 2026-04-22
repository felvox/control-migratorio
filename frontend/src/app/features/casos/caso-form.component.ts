import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CasosService } from './casos.service';
import { TipoPersona } from '../../core/models/caso.model';

@Component({
  selector: 'app-caso-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-grid caso-form-page">
      <div class="title-wrap">
        <h2>{{ modoEdicion ? 'Editar caso' : 'Ingresar caso' }}</h2>
        <p>Acta de Control Migratorio</p>
      </div>

      <article class="card formato-card">
        <div class="formato-pill" [class.formato-pill-menor]="esFormatoConMenor">
          {{
            esFormatoConMenor
              ? 'Formato con menor de edad'
              : 'Formato mayor de edad'
          }}
        </div>

        <div class="flujo-grid">
          <div class="flujo-item">
            <label>Derivación automática</label>
            <strong>{{ derivacionAutomatica }}</strong>
          </div>
          <div class="flujo-item">
            <label>Estado inicial del caso</label>
            <strong>{{ estadoInicial }}</strong>
          </div>
          <div class="flujo-item">
            <label>Ruta del procedimiento</label>
            <strong>{{ rutaProcedimiento }}</strong>
          </div>
        </div>
      </article>

      <form [formGroup]="form" (ngSubmit)="guardar()" class="page-grid">
        <article class="card page-grid">
          <h3>1. Datos del procedimiento</h3>
          <div class="form-grid">
            <div>
              <label>Tipo de control</label>
              <select formControlName="tipoControl">
                <option value="INGRESO">Ingresando a territorio nacional</option>
                <option value="EGRESO">Egresando de territorio nacional</option>
                <option value="TERRITORIO">En territorio nacional</option>
              </select>
            </div>

            <div>
              <label>Fecha y hora del procedimiento</label>
              <input type="datetime-local" formControlName="fechaHoraProcedimiento" />
            </div>

            <div>
              <label>Lugar</label>
              <input formControlName="lugar" />
            </div>

            <div>
              <label>Coordenadas</label>
              <input formControlName="coordenadas" placeholder="Ej: -18.4783,-70.3126" />
            </div>
          </div>
        </article>

        <article class="card page-grid">
          <h3>2. Antecedentes migratorios</h3>
          <div class="form-grid">
            <div>
              <label>Fecha de ingreso</label>
              <input type="date" formControlName="fechaIngreso" />
            </div>

            <div>
              <label>Documentado</label>
              <select formControlName="documentado">
                <option [ngValue]="true">Sí</option>
                <option [ngValue]="false">No</option>
              </select>
            </div>

            <div>
              <label>Estado de salud</label>
              <input formControlName="estadoSalud" placeholder="Ej: Sin lesiones / Lesión superficial" />
            </div>

            <div>
              <label>Observaciones</label>
              <textarea rows="2" formControlName="observaciones"></textarea>
            </div>
          </div>
        </article>

        <article class="card page-grid">
          <h3>3. Composición del grupo</h3>
          <div class="form-grid">
            <div>
              <label>Viene acompañado</label>
              <select formControlName="vieneAcompanado">
                <option [ngValue]="false">No</option>
                <option [ngValue]="true">Sí</option>
              </select>
            </div>

            <div>
              <label>Existen menores involucrados</label>
              <select formControlName="existenMenores">
                <option [ngValue]="false">No</option>
                <option [ngValue]="true">Sí</option>
              </select>
            </div>

            <div class="grupo-resumen">
              <label>Resumen del grupo</label>
              <p>
                {{ totalPersonas }} persona(s),
                {{ totalMenoresDetectados }} menor(es) detectado(s)
              </p>
            </div>
          </div>

          <p class="hint-text" *ngIf="esFormatoConMenor">
            Se aplicará el flujo institucional para casos con menor de edad.
          </p>
        </article>

        <article class="card page-grid">
          <div class="header-row">
            <h3>4. Antecedentes personales</h3>
            <button type="button" class="btn-secondary" (click)="agregarPersona()">
              Agregar persona
            </button>
          </div>

          <p class="hint-text">
            Debe existir una persona principal. Si hay menores, agregarlos con tipo
            <strong>Menor</strong>.
          </p>

          <div formArrayName="personas" class="page-grid">
            <section
              *ngFor="let persona of personas.controls; let i = index"
              [formGroupName]="i"
              class="sub-card"
            >
              <div class="header-row">
                <strong>
                  Persona {{ i + 1 }} ·
                  {{ etiquetaTipoPersona(persona.get('tipoPersona')?.value) }}
                </strong>
                <button
                  type="button"
                  class="btn-danger"
                  (click)="eliminarPersona(i)"
                  [disabled]="personas.length === 1"
                >
                  Eliminar
                </button>
              </div>

              <div class="form-grid">
                <div>
                  <label>Tipo persona</label>
                  <select formControlName="tipoPersona">
                    <option value="PRINCIPAL">Principal</option>
                    <option value="ACOMPANANTE">Acompañante</option>
                    <option value="MENOR">Menor</option>
                  </select>
                </div>

                <div>
                  <label>Nombres</label>
                  <input formControlName="nombres" />
                </div>

                <div>
                  <label>Apellidos</label>
                  <input formControlName="apellidos" />
                </div>

                <div>
                  <label>Nacionalidad</label>
                  <input formControlName="nacionalidad" />
                </div>

                <div>
                  <label>Fecha nacimiento</label>
                  <input
                    type="date"
                    formControlName="fechaNacimiento"
                    (change)="actualizarEdad(i)"
                  />
                </div>

                <div>
                  <label>Edad</label>
                  <input type="number" formControlName="edad" />
                </div>

                <div>
                  <label>Lugar nacimiento</label>
                  <input formControlName="lugarNacimiento" />
                </div>

                <div>
                  <label>Número documento</label>
                  <input formControlName="numeroDocumento" />
                </div>

                <div>
                  <label>Profesión u oficio</label>
                  <input formControlName="profesionOficio" />
                </div>

                <div>
                  <label>Estado civil</label>
                  <input formControlName="estadoCivil" />
                </div>

                <div>
                  <label>Domicilio</label>
                  <input formControlName="domicilio" />
                </div>

                <div>
                  <label>Correo</label>
                  <input formControlName="correo" />
                </div>

                <div>
                  <label>Teléfono</label>
                  <input formControlName="telefono" />
                </div>
              </div>
            </section>
          </div>
        </article>

        <article class="card resumen-card">
          <h3>5. Resumen previo al guardado</h3>
          <ul>
            <li><strong>Formato:</strong> {{ esFormatoConMenor ? 'Con menor de edad' : 'Mayor de edad' }}</li>
            <li><strong>Total personas:</strong> {{ totalPersonas }}</li>
            <li><strong>Menores detectados:</strong> {{ totalMenoresDetectados }}</li>
            <li><strong>Derivación:</strong> {{ derivacionAutomatica }}</li>
            <li><strong>Estado inicial:</strong> {{ estadoInicial }}</li>
          </ul>
        </article>

        <p class="error-text" *ngIf="errorGeneral">{{ errorGeneral }}</p>

        <div class="actions-row">
          <button class="btn-primary" [disabled]="guardando">
            {{ guardando ? 'Guardando...' : 'Guardar caso' }}
          </button>
          <button type="button" class="btn-secondary" (click)="volver()">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      h2,
      h3 {
        margin: 0;
      }

      .caso-form-page {
        max-width: 1320px;
      }

      .title-wrap p {
        margin: 0.25rem 0 0;
        color: var(--color-muted);
      }

      .formato-card {
        display: grid;
        gap: 0.8rem;
      }

      .formato-pill {
        display: inline-flex;
        align-items: center;
        justify-self: start;
        border-radius: 999px;
        padding: 0.36rem 0.72rem;
        font-size: 0.82rem;
        font-weight: 700;
        border: 1px solid #bfd5f7;
        background: #eaf2ff;
        color: #285fb6;
      }

      .formato-pill.formato-pill-menor {
        border-color: #f3c68d;
        background: #fff5e9;
        color: #a76300;
      }

      .flujo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 0.6rem;
      }

      .flujo-item {
        border: 1px solid var(--color-border);
        border-radius: 10px;
        background: #f9fbfd;
        padding: 0.6rem 0.68rem;
        display: grid;
        gap: 0.2rem;
      }

      .flujo-item label {
        margin: 0;
        font-size: 0.78rem;
      }

      .flujo-item strong {
        font-size: 0.92rem;
        color: #1f2f43;
      }

      .sub-card {
        border: 1px solid var(--color-border);
        border-radius: 10px;
        padding: 0.8rem;
        display: grid;
        gap: 0.75rem;
        background: #fcfdff;
      }

      .header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.6rem;
      }

      .grupo-resumen {
        border: 1px dashed #c6d2df;
        border-radius: 8px;
        padding: 0.45rem 0.6rem;
        align-self: end;
      }

      .grupo-resumen p {
        margin: 0;
        font-size: 0.9rem;
        font-weight: 600;
      }

      .hint-text {
        margin: 0;
        color: #5f6f82;
        font-size: 0.85rem;
      }

      .resumen-card ul {
        margin: 0.65rem 0 0;
        padding-left: 1rem;
        display: grid;
        gap: 0.3rem;
      }

      .actions-row {
        display: flex;
        gap: 0.5rem;
      }

      @media (max-width: 760px) {
        .header-row,
        .actions-row {
          flex-wrap: wrap;
        }
      }
    `,
  ],
})
export class CasoFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly casosService = inject(CasosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  guardando = false;
  casoId: string | null = null;
  errorGeneral = '';

  get modoEdicion(): boolean {
    return Boolean(this.casoId);
  }

  readonly form = this.fb.group({
    tipoControl: ['INGRESO', Validators.required],
    fechaHoraProcedimiento: ['', Validators.required],
    lugar: ['', Validators.required],
    coordenadas: [''],
    fechaIngreso: [''],
    documentado: [true, Validators.required],
    estadoSalud: [''],
    observaciones: [''],
    vieneAcompanado: [false, Validators.required],
    existenMenores: [false, Validators.required],
    personas: this.fb.array([this.crearPersonaForm('PRINCIPAL')]),
  });

  get personas(): FormArray {
    return this.form.get('personas') as FormArray;
  }

  get totalPersonas(): number {
    return this.personas.length;
  }

  get totalMenoresDetectados(): number {
    return this.personas.controls.filter((persona) => {
      const tipo = persona.get('tipoPersona')?.value as TipoPersona;
      const edadRaw = persona.get('edad')?.value;
      const edadInformada =
        edadRaw !== null && edadRaw !== '' && Number.isFinite(Number(edadRaw));
      const edad = Number(edadRaw);
      return tipo === 'MENOR' || (edadInformada && edad < 18);
    }).length;
  }

  get existenMenoresDetectados(): boolean {
    return Boolean(this.form.get('existenMenores')?.value) || this.totalMenoresDetectados > 0;
  }

  get vieneAcompanadoDetectado(): boolean {
    return Boolean(this.form.get('vieneAcompanado')?.value) || this.totalPersonas > 1;
  }

  get esFormatoConMenor(): boolean {
    return this.existenMenoresDetectados;
  }

  get derivacionAutomatica(): string {
    return this.existenMenoresDetectados ? 'Carabineros' : 'PDI';
  }

  get estadoInicial(): string {
    return this.existenMenoresDetectados ? 'Derivado Carabineros' : 'Derivado PDI';
  }

  get rutaProcedimiento(): string {
    return this.existenMenoresDetectados ? 'Carabineros → PDI' : 'PDI';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.casoId = id;
      this.cargarCaso(id);
    }
  }

  crearPersonaForm(tipo: TipoPersona = 'ACOMPANANTE'): FormGroup {
    return this.fb.group({
      tipoPersona: [tipo, Validators.required],
      nombres: ['', Validators.required],
      apellidos: ['', Validators.required],
      nacionalidad: ['', Validators.required],
      fechaNacimiento: ['', Validators.required],
      edad: [null, [Validators.required, Validators.min(0)]],
      lugarNacimiento: [''],
      numeroDocumento: ['', Validators.required],
      profesionOficio: [''],
      estadoCivil: [''],
      domicilio: [''],
      correo: [''],
      telefono: [''],
    });
  }

  etiquetaTipoPersona(tipo: TipoPersona): string {
    if (tipo === 'PRINCIPAL') {
      return 'Principal';
    }
    if (tipo === 'ACOMPANANTE') {
      return 'Acompañante';
    }
    return 'Menor';
  }

  agregarPersona(): void {
    this.personas.push(this.crearPersonaForm());
  }

  eliminarPersona(index: number): void {
    if (this.personas.length === 1) {
      return;
    }

    this.personas.removeAt(index);
  }

  actualizarEdad(index: number): void {
    const persona = this.personas.at(index) as FormGroup;
    const fechaNacimiento = persona.get('fechaNacimiento')?.value as string;

    if (!fechaNacimiento) {
      return;
    }

    const birth = new Date(fechaNacimiento);
    const today = new Date();
    let edad = today.getFullYear() - birth.getFullYear();
    const mes = today.getMonth() - birth.getMonth();

    if (mes < 0 || (mes === 0 && today.getDate() < birth.getDate())) {
      edad -= 1;
    }

    persona.patchValue({ edad: Math.max(edad, 0) });
  }

  cargarCaso(id: string): void {
    this.casosService.obtenerPorId(id).subscribe((caso) => {
      this.form.patchValue({
        tipoControl: caso.tipoControl,
        fechaHoraProcedimiento: this.toDateTimeLocal(caso.fechaHoraProcedimiento),
        lugar: caso.lugar,
        coordenadas: caso.coordenadas ?? '',
        fechaIngreso: caso.fechaIngreso ? caso.fechaIngreso.slice(0, 10) : '',
        documentado: caso.documentado,
        estadoSalud: caso.estadoSalud ?? '',
        observaciones: caso.observaciones ?? '',
        vieneAcompanado: caso.vieneAcompanado,
        existenMenores: caso.existenMenores,
      });

      this.personas.clear();
      caso.personas.forEach((persona) => {
        const fg = this.crearPersonaForm(persona.tipoPersona);
        fg.patchValue({
          ...persona,
          fechaNacimiento: persona.fechaNacimiento.slice(0, 10),
        });
        this.personas.push(fg);
      });
    });
  }

  private validarComposicionGrupo(): boolean {
    const personas = this.personas.getRawValue();

    if (personas.length === 0) {
      this.errorGeneral = 'Debe ingresar al menos una persona en el caso.';
      return false;
    }

    const totalPrincipales = personas.filter(
      (persona) => persona.tipoPersona === 'PRINCIPAL',
    ).length;

    if (totalPrincipales === 0) {
      this.errorGeneral = 'Debe existir una persona principal.';
      return false;
    }

    if (totalPrincipales > 1) {
      this.errorGeneral = 'Solo puede existir una persona principal por caso.';
      return false;
    }

    if (Boolean(this.form.get('existenMenores')?.value) && this.totalMenoresDetectados === 0) {
      this.errorGeneral =
        'Marcaste “existen menores”, pero no hay personas tipo Menor o menores de 18 años.';
      return false;
    }

    return true;
  }

  guardar(): void {
    this.errorGeneral = '';

    if (this.form.invalid || this.guardando) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.validarComposicionGrupo()) {
      return;
    }

    this.guardando = true;

    const raw = this.form.getRawValue();
    const payload = {
      tipoControl: raw.tipoControl,
      fechaHoraProcedimiento: raw.fechaHoraProcedimiento,
      lugar: raw.lugar,
      coordenadas: raw.coordenadas || undefined,
      fechaIngreso: raw.fechaIngreso || undefined,
      documentado: Boolean(raw.documentado),
      estadoSalud: raw.estadoSalud || undefined,
      observaciones: raw.observaciones || undefined,
      vieneAcompanado: this.vieneAcompanadoDetectado,
      existenMenores: this.existenMenoresDetectados,
      personas: raw.personas.map((persona) => ({
        tipoPersona: persona['tipoPersona'],
        nombres: persona['nombres'],
        apellidos: persona['apellidos'],
        nacionalidad: persona['nacionalidad'],
        fechaNacimiento: persona['fechaNacimiento'],
        edad: Number(persona['edad']),
        lugarNacimiento: persona['lugarNacimiento'] || undefined,
        numeroDocumento: persona['numeroDocumento'],
        profesionOficio: persona['profesionOficio'] || undefined,
        estadoCivil: persona['estadoCivil'] || undefined,
        domicilio: persona['domicilio'] || undefined,
        correo: persona['correo'] || undefined,
        telefono: persona['telefono'] || undefined,
      })),
    };

    const request$ = this.casoId
      ? this.casosService.actualizar(this.casoId, payload)
      : this.casosService.crear(payload);

    request$.subscribe({
      next: (caso) => {
        this.guardando = false;
        this.router.navigate(['/casos', caso.id]);
      },
      error: () => {
        this.guardando = false;
        this.errorGeneral =
          'No fue posible guardar el caso. Revisa los datos e inténtalo nuevamente.';
      },
    });
  }

  volver(): void {
    if (this.casoId) {
      this.router.navigate(['/casos', this.casoId]);
      return;
    }

    this.router.navigate(['/casos']);
  }

  private toDateTimeLocal(value: string): string {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hour}:${minute}`;
  }
}
