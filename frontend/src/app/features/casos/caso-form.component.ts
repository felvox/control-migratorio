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
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import {
  Caso,
  Evidencia,
  TipoPersona,
  TipoEvidencia,
} from '../../core/models/caso.model';
import { CasosService } from './casos.service';
import { AlertModalComponent } from '../../shared/components/alert-modal.component';

type TipoActa = 'MAYOR' | 'CON_MENOR';
type GuardadoAccion = 'GUARDAR' | 'GUARDAR_Y_PDF';
type PasoClave =
  | 'procedimiento'
  | 'antecedentes_personales'
  | 'antecedentes_menor'
  | 'antecedentes_migratorios'
  | 'evidencias'
  | 'observaciones'
  | 'resumen';

interface PasoFormulario {
  clave: PasoClave;
  titulo: string;
}

@Component({
  selector: 'app-caso-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AlertModalComponent],
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
                <button
                  *ngIf="!modoEdicion && pasoActual === 'procedimiento'"
                  type="button"
                  class="btn-secondary btn-sm"
                  (click)="abrirModalTipoActa()"
                >
                  Cambiar acta
                </button>
              </div>
            </div>
          </header>

          <nav class="wizard-steps" aria-label="Progreso del formulario">
            <button
              *ngFor="let paso of pasosVisibles; let i = index"
              type="button"
              class="wizard-step"
              [class.wizard-step-active]="pasoActual === paso.clave"
              [class.wizard-step-done]="i < pasoActualIndex"
              (click)="irAPaso(i)"
            >
              <span class="wizard-step-index">{{ i < pasoActualIndex ? '✓' : i + 1 }}</span>
              <span class="wizard-step-title">{{ paso.titulo }}</span>
            </button>
          </nav>

          <section class="sheet-section" *ngIf="pasoActual === 'procedimiento'">
            <h4>1. DATOS DEL PROCEDIMIENTO</h4>

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
              <strong>{{ anioProcedimientoTexto }}</strong>, se inicia el procedimiento de control.
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
            </div>

          </section>

          <section class="sheet-section" *ngIf="pasoActual === 'antecedentes_personales'" formArrayName="personas">
            <h4>2. ANTECEDENTES PERSONALES</h4>

            <article class="persona-card" [formGroupName]="indicePersonaPrincipal">
              <div class="persona-header">
                <strong>ANTECEDENTES PERSONALES</strong>
              </div>

              <div class="form-grid persona-form-grid">
                <div>
                  <label>Nombres y apellidos</label>
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
                    (change)="actualizarEdad(indicePersonaPrincipal)"
                  />
                </div>

                <div>
                  <label>EDAD</label>
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
          </section>

          <section class="sheet-section" *ngIf="pasoActual === 'antecedentes_menor'" formArrayName="personas">
            <div class="section-header">
              <h4>3. ANTECEDENTES DE MENOR</h4>
              <button type="button" class="btn-secondary btn-sm" (click)="agregarMenor()">
                Agregar menor
              </button>
            </div>

            <article
              class="persona-card persona-card-menor"
              *ngFor="let indiceMenor of indicesPersonasMenores; let orden = index"
              [formGroupName]="indiceMenor"
            >
              <div class="persona-header">
                <strong>ANTECEDENTES DE MENOR {{ orden + 1 }}</strong>
                <button
                  type="button"
                  class="btn-danger btn-sm"
                  *ngIf="puedeEliminarMenor"
                  (click)="eliminarMenor(indiceMenor)"
                >
                  Quitar
                </button>
              </div>

              <div class="form-grid persona-form-grid">
                <div>
                  <label>Nombre y apellidos</label>
                  <input formControlName="nombres" />
                </div>

                <div>
                  <label>Apellidos</label>
                  <input formControlName="apellidos" />
                </div>

                <div>
                  <label>F./Nacimiento</label>
                  <input
                    type="date"
                    formControlName="fechaNacimiento"
                    (change)="actualizarEdad(indiceMenor)"
                  />
                </div>

                <div>
                  <label>Nacionalidad</label>
                  <input formControlName="nacionalidad" />
                </div>

                <div>
                  <label>Ciudad de origen</label>
                  <input formControlName="lugarNacimiento" />
                </div>

                <div>
                  <label>Acta Nac. o ced. Id.</label>
                  <input formControlName="numeroDocumento" />
                </div>

                <div>
                  <label>Edad</label>
                  <input type="number" formControlName="edad" />
                </div>
              </div>
            </article>
          </section>

          <section class="sheet-section" *ngIf="pasoActual === 'antecedentes_migratorios'">
            <h4>{{ esActaConMenor ? '4' : '3' }}. ANTECEDENTES MIGRATORIOS</h4>

            <div class="migratorio-grid">
              <div class="migratorio-item">
                <label>Fecha de ingreso</label>
                <input type="date" formControlName="fechaIngreso" />
              </div>

              <div class="radio-field migratorio-item">
                <label>Documentado</label>
                <div class="radio-group radio-group-compact">
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

              <div class="radio-field migratorio-item">
                <label>Presenta lesiones</label>
                <div class="radio-group radio-group-compact">
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

              <div class="migratorio-item migratorio-item-salud">
                <label>Estado de salud (detalle)</label>
                <input formControlName="estadoSalud" [placeholder]="placeholderEstadoSalud" />
              </div>
            </div>
          </section>

          <section class="sheet-section" *ngIf="pasoActual === 'evidencias'">
            <div class="section-header">
              <h4>{{ esActaConMenor ? '5' : '4' }}. EVIDENCIAS</h4>
              <button type="button" class="btn-secondary" (click)="agregarEvidencia()">
                Agregar evidencia
              </button>
            </div>

            <p class="hint-text">Formatos permitidos: JPG, JPEG, PNG y PDF. Tamaño máximo {{ maxUploadMb }} MB.</p>

            <div class="evidencias-existentes" *ngIf="evidenciasExistentes.length > 0">
              <h5>Evidencias cargadas en el caso</h5>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Archivo</th>
                      <th>Fecha</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let evidencia of evidenciasExistentes">
                      <td>{{ etiquetaTipoEvidencia(evidencia.tipoEvidencia) }}</td>
                      <td>{{ evidencia.nombreOriginal }}</td>
                      <td>{{ evidencia.creadoAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                      <td>
                        <button type="button" class="btn-secondary btn-sm" (click)="descargarEvidencia(evidencia)">
                          Descargar
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <p class="hint-text" *ngIf="evidenciasFormArray.length === 0 && evidenciasExistentes.length === 0">
              No has agregado evidencias aún.
            </p>

            <div class="evidencias-grid" *ngIf="evidenciasFormArray.length > 0">
              <article class="evidencia-card" *ngFor="let evidencia of evidenciasFormArray.controls; let i = index" [formGroup]="evidenciaFormAt(i)">
                <div class="form-grid evidencia-form-grid">
                  <div>
                    <label>Tipo de evidencia</label>
                    <select formControlName="tipoEvidencia">
                      <option value="FOTO_PERSONA">Foto persona</option>
                      <option value="DOCUMENTO_IDENTIDAD">Documento identidad</option>
                      <option value="ADJUNTO_GENERAL">Adjunto general</option>
                    </select>
                  </div>

                  <div>
                    <label>Persona asociada (opcional)</label>
                    <select formControlName="personaRef">
                      <option value="">Sin persona</option>
                      <option *ngFor="let index of indicesTodasLasPersonas" [value]="index">
                        {{ personaEtiqueta(index) }}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label>Archivo</label>
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" (change)="onArchivoEvidenciaChange($event, i)" />
                  </div>
                </div>

                <p class="hint-text" *ngIf="evidenciaFormAt(i).get('archivoNombre')?.value">
                  Archivo: {{ evidenciaFormAt(i).get('archivoNombre')?.value }}
                </p>
                <p class="error-text" *ngIf="evidenciaFormAt(i).get('archivoError')?.value as archivoError">
                  {{ archivoError }}
                </p>

                <div class="evidencia-actions">
                  <button type="button" class="btn-danger" (click)="eliminarEvidencia(i)">
                    Quitar evidencia
                  </button>
                </div>
              </article>
            </div>
          </section>

          <section class="sheet-section" *ngIf="pasoActual === 'observaciones'">
            <h4>{{ esActaConMenor ? '6' : '5' }}. OBSERVACIONES Y TOMA DE CONOCIMIENTO</h4>

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

              <div class="observaciones-preview" *ngIf="tieneObservaciones">
                {{ form.get('observaciones')?.value }}
              </div>
            </div>

            <div class="conocimiento-box">
              <p class="conocimiento-texto">
                TOMA DE CONOCIMIENTO BAJO CONFORMIDAD, SEGÚN PROTOCOLO DE CONTROL MIGRATORIO.
              </p>

              <label class="radio-chip check-chip" [class.radio-chip-active]="form.get('tomaConocimiento')?.value === true">
                <input type="checkbox" formControlName="tomaConocimiento" />
                <span>Confirmo toma de conocimiento y conformidad del procedimiento.</span>
              </label>

              <div class="form-grid">
                <div>
                  <label>ID funcionario</label>
                  <input [value]="authService.currentUser?.id || 'Sin sesión'" readonly />
                </div>
                <div>
                  <label>RUN funcionario</label>
                  <input [value]="authService.currentUser?.run || 'Sin sesión'" readonly />
                </div>
                <div>
                  <label>Funcionario responsable</label>
                  <input [value]="authService.currentUser?.nombreCompleto || 'Sin sesión'" readonly />
                </div>
              </div>
            </div>
          </section>

          <section class="sheet-section" *ngIf="pasoActual === 'resumen'">
            <h4>{{ esActaConMenor ? '7' : '6' }}. RESUMEN FINAL Y SALIDA DOCUMENTAL</h4>

            <div class="resumen-grid">
              <article class="resumen-card">
                <label>Tipo de acta</label>
                <strong>{{ esActaConMenor ? 'Con menor de edad' : 'Mayor de edad' }}</strong>
              </article>

              <article class="resumen-card">
                <label>Total personas</label>
                <strong>{{ totalPersonas }}</strong>
              </article>

              <article class="resumen-card" *ngIf="esActaConMenor">
                <label>Total menores</label>
                <strong>{{ totalMenoresDetectados }}</strong>
              </article>

              <article class="resumen-card">
                <label>Evidencias preparadas</label>
                <strong>{{ totalEvidenciasPreparadas }}</strong>
              </article>

              <article class="resumen-card">
                <label>Derivación</label>
                <strong>{{ derivacionAutomatica }}</strong>
              </article>

              <article class="resumen-card">
                <label>Ruta</label>
                <strong>{{ rutaProcedimiento }}</strong>
              </article>
            </div>

          </section>
        </article>

        <p class="error-text" *ngIf="errorGeneral">{{ errorGeneral }}</p>

        <div class="actions-row actions-row-wizard">
          <button type="button" class="btn-secondary" (click)="anteriorPaso()" [disabled]="esPrimerPaso">
            Anterior
          </button>

          <button
            type="button"
            class="btn-primary"
            *ngIf="!esUltimoPaso"
            (click)="siguientePaso()"
          >
            Siguiente
          </button>

          <button
            type="button"
            class="btn-primary"
            *ngIf="esUltimoPaso"
            [disabled]="guardando"
            (click)="guardar('GUARDAR')"
          >
            {{ guardando ? 'Guardando...' : (modoEdicion ? 'Actualizar caso' : 'Guardar caso') }}
          </button>

          <button
            type="button"
            class="btn-secondary"
            *ngIf="esUltimoPaso"
            [disabled]="guardando"
            (click)="guardar('GUARDAR_Y_PDF')"
          >
            {{ guardando ? 'Procesando...' : (modoEdicion ? 'Actualizar y descargar PDF' : 'Guardar y descargar PDF') }}
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

      <app-alert-modal
        [open]="alertExitoAbierto"
        title="Operación completada"
        [message]="alertaExitoMensaje"
        variant="success"
        (accepted)="cerrarAlertaExito()"
      />

      <app-alert-modal
        [open]="alertAvisoAbierto"
        title="Aviso"
        [message]="alertaAvisoMensaje"
        variant="warning"
        (accepted)="cerrarAlertaAviso()"
      />
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

      .wizard-steps {
        display: flex;
        flex-wrap: nowrap;
        gap: 0.5rem;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: thin;
        padding-bottom: 0.25rem;
      }

      .wizard-step {
        flex: 0 0 auto;
        border: 1px solid #efbcc4;
        background: #fff3f6;
        border-radius: 999px;
        padding: 0.35rem 0.68rem;
        display: inline-flex;
        align-items: center;
        gap: 0.42rem;
        color: #8a4252;
        transition: all 180ms ease;
      }

      .wizard-step:not(.wizard-step-active):not(.wizard-step-done) {
        opacity: 1;
      }

      .wizard-step-index {
        width: 1.35rem;
        height: 1.35rem;
        border-radius: 999px;
        display: inline-grid;
        place-items: center;
        font-size: 0.75rem;
        font-weight: 700;
        border: 1px solid #efbcc4;
        background: #fff7f8;
        color: #8a4252;
      }

      .wizard-step-title {
        font-size: 0.8rem;
        font-weight: 600;
      }

      .wizard-step-active {
        border-color: #0a5a84;
        background: linear-gradient(180deg, #0f5f89 0%, #0a4f73 100%);
        color: #ffffff;
        box-shadow: 0 6px 14px rgba(10, 79, 115, 0.22);
        transform: translateY(-1px);
      }

      .wizard-step-active .wizard-step-index {
        border-color: #0a5a84;
        background: #ffffff;
        color: #0a4f73;
      }

      .wizard-step-active .wizard-step-title {
        color: #fff;
      }

      .wizard-step-done {
        border-color: #a9d8bb;
        background: #edf9f1;
        color: #246846;
      }

      .wizard-step-done .wizard-step-index {
        border-color: #2f8f5f;
        background: #2f8f5f;
        color: #ffffff;
      }

      .sheet-section {
        border: 1px solid #cbd5df;
        border-radius: 10px;
        padding: 0.85rem;
        display: grid;
        gap: 0.75rem;
        background: #fff;
      }

      .sheet-subsection {
        border: 1px dashed #d3ddea;
        border-radius: 10px;
        padding: 0.75rem;
        display: grid;
        gap: 0.6rem;
        background: #fbfdff;
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
        grid-template-columns: repeat(2, minmax(220px, 1fr));
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

      .resumen-personas-grid {
        display: grid;
        gap: 0.55rem;
      }

      .resumen-persona {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.55rem;
        border: 1px solid #d9e2ed;
        border-radius: 8px;
        padding: 0.55rem 0.65rem;
        background: #fff;
      }

      .resumen-persona p {
        margin: 0.2rem 0 0;
        color: #556678;
        font-size: 0.86rem;
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

      .migratorio-grid {
        display: grid;
        grid-template-columns: minmax(220px, 1.2fr) minmax(190px, 1fr) minmax(190px, 1fr);
        gap: 0.75rem;
        align-items: start;
      }

      .migratorio-item {
        display: grid;
        gap: 0.35rem;
      }

      .migratorio-item-salud {
        grid-column: 1 / -1;
      }

      .radio-group {
        display: flex;
        gap: 0.45rem;
        flex-wrap: wrap;
      }

      .radio-group-compact .radio-chip {
        min-width: 72px;
        justify-content: center;
        padding: 0.42rem 0.68rem;
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

      .check-chip {
        width: fit-content;
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

      .conocimiento-box {
        border: 1px solid #d6dfeb;
        border-radius: 10px;
        padding: 0.75rem;
        background: #fbfdff;
        display: grid;
        gap: 0.7rem;
      }

      .conocimiento-texto {
        margin: 0;
        font-size: 0.86rem;
        color: #324556;
        line-height: 1.35;
      }

      .evidencias-grid {
        display: grid;
        gap: 0.65rem;
      }

      .evidencias-existentes {
        border: 1px solid #d5deea;
        border-radius: 10px;
        background: #fbfdff;
        padding: 0.7rem;
        display: grid;
        gap: 0.45rem;
      }

      .evidencias-existentes h5 {
        margin: 0;
        font-size: 0.86rem;
        color: #24384c;
      }

      .evidencia-card {
        border: 1px solid #d5deea;
        border-radius: 10px;
        background: #fbfdff;
        padding: 0.7rem;
        display: grid;
        gap: 0.45rem;
      }

      .evidencia-form-grid {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }

      .evidencia-actions {
        display: flex;
        justify-content: flex-end;
      }

      .resumen-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.6rem;
      }

      .resumen-card {
        border: 1px solid #d5deea;
        border-radius: 10px;
        background: #fbfdff;
        padding: 0.62rem;
        display: grid;
        gap: 0.24rem;
      }

      .resumen-card label {
        margin: 0;
        font-size: 0.78rem;
      }

      .resumen-card strong {
        font-size: 1rem;
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

      .actions-row-wizard {
        flex-wrap: wrap;
        justify-content: flex-end;
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

        .control-radio-grid {
          grid-template-columns: 1fr;
        }

        .migratorio-grid {
          grid-template-columns: 1fr;
        }

        .migratorio-item-salud {
          grid-column: auto;
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
  readonly authService = inject(AuthService);

  private readonly fb = inject(FormBuilder);
  private readonly casosService = inject(CasosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly maxUploadSizeBytes = 10 * 1024 * 1024;
  readonly maxUploadMb = 10;
  private readonly marcadorConformidad = '[CONFORMIDAD_SISTEMA]';

  guardando = false;
  casoId: string | null = null;
  errorGeneral = '';
  evidenciasExistentes: Evidencia[] = [];

  alertExitoAbierto = false;
  alertaExitoMensaje = '';
  alertAvisoAbierto = false;
  alertaAvisoMensaje = '';
  private rutaRedireccionPostExito: string[] | null = null;

  mostrarModalActa = false;
  tipoActaPendiente: TipoActa | null = null;
  private tipoActaConfirmada = false;

  mostrarModalObservaciones = false;
  observacionTemporal = '';

  pasoActual: PasoClave = 'procedimiento';

  readonly pasosBase: PasoFormulario[] = [
    { clave: 'procedimiento', titulo: 'Procedimiento' },
    { clave: 'antecedentes_personales', titulo: 'Antecedentes personales' },
    { clave: 'antecedentes_menor', titulo: 'Antecedentes de menor' },
    { clave: 'antecedentes_migratorios', titulo: 'Antecedentes migratorios' },
    { clave: 'evidencias', titulo: 'Evidencias' },
    { clave: 'observaciones', titulo: 'Observaciones' },
    { clave: 'resumen', titulo: 'Resumen y PDF' },
  ];

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
    tomaConocimiento: [false, Validators.requiredTrue],
    vieneAcompanado: [false],
    existenMenores: [false],
    personas: this.fb.array([this.crearPersonaForm('PRINCIPAL')]),
  });

  readonly evidenciasFormArray = this.fb.array<FormGroup>([]);

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
      return tipo === 'MENOR';
    }).length;
  }

  get totalEvidenciasPendientes(): number {
    return this.evidenciasFormArray.controls.filter((control) => {
      const archivo = control.get('archivoObj')?.value as File | null;
      return Boolean(archivo);
    }).length;
  }

  get totalEvidenciasPreparadas(): number {
    return this.evidenciasExistentes.length + this.totalEvidenciasPendientes;
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

  get pasosVisibles(): PasoFormulario[] {
    if (this.esActaConMenor) {
      return [...this.pasosBase];
    }

    return this.pasosBase.filter((paso) => paso.clave !== 'antecedentes_menor');
  }

  get pasoActualIndex(): number {
    const index = this.pasosVisibles.findIndex((paso) => paso.clave === this.pasoActual);
    return index >= 0 ? index : 0;
  }

  get esPrimerPaso(): boolean {
    return this.pasoActualIndex === 0;
  }

  get esUltimoPaso(): boolean {
    return this.pasoActualIndex === this.pasosVisibles.length - 1;
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

  get placeholderEstadoSalud(): string {
    const presentaLesiones = this.form.get('presentaLesiones')?.value === true;
    return presentaLesiones
      ? 'Ej: Lesión superficial / condición observada'
      : 'Ej: Sin lesiones observables';
  }

  get indicesTodasLasPersonas(): number[] {
    return this.personas.controls.map((_control, index) => index);
  }

  get indicePersonaPrincipal(): number {
    const index = this.personas.controls.findIndex(
      (control) => (control.get('tipoPersona')?.value as TipoPersona) === 'PRINCIPAL',
    );
    return index >= 0 ? index : 0;
  }

  get indicesPersonasMenores(): number[] {
    return this.personas.controls
      .map((control, index) => ({
        index,
        tipo: control.get('tipoPersona')?.value as TipoPersona,
      }))
      .filter((item) => item.tipo === 'MENOR')
      .map((item) => item.index);
  }

  get puedeEliminarMenor(): boolean {
    return this.indicesPersonasMenores.length > 1;
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
    this.sincronizarPersonasSegunActa('MAYOR');
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

  personaFormAt(index: number): FormGroup {
    return this.personas.at(index) as FormGroup;
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

  personaEtiqueta(index: number): string {
    const persona = this.personaFormAt(index);
    const nombres = (persona.get('nombres')?.value as string | null)?.trim() ?? '';
    const apellidos = (persona.get('apellidos')?.value as string | null)?.trim() ?? '';
    const tipo = (persona.get('tipoPersona')?.value as TipoPersona) ?? 'ACOMPANANTE';
    const nombreCompleto = `${nombres} ${apellidos}`.trim();
    return `${tipo} - ${nombreCompleto || 'Sin nombre'}`;
  }

  seleccionarTipoActa(tipoActa: TipoActa): void {
    this.form.patchValue({
      tipoActa,
      existenMenores: tipoActa === 'CON_MENOR',
      vieneAcompanado: tipoActa === 'CON_MENOR',
    });
    this.sincronizarPersonasSegunActa(tipoActa);
    this.ajustarPasoActual();
  }

  abrirModalTipoActa(): void {
    if (this.modoEdicion) {
      return;
    }

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

  actualizarEdad(index: number): void {
    const persona = this.personaFormAt(index);
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

  agregarMenor(): void {
    if (!this.esActaConMenor) {
      return;
    }

    this.personas.push(this.crearPersonaForm('MENOR'));
    this.form.patchValue({
      vieneAcompanado: true,
      existenMenores: true,
    });
  }

  eliminarMenor(index: number): void {
    if (!this.esActaConMenor) {
      return;
    }

    const indicesMenores = this.indicesPersonasMenores;
    if (indicesMenores.length <= 1) {
      return;
    }

    this.personas.removeAt(index);
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

  agregarEvidencia(): void {
    this.evidenciasFormArray.push(
      this.fb.group({
        tipoEvidencia: ['ADJUNTO_GENERAL' as TipoEvidencia, Validators.required],
        personaRef: [''],
        archivoNombre: [''],
        archivoObj: [null as File | null],
        archivoError: [''],
      }),
    );
  }

  eliminarEvidencia(index: number): void {
    this.evidenciasFormArray.removeAt(index);
  }

  evidenciaFormAt(index: number): FormGroup {
    return this.evidenciasFormArray.at(index) as FormGroup;
  }

  onArchivoEvidenciaChange(event: Event, index: number): void {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.[0] ?? null;
    const evidenciaForm = this.evidenciaFormAt(index);

    if (!file) {
      evidenciaForm.patchValue({
        archivoNombre: '',
        archivoObj: null,
        archivoError: '',
      });
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const extensionesPermitidas = ['jpg', 'jpeg', 'png', 'pdf'];

    if (!extensionesPermitidas.includes(extension)) {
      evidenciaForm.patchValue({
        archivoNombre: '',
        archivoObj: null,
        archivoError: 'Formato no permitido. Usa JPG, JPEG, PNG o PDF.',
      });
      if (target) {
        target.value = '';
      }
      return;
    }

    if (file.size > this.maxUploadSizeBytes) {
      evidenciaForm.patchValue({
        archivoNombre: '',
        archivoObj: null,
        archivoError: `El archivo supera ${this.maxUploadMb} MB.`,
      });
      if (target) {
        target.value = '';
      }
      return;
    }

    evidenciaForm.patchValue({
      archivoNombre: file.name,
      archivoObj: file,
      archivoError: '',
    });
  }

  irAPaso(index: number): void {
    if (index < 0 || index >= this.pasosVisibles.length) {
      return;
    }

    if (this.modoEdicion) {
      this.errorGeneral = '';
      this.pasoActual = this.pasosVisibles[index]?.clave ?? this.pasoActual;
      return;
    }

    if (index > this.pasoActualIndex) {
      return;
    }

    this.errorGeneral = '';
    this.pasoActual = this.pasosVisibles[index]?.clave ?? this.pasoActual;
  }

  siguientePaso(): void {
    this.errorGeneral = '';

    if (!this.validarPasoActual()) {
      return;
    }

    const nextIndex = this.pasoActualIndex + 1;
    if (nextIndex >= this.pasosVisibles.length) {
      return;
    }

    this.pasoActual = this.pasosVisibles[nextIndex]?.clave ?? this.pasoActual;
  }

  anteriorPaso(): void {
    const prevIndex = this.pasoActualIndex - 1;
    if (prevIndex < 0) {
      return;
    }

    this.pasoActual = this.pasosVisibles[prevIndex]?.clave ?? this.pasoActual;
  }

  cargarCaso(id: string): void {
    this.casosService.obtenerPorId(id).subscribe((caso) => {
      const menoresEnPersonas = caso.personas.some(
        (persona) => persona.tipoPersona === 'MENOR' || persona.edad < 18,
      );
      const tipoActa: TipoActa =
        caso.existenMenores || menoresEnPersonas ? 'CON_MENOR' : 'MAYOR';

      const observacionesParseadas = this.extraerObservacionesBase(caso.observaciones);

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
        observaciones: observacionesParseadas,
        tomaConocimiento: true,
        vieneAcompanado: tipoActa === 'CON_MENOR',
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

      this.sincronizarPersonasSegunActa(tipoActa);
      this.evidenciasExistentes = [...(caso.evidencias ?? [])];

      this.tipoActaConfirmada = true;
      this.mostrarModalActa = false;
      this.tipoActaPendiente = tipoActa;
      this.observacionTemporal = observacionesParseadas;
      this.ajustarPasoActual();
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

    const totalMenores = personas.filter((persona) => persona.tipoPersona === 'MENOR').length;
    const totalNoPermitidosConMenor = personas.filter(
      (persona) => persona.tipoPersona !== 'PRINCIPAL' && persona.tipoPersona !== 'MENOR',
    ).length;

    if (this.esActaMayor) {
      if (personas.length !== 1 || totalMenores > 0) {
        this.errorGeneral =
          'El formato de mayor de edad admite una sola persona principal.';
        return false;
      }
    }

    if (this.esActaConMenor) {
      if (totalMenores < 1 || personas.length < 2) {
        this.errorGeneral =
          'El formato con menor de edad requiere 1 persona principal y al menos 1 menor.';
        return false;
      }

      if (totalNoPermitidosConMenor > 0) {
        this.errorGeneral =
          'En este formato solo se permiten 1 persona principal y menores de edad.';
        return false;
      }

      if (personas.length !== totalMenores + 1) {
        this.errorGeneral =
          'La composición del caso con menor debe ser 1 persona principal y uno o más menores.';
        return false;
      }
    }

    return true;
  }

  private validarPasoActual(): boolean {
    const paso = this.pasoActual;

    if (paso === 'procedimiento') {
      this.marcarControlesTocados(['tipoControl', 'fechaHoraProcedimiento', 'lugar']);
      if (
        this.form.get('tipoControl')?.invalid ||
        this.form.get('fechaHoraProcedimiento')?.invalid ||
        this.form.get('lugar')?.invalid
      ) {
        this.errorGeneral = 'Completa los datos obligatorios del procedimiento.';
        return false;
      }

      return this.validarComposicionGrupo();
    }

    if (paso === 'antecedentes_personales') {
      const validoAdultos = this.validarPersonasPorIndices([this.indicePersonaPrincipal]);
      if (!validoAdultos) {
        this.errorGeneral = 'Completa los campos obligatorios de antecedentes personales.';
        return false;
      }

      return this.validarComposicionGrupo();
    }

    if (paso === 'antecedentes_menor') {
      if (!this.esActaConMenor) {
        return true;
      }

      const indicesMenores = this.indicesPersonasMenores;
      const validoMenores = this.validarPersonasPorIndices(indicesMenores);
      if (!validoMenores) {
        this.errorGeneral = 'Completa los campos obligatorios de antecedentes de menor.';
        return false;
      }

      return this.validarComposicionGrupo();
    }

    if (paso === 'evidencias') {
      const tieneErrores = this.evidenciasFormArray.controls.some((control) => {
        const archivoError = (control.get('archivoError')?.value as string | null) ?? '';
        return archivoError.trim().length > 0;
      });

      if (tieneErrores) {
        this.errorGeneral = 'Corrige los errores de archivos en evidencias antes de continuar.';
        return false;
      }

      const filasSinArchivo = this.evidenciasFormArray.controls.some((control) => {
        const archivoObj = control.get('archivoObj')?.value as File | null;
        return !archivoObj;
      });

      if (filasSinArchivo && this.evidenciasFormArray.length > 0) {
        this.errorGeneral =
          'Hay evidencias agregadas sin archivo. Selecciona el archivo o elimina la fila.';
        return false;
      }

      return true;
    }

    if (paso === 'observaciones') {
      this.form.get('tomaConocimiento')?.markAsTouched();
      if (this.form.get('tomaConocimiento')?.invalid) {
        this.errorGeneral = '';
        this.abrirAlertaAviso(
          'Para continuar, confirma la toma de conocimiento y conformidad del procedimiento.',
        );
        return false;
      }

      return true;
    }

    if (paso === 'resumen') {
      this.form.markAllAsTouched();

      if (!this.validarComposicionGrupo()) {
        return false;
      }

      if (this.form.invalid) {
        this.errorGeneral = 'Revisa los campos obligatorios pendientes en el formulario.';
        return false;
      }

      return true;
    }

    return true;
  }

  async guardar(accion: GuardadoAccion = 'GUARDAR'): Promise<void> {
    this.errorGeneral = '';

    if (!this.tipoActaConfirmada) {
      this.errorGeneral = 'Debes seleccionar el tipo de acta antes de guardar el caso.';
      this.mostrarModalActa = true;
      return;
    }

    if (!this.validarPasoActual()) {
      return;
    }

    if (this.form.invalid || this.guardando) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando = true;

    const raw = this.form.getRawValue();
    const detalleSalud = (raw.estadoSalud || '').trim();
    const resumenSalud = raw.presentaLesiones ? 'Presenta lesiones' : 'Sin lesiones';
    const estadoSalud = detalleSalud ? `${resumenSalud}. ${detalleSalud}` : resumenSalud;

    const observacionesFinales = this.construirObservacionesFinal(raw.observaciones ?? '');

    const payload = {
      tipoControl: raw.tipoControl,
      fechaHoraProcedimiento: raw.fechaHoraProcedimiento,
      lugar: raw.lugar,
      coordenadas: raw.coordenadas || undefined,
      fechaIngreso: raw.fechaIngreso || undefined,
      documentado: Boolean(raw.documentado),
      estadoSalud,
      observaciones: observacionesFinales,
      vieneAcompanado: this.esActaConMenor,
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

    try {
      const request$ = this.casoId
        ? this.casosService.actualizar(this.casoId, payload)
        : this.casosService.crear(payload);

      const casoGuardado = await firstValueFrom(request$);

      await this.subirEvidenciasPendientes(casoGuardado);

      if (accion === 'GUARDAR_Y_PDF') {
        const documento = await firstValueFrom(this.casosService.generarActaPdf(casoGuardado.id));
        const blob = await firstValueFrom(this.casosService.descargarDocumento(documento.id));
        this.descargarBlob(blob, documento.nombreOriginal);
      }

      this.guardando = false;
      this.evidenciasExistentes = [...(casoGuardado.evidencias ?? this.evidenciasExistentes)];
      this.rutaRedireccionPostExito = ['/casos', casoGuardado.id];
      this.abrirAlertaExito(this.modoEdicion ? 'Caso actualizado correctamente.' : 'Caso creado correctamente.');
    } catch (_error) {
      this.guardando = false;
      this.errorGeneral =
        'No fue posible guardar el caso. Revisa los datos e inténtalo nuevamente.';
    }
  }

  volver(): void {
    if (this.casoId) {
      this.router.navigate(['/casos', this.casoId]);
      return;
    }

    this.router.navigate(['/casos']);
  }

  private async subirEvidenciasPendientes(caso: Caso): Promise<void> {
    if (this.evidenciasFormArray.length === 0) {
      return;
    }

    const subidas = this.evidenciasFormArray.controls
      .map((control) => this.construirSubidaEvidencia(control as FormGroup, caso))
      .filter((item): item is ReturnType<CasosService['subirEvidencia']> => item !== null);

    if (subidas.length === 0) {
      return;
    }

    await Promise.all(subidas.map((subida) => firstValueFrom(subida)));
  }

  private construirSubidaEvidencia(control: FormGroup, caso: Caso) {
    const archivo = control.get('archivoObj')?.value as File | null;
    if (!archivo) {
      return null;
    }

    const tipoEvidencia =
      (control.get('tipoEvidencia')?.value as TipoEvidencia | null) ?? 'ADJUNTO_GENERAL';
    const personaRef = (control.get('personaRef')?.value as string | null) ?? '';

    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('tipoEvidencia', tipoEvidencia);

    if (personaRef !== '') {
      const personaIndex = Number(personaRef);
      const personaId = caso.personas[personaIndex]?.id;
      if (personaId) {
        formData.append('personaId', personaId);
      }
    }

    return this.casosService.subirEvidencia(caso.id, formData);
  }

  etiquetaTipoEvidencia(tipo: TipoEvidencia): string {
    if (tipo === 'FOTO_PERSONA') {
      return 'Foto persona';
    }
    if (tipo === 'DOCUMENTO_IDENTIDAD') {
      return 'Documento identidad';
    }
    return 'Adjunto general';
  }

  descargarEvidencia(evidencia: Evidencia): void {
    this.casosService.descargarEvidencia(evidencia.id).subscribe((blob) => {
      this.descargarBlob(blob, evidencia.nombreOriginal);
    });
  }

  abrirAlertaExito(mensaje: string): void {
    this.alertaExitoMensaje = mensaje;
    this.alertExitoAbierto = true;
  }

  async cerrarAlertaExito(): Promise<void> {
    this.alertExitoAbierto = false;
    this.alertaExitoMensaje = '';

    if (this.rutaRedireccionPostExito) {
      const destino = [...this.rutaRedireccionPostExito];
      this.rutaRedireccionPostExito = null;
      await this.router.navigate(destino);
    }
  }

  abrirAlertaAviso(mensaje: string): void {
    this.alertaAvisoMensaje = mensaje;
    this.alertAvisoAbierto = true;
  }

  cerrarAlertaAviso(): void {
    this.alertAvisoAbierto = false;
    this.alertaAvisoMensaje = '';
  }

  private construirObservacionesFinal(observacionesRaw: string): string | undefined {
    const observacionesBase = this.extraerObservacionesBase(observacionesRaw);
    return observacionesBase || undefined;
  }

  private extraerObservacionesBase(observaciones: string | null | undefined): string {
    if (!observaciones) {
      return '';
    }

    const markerIndex = observaciones.indexOf(this.marcadorConformidad);
    if (markerIndex < 0) {
      return observaciones.trim();
    }

    return observaciones.slice(0, markerIndex).trim();
  }

  private marcarControlesTocados(controles: string[]): void {
    controles.forEach((control) => {
      this.form.get(control)?.markAsTouched();
    });
  }

  private validarPersonasPorIndices(indices: number[]): boolean {
    let valido = true;

    indices.forEach((index) => {
      const grupo = this.personaFormAt(index);
      grupo.markAllAsTouched();
      if (grupo.invalid) {
        valido = false;
      }
    });

    return valido;
  }

  private ajustarPasoActual(): void {
    const existePasoActual = this.pasosVisibles.some((paso) => paso.clave === this.pasoActual);
    if (existePasoActual) {
      return;
    }

    this.pasoActual = 'antecedentes_migratorios';
  }

  private sincronizarPersonasSegunActa(tipoActa: TipoActa): void {
    const personasActuales = this.personas.controls.map((control) =>
      (control as FormGroup).getRawValue(),
    );

    const principalActual =
      personasActuales.find((persona) => persona.tipoPersona === 'PRINCIPAL') ??
      personasActuales[0] ??
      null;
    const menoresActuales = personasActuales.filter(
      (persona) => persona.tipoPersona === 'MENOR',
    );
    const otrosNoPrincipales = personasActuales.filter(
      (persona) =>
        persona.tipoPersona !== 'PRINCIPAL' && persona.tipoPersona !== 'MENOR',
    );
    const menoresRecuperados =
      menoresActuales.length > 0
        ? menoresActuales
        : otrosNoPrincipales.map((persona) => ({
            ...persona,
            tipoPersona: 'MENOR' as TipoPersona,
          }));

    const principalForm = this.crearPersonaForm('PRINCIPAL');
    if (principalActual) {
      principalForm.patchValue({ ...principalActual, tipoPersona: 'PRINCIPAL' });
    }

    this.personas.clear();
    this.personas.push(principalForm);

    if (tipoActa === 'CON_MENOR') {
      if (menoresRecuperados.length === 0) {
        this.personas.push(this.crearPersonaForm('MENOR'));
        return;
      }

      menoresRecuperados.forEach((menorActual) => {
        const menorForm = this.crearPersonaForm('MENOR');
        menorForm.patchValue({ ...menorActual, tipoPersona: 'MENOR' });
        this.personas.push(menorForm);
      });
    }
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

  private descargarBlob(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = nombre;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}
