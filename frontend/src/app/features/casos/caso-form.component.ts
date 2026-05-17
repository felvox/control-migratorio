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

type TipoActa = 'MAYOR' | 'CON_MENOR';

@Component({
  selector: 'app-caso-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-grid caso-form-shell">
      <form [formGroup]="form" (ngSubmit)="guardar()" class="page-grid">
        <article class="card acta-sheet">
          <header class="sheet-header">
            <div class="identidad-block">
              <strong>REPÚBLICA DE CHILE</strong>
              <span>JAF “TARAPACÁ”</span>
              <span>Puesto Mando FT “Tarapacá 76”</span>
            </div>

            <div class="titulo-block">
              <h3>ACTA DE CONTROL MIGRATORIO</h3>
              <div class="titulo-meta">
                <span class="formato-pill" [class.formato-pill-menor]="esActaConMenor">
                  {{ esActaConMenor ? 'Formato con menor de edad' : 'Formato mayor de edad' }}
                </span>
                <button type="button" class="btn-secondary btn-sm" (click)="abrirModalTipoActa()">
                  Cambiar acta
                </button>
              </div>
            </div>
          </header>

          <section class="sheet-section">
            <h4>TIPO DE CONTROL</h4>

            <div class="control-radio-grid">
              <label class="control-option" [class.control-option-active]="form.get('tipoControl')?.value === 'INGRESO'">
                <input type="radio" formControlName="tipoControl" value="INGRESO" />
                <span>INGRESANDO A TERRITORIO NACIONAL</span>
              </label>

              <label class="control-option" [class.control-option-active]="form.get('tipoControl')?.value === 'EGRESO'">
                <input type="radio" formControlName="tipoControl" value="EGRESO" />
                <span>EGRESANDO DE TERRITORIO NACIONAL</span>
              </label>
            </div>

            <p class="procedimiento-texto">
              En <strong>{{ lugarProcedimientoTexto }}</strong>, a las
              <strong>{{ horaProcedimientoTexto }}</strong> hrs. del día
              <strong>{{ diaProcedimientoTexto }}</strong> del mes de
              <strong>{{ mesProcedimientoTexto }}</strong> del año
              <strong>{{ anioProcedimientoTexto }}</strong>, se hace entrega de:
            </p>

            <div class="form-grid">
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

              <div class="radio-field">
                <label>Viene acompañado</label>
                <div class="radio-group">
                  <label
                    class="radio-chip"
                    [class.radio-chip-active]="form.get('vieneAcompanado')?.value === true"
                  >
                    <input type="radio" formControlName="vieneAcompanado" [value]="true" />
                    <span>Sí</span>
                  </label>
                  <label
                    class="radio-chip"
                    [class.radio-chip-active]="form.get('vieneAcompanado')?.value === false"
                  >
                    <input type="radio" formControlName="vieneAcompanado" [value]="false" />
                    <span>No</span>
                  </label>
                </div>
              </div>
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
          </section>

          <section class="sheet-section">
            <div class="section-header">
              <h4>ANTECEDENTES PERSONALES</h4>
              <div class="personas-actions">
                <button type="button" class="btn-secondary" (click)="agregarAdulto()">
                  Agregar adulto
                </button>
                <button
                  type="button"
                  class="btn-secondary"
                  (click)="agregarMenor()"
                  *ngIf="esActaConMenor"
                >
                  Agregar menor
                </button>
              </div>
            </div>

            <div formArrayName="personas" class="page-grid personas-grid">
              <article
                *ngFor="let persona of personas.controls; let i = index"
                [formGroupName]="i"
                class="persona-card"
                [class.persona-card-menor]="persona.get('tipoPersona')?.value === 'MENOR'"
              >
                <div class="persona-header">
                  <strong>
                    {{ tituloPersonaBloque(persona.get('tipoPersona')?.value, i) }}
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

                <div class="form-grid persona-form-grid">
                  <div>
                    <label>Tipo persona</label>
                    <select formControlName="tipoPersona">
                      <option value="PRINCIPAL">Principal</option>
                      <option value="ACOMPANANTE">Acompañante</option>
                      <option value="MENOR" [disabled]="esActaMayor">Menor</option>
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
                    <label>Lugar de nacimiento</label>
                    <input formControlName="lugarNacimiento" />
                  </div>

                  <div>
                    <label>Fecha de nacimiento</label>
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
                    <label>C.I. / DNI / PASAPORTE</label>
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
                    <label>Correo electrónico</label>
                    <input formControlName="correo" />
                  </div>

                  <div>
                    <label>Teléfono</label>
                    <input formControlName="telefono" />
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section class="sheet-section">
            <h4>ANTECEDENTES MIGRATORIOS</h4>

            <div class="form-grid">
              <div>
                <label>Lugar</label>
                <input formControlName="lugar" />
              </div>

              <div>
                <label>Fecha de ingreso</label>
                <input type="date" formControlName="fechaIngreso" />
              </div>

              <div>
                <label>Coordenadas</label>
                <input formControlName="coordenadas" placeholder="Ej: -18.4783,-70.3126" />
              </div>

              <div class="radio-field">
                <label>Documentado</label>
                <div class="radio-group">
                  <label
                    class="radio-chip"
                    [class.radio-chip-active]="form.get('documentado')?.value === true"
                  >
                    <input type="radio" formControlName="documentado" [value]="true" />
                    <span>Sí</span>
                  </label>
                  <label
                    class="radio-chip"
                    [class.radio-chip-active]="form.get('documentado')?.value === false"
                  >
                    <input type="radio" formControlName="documentado" [value]="false" />
                    <span>No</span>
                  </label>
                </div>
              </div>

              <div class="radio-field">
                <label>Presenta lesiones</label>
                <div class="radio-group">
                  <label
                    class="radio-chip"
                    [class.radio-chip-active]="form.get('presentaLesiones')?.value === true"
                  >
                    <input type="radio" formControlName="presentaLesiones" [value]="true" />
                    <span>Sí</span>
                  </label>
                  <label
                    class="radio-chip"
                    [class.radio-chip-active]="form.get('presentaLesiones')?.value === false"
                  >
                    <input type="radio" formControlName="presentaLesiones" [value]="false" />
                    <span>No</span>
                  </label>
                </div>
              </div>

              <div>
                <label>Estado de salud (detalle)</label>
                <input formControlName="estadoSalud" placeholder="Detalle clínico o condición observada" />
              </div>
            </div>
          </section>

          <section class="sheet-section">
            <h4>OBSERVACIONES</h4>

            <div class="observaciones-field">
              <div class="observaciones-actions" *ngIf="!tieneObservaciones">
                <button type="button" class="btn-secondary" (click)="abrirModalObservaciones()">
                  Agregar observaciones
                </button>
              </div>

              <div class="observaciones-actions" *ngIf="tieneObservaciones">
                <button type="button" class="btn-secondary" (click)="editarObservaciones()">
                  Editar observaciones
                </button>
                <button type="button" class="btn-danger" (click)="eliminarObservaciones()">
                  Eliminar
                </button>
              </div>

              <p class="hint-text" *ngIf="tieneObservaciones">
                Observación guardada.
              </p>

              <div class="observaciones-preview" *ngIf="tieneObservaciones">
                {{ form.get('observaciones')?.value }}
              </div>
            </div>
          </section>

          <section class="sheet-section conocimiento-section">
            <h4>TOMA DE CONOCIMIENTO Y CONFORMIDAD</h4>

            <p class="conocimiento-texto">
              TOMA CONOCIMIENTO BAJO FIRMA, QUE SEGÚN EL ACUERDO INTERINSTITUCIONAL DE
              COOPERACIÓN MIGRATORIA ENTRE EL MINISTERIO DEL INTERIOR Y SEGURIDAD PÚBLICA Y EL
              MINISTERIO DE GOBIERNO DEL ESTADO PLURINACIONAL DE BOLIVIA DEL 20 DE DICIEMBRE DEL
              2024, SERÁ RETORNADO A BOLIVIA.
            </p>

            <div class="firma-grid">
              <div>
                <label>Firma en conformidad</label>
                <div class="firma-placeholder"></div>
              </div>

              <div>
                <label>Nombre y apellidos</label>
                <input [value]="nombrePrincipalTexto" readonly />
              </div>

              <div>
                <label>Cédula o pasaporte</label>
                <input [value]="documentoPrincipalTexto" readonly />
              </div>
            </div>

            <div class="funcionarios-grid">
              <article class="funcionario-box">
                <h5>FUNCIONARIO DE EJÉRCITO QUE ENTREGA</h5>
                <div class="funcionario-campos">
                  <div>
                    <label>Firma</label>
                    <div class="firma-placeholder"></div>
                  </div>
                  <div>
                    <label>Nombre</label>
                    <input value="" readonly />
                  </div>
                  <div>
                    <label>Grado</label>
                    <input value="" readonly />
                  </div>
                  <div>
                    <label>Unidad</label>
                    <input value="" readonly />
                  </div>
                </div>
              </article>

              <article class="funcionario-box">
                <h5>
                  {{
                    esActaConMenor
                      ? 'FUNCIONARIO QUE RECIBE/ENTREGA DE CARABINEROS'
                      : 'FUNCIONARIO QUE RECIBE/ENTREGA DE PDI'
                  }}
                </h5>
                <div class="funcionario-campos">
                  <div>
                    <label>Firma</label>
                    <div class="firma-placeholder"></div>
                  </div>
                  <div>
                    <label>Nombre</label>
                    <input value="" readonly />
                  </div>
                  <div>
                    <label>Grado</label>
                    <input value="" readonly />
                  </div>
                  <div>
                    <label>Unidad</label>
                    <input value="" readonly />
                  </div>
                </div>
              </article>
            </div>
          </section>
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

      <div class="modal-backdrop" *ngIf="mostrarModalActa">
        <section class="modal-card" role="dialog" aria-modal="true">
          <h3>Seleccionar tipo de acta</h3>
          <p class="modal-subtitle">
            Elige el formato para adaptar el formulario según corresponda.
          </p>

          <div class="acta-selector-grid">
            <button
              type="button"
              class="acta-option"
              [class.acta-option-active]="tipoActaPendiente === 'MAYOR'"
              (click)="seleccionarActaPendiente('MAYOR')"
            >
              <span class="acta-option-title">Mayor de edad</span>
              <span class="acta-option-sub">Derivación directa a PDI</span>
            </button>

            <button
              type="button"
              class="acta-option"
              [class.acta-option-active]="tipoActaPendiente === 'CON_MENOR'"
              (click)="seleccionarActaPendiente('CON_MENOR')"
            >
              <span class="acta-option-title">Con menor de edad</span>
              <span class="acta-option-sub">Derivación Carabineros y luego PDI</span>
            </button>
          </div>

          <div class="modal-actions">
            <button
              type="button"
              class="btn-primary"
              [disabled]="!tipoActaPendiente"
              (click)="confirmarTipoActaDesdeModal()"
            >
              Continuar
            </button>
          </div>
        </section>
      </div>

      <div class="modal-backdrop" *ngIf="mostrarModalObservaciones">
        <section class="modal-card observaciones-modal" role="dialog" aria-modal="true">
          <h3>Observaciones del caso</h3>
          <p class="modal-subtitle">
            Registra observaciones relevantes del procedimiento.
          </p>

          <textarea
            rows="6"
            [value]="observacionTemporal"
            (input)="actualizarObservacionTemporal($event)"
            placeholder="Escribe aquí las observaciones..."
          ></textarea>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="cerrarModalObservaciones()">
              Cancelar
            </button>
            <button type="button" class="btn-primary" (click)="guardarObservacionesDesdeModal()">
              Guardar
            </button>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      h2,
      h3,
      h4,
      h5 {
        margin: 0;
      }

      .caso-form-shell {
        max-width: 1320px;
      }

      .acta-sheet {
        display: grid;
        gap: 0.9rem;
        border-color: #cbd5df;
      }

      .sheet-header {
        display: grid;
        grid-template-columns: minmax(260px, 320px) 1fr;
        border: 1px solid #cbd5df;
        border-radius: 10px;
        overflow: hidden;
      }

      .identidad-block {
        background: #f5f8fb;
        border-right: 1px solid #cbd5df;
        padding: 0.8rem;
        display: grid;
        gap: 0.2rem;
        font-size: 0.83rem;
        color: #2f3f4f;
      }

      .titulo-block {
        padding: 0.8rem;
        display: grid;
        gap: 0.6rem;
      }

      .titulo-block h3 {
        font-size: 1.18rem;
        letter-spacing: 0.04em;
      }

      .titulo-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .formato-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 0.36rem 0.72rem;
        font-size: 0.8rem;
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

      .btn-sm {
        padding: 0.4rem 0.7rem;
        font-size: 0.82rem;
      }

      .sheet-section {
        border: 1px solid #cbd5df;
        border-radius: 10px;
        padding: 0.85rem;
        display: grid;
        gap: 0.75rem;
        background: #fff;
      }

      .sheet-section h4 {
        font-size: 0.9rem;
        letter-spacing: 0.05em;
        color: #2a3a4b;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .control-radio-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(220px, 1fr));
        gap: 0.55rem;
      }

      .control-option {
        border: 1px solid #cbd5df;
        border-radius: 8px;
        padding: 0.55rem 0.68rem;
        display: flex;
        align-items: center;
        gap: 0.52rem;
        cursor: pointer;
        font-size: 0.83rem;
        font-weight: 600;
        color: #324457;
      }

      .control-option input {
        width: auto;
        margin: 0;
        accent-color: var(--color-primary);
      }

      .control-option-active {
        border-color: #2f72da;
        background: #edf4ff;
      }

      .procedimiento-texto {
        margin: 0;
        border: 1px dashed #c7d3df;
        border-radius: 8px;
        padding: 0.55rem 0.7rem;
        font-size: 0.88rem;
        color: #314455;
        background: #fbfdff;
      }

      .flujo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 0.6rem;
      }

      .flujo-item {
        border: 1px solid #d6dee8;
        border-radius: 8px;
        background: #f9fbfd;
        padding: 0.58rem 0.68rem;
        display: grid;
        gap: 0.2rem;
      }

      .flujo-item label {
        margin: 0;
        font-size: 0.78rem;
      }

      .flujo-item strong {
        font-size: 0.9rem;
      }

      .personas-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .personas-grid {
        gap: 0.75rem;
      }

      .persona-card {
        border: 1px solid #d6dee8;
        border-radius: 10px;
        padding: 0.8rem;
        background: #fbfdff;
        display: grid;
        gap: 0.7rem;
      }

      .persona-card-menor {
        border-color: #f0c88b;
        background: #fffbf5;
      }

      .persona-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.6rem;
      }

      .persona-form-grid {
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      }

      .radio-field {
        display: grid;
        gap: 0.35rem;
      }

      .radio-group {
        display: flex;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .radio-chip {
        margin: 0;
        display: inline-flex;
        align-items: center;
        gap: 0.42rem;
        border: 1px solid #cdd6e0;
        border-radius: 999px;
        padding: 0.34rem 0.64rem;
        color: #1f3143;
        background: #fff;
        cursor: pointer;
      }

      .radio-chip input {
        width: auto;
        margin: 0;
        border: 0;
        padding: 0;
        accent-color: var(--color-primary);
      }

      .radio-chip-active {
        border-color: #0b4f6c;
        background: #e9f3f8;
        color: #13384a;
        font-weight: 600;
      }

      .observaciones-field {
        display: grid;
        gap: 0.45rem;
      }

      .observaciones-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .observaciones-preview {
        border: 1px solid #d7e1eb;
        border-radius: 8px;
        padding: 0.6rem;
        background: #fbfdff;
        white-space: pre-wrap;
        font-size: 0.88rem;
      }

      .conocimiento-section {
        background: #fdfefe;
      }

      .conocimiento-texto {
        margin: 0;
        font-size: 0.86rem;
        color: #324556;
        line-height: 1.35;
      }

      .firma-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.65rem;
      }

      .firma-placeholder {
        border: 1px solid #cfd8e2;
        border-radius: 8px;
        background: #fff;
        height: 42px;
      }

      .funcionarios-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(260px, 1fr));
        gap: 0.7rem;
      }

      .funcionario-box {
        border: 1px solid #d5deea;
        border-radius: 10px;
        padding: 0.68rem;
        display: grid;
        gap: 0.62rem;
        background: #fff;
      }

      .funcionario-box h5 {
        font-size: 0.78rem;
        letter-spacing: 0.03em;
        color: #2f4256;
      }

      .funcionario-campos {
        display: grid;
        grid-template-columns: repeat(2, minmax(130px, 1fr));
        gap: 0.55rem;
      }

      .hint-text {
        margin: 0;
        color: #5f6f82;
        font-size: 0.85rem;
      }

      .actions-row {
        display: flex;
        gap: 0.5rem;
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
        gap: 0.9rem;
      }

      .observaciones-modal {
        width: min(680px, 100%);
      }

      .modal-subtitle {
        margin: 0;
        font-size: 0.9rem;
        color: #5f7083;
      }

      .acta-selector-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 0.7rem;
      }

      .acta-option {
        display: grid;
        gap: 0.2rem;
        text-align: left;
        border: 1px solid var(--color-border);
        border-radius: 12px;
        background: #fbfdff;
        padding: 0.75rem 0.85rem;
      }

      .acta-option-title {
        font-size: 0.95rem;
        font-weight: 700;
        color: #1e2f42;
      }

      .acta-option-sub {
        font-size: 0.82rem;
        color: #64768a;
      }

      .acta-option-active {
        border-color: #2f72da;
        background: #edf4ff;
        box-shadow: inset 0 0 0 1px #2f72da;
      }

      .modal-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }

      @media (max-width: 1080px) {
        .sheet-header {
          grid-template-columns: 1fr;
        }

        .identidad-block {
          border-right: 0;
          border-bottom: 1px solid #cbd5df;
        }

        .control-radio-grid,
        .funcionarios-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 760px) {
        .actions-row {
          flex-wrap: wrap;
        }

        .persona-header,
        .section-header {
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

  mostrarModalActa = false;
  tipoActaPendiente: TipoActa | null = null;
  private tipoActaConfirmada = false;

  mostrarModalObservaciones = false;
  observacionTemporal = '';

  readonly form = this.fb.group({
    tipoActa: ['MAYOR' as TipoActa, Validators.required],
    tipoControl: ['INGRESO', Validators.required],
    fechaHoraProcedimiento: ['', Validators.required],
    lugar: ['', Validators.required],
    coordenadas: [''],
    fechaIngreso: [''],
    documentado: [true, Validators.required],
    presentaLesiones: [false],
    estadoSalud: [''],
    observaciones: [''],
    vieneAcompanado: [false, Validators.required],
    existenMenores: [false],
    personas: this.fb.array([this.crearPersonaForm('PRINCIPAL')]),
  });

  get modoEdicion(): boolean {
    return Boolean(this.casoId);
  }

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

  get tipoActaSeleccionado(): TipoActa {
    return (this.form.get('tipoActa')?.value as TipoActa) ?? 'MAYOR';
  }

  get esActaConMenor(): boolean {
    return this.tipoActaSeleccionado === 'CON_MENOR';
  }

  get esActaMayor(): boolean {
    return !this.esActaConMenor;
  }

  get derivacionAutomatica(): string {
    return this.esActaConMenor ? 'Carabineros' : 'PDI';
  }

  get estadoInicial(): string {
    return this.esActaConMenor ? 'Derivado Carabineros' : 'Derivado PDI';
  }

  get rutaProcedimiento(): string {
    return this.esActaConMenor ? 'Carabineros → PDI' : 'PDI';
  }

  get tieneObservaciones(): boolean {
    const observaciones = this.form.get('observaciones')?.value;
    return typeof observaciones === 'string' && observaciones.trim().length > 0;
  }

  get lugarProcedimientoTexto(): string {
    const lugar = (this.form.get('lugar')?.value as string | null)?.trim();
    return lugar && lugar.length > 0 ? lugar : '________';
  }

  get horaProcedimientoTexto(): string {
    const fecha = this.obtenerFechaProcedimiento();
    if (!fecha) {
      return '--:--';
    }

    const hora = String(fecha.getHours()).padStart(2, '0');
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    return `${hora}:${minutos}`;
  }

  get diaProcedimientoTexto(): string {
    const fecha = this.obtenerFechaProcedimiento();
    return fecha ? String(fecha.getDate()).padStart(2, '0') : '--';
  }

  get mesProcedimientoTexto(): string {
    const fecha = this.obtenerFechaProcedimiento();
    if (!fecha) {
      return '---';
    }

    const meses = [
      'ENE',
      'FEB',
      'MAR',
      'ABR',
      'MAY',
      'JUN',
      'JUL',
      'AGO',
      'SEP',
      'OCT',
      'NOV',
      'DIC',
    ];

    return meses[fecha.getMonth()] ?? '---';
  }

  get anioProcedimientoTexto(): string {
    const fecha = this.obtenerFechaProcedimiento();
    return fecha ? String(fecha.getFullYear()) : '----';
  }

  get nombrePrincipalTexto(): string {
    const principal = this.obtenerPersonaPrincipal();
    if (!principal) {
      return '';
    }

    const nombres = (principal.get('nombres')?.value as string | null)?.trim() ?? '';
    const apellidos = (principal.get('apellidos')?.value as string | null)?.trim() ?? '';
    return `${nombres} ${apellidos}`.trim();
  }

  get documentoPrincipalTexto(): string {
    const principal = this.obtenerPersonaPrincipal();
    if (!principal) {
      return '';
    }

    return ((principal.get('numeroDocumento')?.value as string | null) ?? '').trim();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.casoId = id;
      this.cargarCaso(id);
      return;
    }

    this.mostrarModalActa = true;
    this.tipoActaPendiente = null;
    this.tipoActaConfirmada = false;
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

  tituloPersonaBloque(tipo: TipoPersona | null | undefined, index: number): string {
    if (tipo === 'PRINCIPAL') {
      return 'ANTECEDENTES PERSONALES - PERSONA PRINCIPAL';
    }

    if (tipo === 'MENOR') {
      return `ANTECEDENTES DE MENOR ${index + 1}`;
    }

    return `ANTECEDENTES PERSONALES ADICIONALES ${index + 1}`;
  }

  seleccionarTipoActa(tipoActa: TipoActa): void {
    this.form.patchValue({
      tipoActa,
      existenMenores: tipoActa === 'CON_MENOR',
    });

    if (tipoActa === 'CON_MENOR' && this.totalMenoresDetectados === 0) {
      this.agregarMenor();
      return;
    }

    if (tipoActa === 'MAYOR') {
      this.personas.controls.forEach((persona) => {
        if ((persona.get('tipoPersona')?.value as TipoPersona) === 'MENOR') {
          persona.get('tipoPersona')?.setValue('ACOMPANANTE');
        }
      });
    }
  }

  abrirModalTipoActa(): void {
    this.tipoActaPendiente = this.tipoActaSeleccionado;
    this.mostrarModalActa = true;
  }

  seleccionarActaPendiente(tipoActa: TipoActa): void {
    this.tipoActaPendiente = tipoActa;
  }

  confirmarTipoActaDesdeModal(): void {
    if (!this.tipoActaPendiente) {
      return;
    }

    this.seleccionarTipoActa(this.tipoActaPendiente);
    this.tipoActaConfirmada = true;
    this.mostrarModalActa = false;
    this.errorGeneral = '';
  }

  agregarAdulto(): void {
    this.personas.push(this.crearPersonaForm('ACOMPANANTE'));
  }

  agregarMenor(): void {
    this.form.patchValue({
      tipoActa: 'CON_MENOR',
      existenMenores: true,
    });
    this.personas.push(this.crearPersonaForm('MENOR'));
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

  abrirModalObservaciones(): void {
    const observacionesActuales = this.form.get('observaciones')?.value;
    this.observacionTemporal =
      typeof observacionesActuales === 'string' ? observacionesActuales : '';
    this.mostrarModalObservaciones = true;
  }

  editarObservaciones(): void {
    this.abrirModalObservaciones();
  }

  cerrarModalObservaciones(): void {
    this.mostrarModalObservaciones = false;
  }

  actualizarObservacionTemporal(event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;
    this.observacionTemporal = target?.value ?? '';
  }

  guardarObservacionesDesdeModal(): void {
    this.form.patchValue({
      observaciones: this.observacionTemporal.trim(),
    });
    this.mostrarModalObservaciones = false;
  }

  eliminarObservaciones(): void {
    this.form.patchValue({
      observaciones: '',
    });
    this.observacionTemporal = '';
  }

  cargarCaso(id: string): void {
    this.casosService.obtenerPorId(id).subscribe((caso) => {
      const menoresEnPersonas = caso.personas.some(
        (persona) => persona.tipoPersona === 'MENOR' || persona.edad < 18,
      );
      const tipoActa: TipoActa =
        caso.existenMenores || menoresEnPersonas ? 'CON_MENOR' : 'MAYOR';

      this.form.patchValue({
        tipoActa,
        tipoControl: caso.tipoControl,
        fechaHoraProcedimiento: this.toDateTimeLocal(caso.fechaHoraProcedimiento),
        lugar: caso.lugar,
        coordenadas: caso.coordenadas ?? '',
        fechaIngreso: caso.fechaIngreso ? caso.fechaIngreso.slice(0, 10) : '',
        documentado: caso.documentado,
        presentaLesiones: this.inferirPresentaLesiones(caso.estadoSalud),
        estadoSalud: this.limpiarDetalleEstadoSalud(caso.estadoSalud),
        observaciones: caso.observaciones ?? '',
        vieneAcompanado: caso.vieneAcompanado,
        existenMenores: tipoActa === 'CON_MENOR',
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

      this.tipoActaConfirmada = true;
      this.mostrarModalActa = false;
      this.tipoActaPendiente = tipoActa;
      this.observacionTemporal = caso.observaciones ?? '';
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

    if (this.esActaConMenor && this.totalMenoresDetectados === 0) {
      this.errorGeneral =
        'Seleccionaste “Con menor de edad”, pero no hay una persona menor registrada.';
      return false;
    }

    if (this.esActaMayor && this.totalMenoresDetectados > 0) {
      this.errorGeneral =
        'El tipo de acta es “Mayor de edad”, pero existe al menos un menor en la composición del grupo.';
      return false;
    }

    return true;
  }

  guardar(): void {
    this.errorGeneral = '';

    if (!this.tipoActaConfirmada) {
      this.errorGeneral = 'Debes seleccionar el tipo de acta antes de guardar el caso.';
      this.mostrarModalActa = true;
      return;
    }

    if (this.form.invalid || this.guardando) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.validarComposicionGrupo()) {
      return;
    }

    this.guardando = true;

    const raw = this.form.getRawValue();
    const detalleSalud = (raw.estadoSalud || '').trim();
    const resumenSalud = raw.presentaLesiones ? 'Presenta lesiones' : 'Sin lesiones';
    const estadoSalud = detalleSalud ? `${resumenSalud}. ${detalleSalud}` : resumenSalud;

    const payload = {
      tipoControl: raw.tipoControl,
      fechaHoraProcedimiento: raw.fechaHoraProcedimiento,
      lugar: raw.lugar,
      coordenadas: raw.coordenadas || undefined,
      fechaIngreso: raw.fechaIngreso || undefined,
      documentado: Boolean(raw.documentado),
      estadoSalud,
      observaciones: raw.observaciones || undefined,
      vieneAcompanado:
        Boolean(raw.vieneAcompanado) || this.personas.length > 1,
      existenMenores: this.esActaConMenor,
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

  private obtenerFechaProcedimiento(): Date | null {
    const raw = this.form.get('fechaHoraProcedimiento')?.value as string | null;
    if (!raw) {
      return null;
    }

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  private obtenerPersonaPrincipal(): FormGroup | null {
    const principal = this.personas.controls.find(
      (persona) => persona.get('tipoPersona')?.value === 'PRINCIPAL',
    );

    if (principal) {
      return principal as FormGroup;
    }

    if (this.personas.length > 0) {
      return this.personas.at(0) as FormGroup;
    }

    return null;
  }

  private inferirPresentaLesiones(estadoSalud: string | null | undefined): boolean {
    if (!estadoSalud) {
      return false;
    }

    const normalizado = estadoSalud.toLowerCase();
    if (normalizado.includes('sin lesiones')) {
      return false;
    }

    return normalizado.includes('lesion');
  }

  private limpiarDetalleEstadoSalud(estadoSalud: string | null | undefined): string {
    if (!estadoSalud) {
      return '';
    }

    return estadoSalud
      .replace(/^presenta lesiones[\s\.:\-]*/i, '')
      .replace(/^sin lesiones[\s\.:\-]*/i, '')
      .trim();
  }
}
