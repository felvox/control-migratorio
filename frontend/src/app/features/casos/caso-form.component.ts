import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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
import { Jaf } from '../../core/models/auth.model';
import { CasosService } from './casos.service';
import { AlertModalComponent } from '../../shared/components/alert-modal.component';
import { etiquetaTipoEvidencia as etiquetaTipoEvidenciaPresentacion } from './casos-presentacion.utils';

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
  templateUrl: './caso-form.component.html',
  styleUrl: './caso-form.component.css',
})
export class CasoFormComponent implements OnInit, OnDestroy {
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
  readonly estadosCiviles = [
    'Soltero(a)',
    'Casado(a)',
    'Divorciado(a)',
    'Viudo(a)',
    'Separado(a)',
    'Unión civil',
  ];
  readonly nacionalidadesFrecuentes = [
    'Venezuela',
    'Bolivia',
    'Colombia',
    'Cuba',
    'Rep. Dominicana',
    'Haití',
    'Perú',
    'Ecuador',
    'Otra',
  ];

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

  get fechaNacimientoMaxMenorIso(): string {
    return this.formatearFechaIso(new Date());
  }

  get fechaNacimientoMinMenorIso(): string {
    const min = new Date();
    min.setFullYear(min.getFullYear() - 18);
    return this.formatearFechaIso(min);
  }

  get fechaNacimientoMaxMayorIso(): string {
    const max = new Date();
    max.setFullYear(max.getFullYear() - 18);
    return this.formatearFechaIso(max);
  }

  get fechaNacimientoMinMayorIso(): string {
    const min = new Date();
    min.setFullYear(min.getFullYear() - 110);
    return this.formatearFechaIso(min);
  }

  get placeholderEstadoSalud(): string {
    const presentaLesiones = this.form.get('presentaLesiones')?.value === true;
    return presentaLesiones
      ? 'Ej: Lesión superficial / condición observada'
      : 'Bloqueado: seleccionar "Sí" en presenta lesiones';
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
    this.inicializarReglaEstadoSalud();

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

  ngOnDestroy(): void {
    this.liberarPreviewsTemporales();
  }

  crearPersonaForm(tipo: TipoPersona = 'ACOMPANANTE'): FormGroup {
    const validadoresEdad = [Validators.required, Validators.min(0)];
    if (tipo === 'MENOR') {
      validadoresEdad.push(Validators.max(18));
    }

    return this.fb.group({
      tipoPersona: [tipo, Validators.required],
      nombres: ['', Validators.required],
      apellidos: ['', Validators.required],
      nacionalidad: ['', Validators.required],
      fechaNacimiento: ['', Validators.required],
      edad: [null, validadoresEdad],
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

  cancelarModalTipoActa(): void {
    if (!this.tipoActaConfirmada) {
      this.mostrarModalActa = false;
      this.errorGeneral = '';
      void this.router.navigate([this.authService.resolveHomeByRole()]);
      return;
    }

    this.mostrarModalActa = false;
    this.errorGeneral = '';
  }

  actualizarEdad(index: number): void {
    const persona = this.personaFormAt(index);
    const fechaNacimiento = persona.get('fechaNacimiento')?.value as string;

    if (!fechaNacimiento) {
      return;
    }

    const edad = this.calcularEdadDesdeFecha(fechaNacimiento);
    if (edad === null) {
      persona.patchValue({ edad: null }, { emitEvent: false });
      return;
    }

    persona.patchValue({ edad }, { emitEvent: false });
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
    const evidenciaForm = this.fb.group({
      tipoEvidencia: ['ADJUNTO_GENERAL' as TipoEvidencia, Validators.required],
      personaRef: [''],
      archivoNombre: [''],
      archivoObj: [null as File | null],
      archivoError: [''],
      previewUrl: [''],
      previewEsImagen: [false],
      previewEsPdf: [false],
    });

    evidenciaForm.get('tipoEvidencia')?.valueChanges.subscribe((tipo) => {
      this.sincronizarPersonaEvidencia(evidenciaForm, tipo as TipoEvidencia);
    });
    this.sincronizarPersonaEvidencia(evidenciaForm, 'ADJUNTO_GENERAL');

    this.evidenciasFormArray.push(evidenciaForm);
  }

  eliminarEvidencia(index: number): void {
    const evidenciaForm = this.evidenciaFormAt(index);
    this.limpiarPreviewTemporal(evidenciaForm);
    this.evidenciasFormArray.removeAt(index);
  }

  evidenciaFormAt(index: number): FormGroup {
    return this.evidenciasFormArray.at(index) as FormGroup;
  }

  tipoEvidenciaRequierePersona(tipo: TipoEvidencia | null | undefined): boolean {
    return tipo === 'FOTO_PERSONA' || tipo === 'DOCUMENTO_IDENTIDAD';
  }

  onArchivoEvidenciaChange(event: Event, index: number): void {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.[0] ?? null;
    const evidenciaForm = this.evidenciaFormAt(index);
    this.limpiarPreviewTemporal(evidenciaForm);

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
      const mensaje = 'Formato no permitido. Usa JPG, JPEG, PNG o PDF.';
      evidenciaForm.patchValue({
        archivoNombre: '',
        archivoObj: null,
        archivoError: mensaje,
      });
      this.abrirAlertaAviso(`Evidencia ${index + 1}: ${mensaje}`);
      if (target) {
        target.value = '';
      }
      return;
    }

    if (file.size > this.maxUploadSizeBytes) {
      const mensaje = `El archivo supera ${this.maxUploadMb} MB.`;
      evidenciaForm.patchValue({
        archivoNombre: '',
        archivoObj: null,
        archivoError: mensaje,
      });
      this.abrirAlertaAviso(`Evidencia ${index + 1}: ${mensaje}`);
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
    this.aplicarPreviewTemporal(evidenciaForm, file);
  }

  abrirPreviewArchivo(url: string): void {
    if (!url) {
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
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
      if (caso.estado !== 'PENDIENTE') {
        this.router.navigate(['/casos', id]);
        return;
      }

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
      this.errorGeneral = '';
      this.abrirAlertaAviso('Debe ingresar al menos una persona en el caso.');
      return false;
    }

    const totalPrincipales = personas.filter(
      (persona) => persona.tipoPersona === 'PRINCIPAL',
    ).length;

    if (totalPrincipales === 0) {
      this.errorGeneral = '';
      this.abrirAlertaAviso('Debe existir una persona principal.');
      return false;
    }

    if (totalPrincipales > 1) {
      this.errorGeneral = '';
      this.abrirAlertaAviso('Solo puede existir una persona principal por caso.');
      return false;
    }

    const totalMenores = personas.filter((persona) => persona.tipoPersona === 'MENOR').length;
    const totalNoPermitidosConMenor = personas.filter(
      (persona) => persona.tipoPersona !== 'PRINCIPAL' && persona.tipoPersona !== 'MENOR',
    ).length;

    if (this.esActaMayor) {
      if (personas.length !== 1 || totalMenores > 0) {
        this.errorGeneral = '';
        this.abrirAlertaAviso(
          'El formato de mayor de edad admite una sola persona principal.',
        );
        return false;
      }
    }

    if (this.esActaConMenor) {
      if (totalMenores < 1 || personas.length < 2) {
        this.errorGeneral = '';
        this.abrirAlertaAviso(
          'El formato con menor de edad requiere 1 persona principal y al menos 1 menor.',
        );
        return false;
      }

      if (totalNoPermitidosConMenor > 0) {
        this.errorGeneral = '';
        this.abrirAlertaAviso(
          'En este formato solo se permiten 1 persona principal y menores de edad.',
        );
        return false;
      }

      if (personas.length !== totalMenores + 1) {
        this.errorGeneral = '';
        this.abrirAlertaAviso(
          'La composición del caso con menor debe ser 1 persona principal y uno o más menores.',
        );
        return false;
      }
    }

    return true;
  }

  private validarPasoActual(): boolean {
    const paso = this.pasoActual;

    if (paso === 'procedimiento') {
      this.marcarControlesTocados(['tipoControl', 'fechaHoraProcedimiento', 'lugar']);
      const camposFaltantes = this.obtenerCamposFaltantesProcedimiento();
      if (camposFaltantes.length > 0) {
        this.errorGeneral = '';
        this.abrirAlertaAviso(
          this.construirMensajeCamposFaltantesProcedimiento(camposFaltantes),
        );
        return false;
      }

      return this.validarComposicionGrupo();
    }

    if (paso === 'antecedentes_personales') {
      const faltantesPrincipal = this.obtenerCamposFaltantesPersona(this.indicePersonaPrincipal);
      if (faltantesPrincipal.length > 0) {
        this.errorGeneral = '';
        this.abrirAlertaAviso(
          this.construirMensajeCamposFaltantesSeccion(
            'antecedentes personales',
            faltantesPrincipal,
          ),
        );
        return false;
      }

      return this.validarComposicionGrupo();
    }

    if (paso === 'antecedentes_menor') {
      if (!this.esActaConMenor) {
        return true;
      }

      const indicesMenores = this.indicesPersonasMenores;
      for (let i = 0; i < indicesMenores.length; i += 1) {
        const indiceMenor = indicesMenores[i];
        const faltantesMenor = this.obtenerCamposFaltantesPersona(indiceMenor);
        if (faltantesMenor.length > 0) {
          this.errorGeneral = '';
          this.abrirAlertaAviso(
            this.construirMensajeCamposFaltantesSeccion(
              `antecedentes de menor ${i + 1}`,
              faltantesMenor,
            ),
          );
          return false;
        }
      }

      return this.validarComposicionGrupo();
    }

    if (paso === 'antecedentes_migratorios') {
      const faltantesMigratorios = this.obtenerCamposFaltantesMigratorios();
      if (faltantesMigratorios.length > 0) {
        this.errorGeneral = '';
        this.abrirAlertaAviso(
          this.construirMensajeCamposFaltantesSeccion(
            'antecedentes migratorios',
            faltantesMigratorios,
          ),
        );
        return false;
      }

      return true;
    }

    if (paso === 'evidencias') {
      return this.validarEvidenciasAntesDeGuardar();
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
        const pendientes = this.obtenerPendientesResumen();
        this.errorGeneral = '';
        this.abrirAlertaAviso(
          pendientes.length > 0
            ? `Revisa los datos pendientes: ${this.formatearListaCampos(pendientes)}.`
            : 'Revisa los campos obligatorios pendientes en el formulario.',
        );
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

    if (!this.validarEvidenciasAntesDeGuardar()) {
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
    } catch (error) {
      this.guardando = false;
      const mensaje = this.obtenerMensajeErrorGuardado(error);
      this.errorGeneral = '';
      this.abrirAlertaAviso(mensaje);
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

  private aplicarPreviewTemporal(evidenciaForm: FormGroup, file: File): void {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const esImagen = ['jpg', 'jpeg', 'png'].includes(extension);
    const esPdf = extension === 'pdf';

    if (!esImagen && !esPdf) {
      evidenciaForm.patchValue({
        previewUrl: '',
        previewEsImagen: false,
        previewEsPdf: false,
      });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    evidenciaForm.patchValue({
      previewUrl,
      previewEsImagen: esImagen,
      previewEsPdf: esPdf,
    });
  }

  private limpiarPreviewTemporal(evidenciaForm: FormGroup): void {
    const urlActual = (evidenciaForm.get('previewUrl')?.value as string | null) ?? '';
    if (urlActual.startsWith('blob:')) {
      URL.revokeObjectURL(urlActual);
    }

    evidenciaForm.patchValue({
      previewUrl: '',
      previewEsImagen: false,
      previewEsPdf: false,
    });
  }

  private liberarPreviewsTemporales(): void {
    this.evidenciasFormArray.controls.forEach((control) => {
      this.limpiarPreviewTemporal(control as FormGroup);
    });
  }

  private sincronizarPersonaEvidencia(
    evidenciaForm: FormGroup,
    tipo: TipoEvidencia | null | undefined,
  ): void {
    const personaControl = evidenciaForm.get('personaRef');
    if (!personaControl) {
      return;
    }

    if (!this.tipoEvidenciaRequierePersona(tipo)) {
      return;
    }

    const valorActual = (personaControl.value as string | null) ?? '';
    if (valorActual !== '') {
      return;
    }

    personaControl.setValue(String(this.indicePersonaPrincipal), {
      emitEvent: false,
    });
  }

  etiquetaTipoEvidencia(tipo: TipoEvidencia): string {
    return etiquetaTipoEvidenciaPresentacion(tipo);
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

  private obtenerMensajeErrorGuardado(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (Array.isArray(error.error?.message) && error.error.message.length > 0) {
        return error.error.message.join(' | ');
      }

      if (typeof error.error?.message === 'string' && error.error.message.trim().length > 0) {
        return error.error.message;
      }
    }

    return 'No fue posible guardar el caso. Revisa los datos e inténtalo nuevamente.';
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

  private obtenerCamposFaltantesProcedimiento(): string[] {
    const faltantes: string[] = [];

    const tipoControl = this.form.get('tipoControl')?.value as string | null;
    if (!tipoControl || tipoControl.trim().length === 0) {
      faltantes.push('tipo de control');
    }

    const fechaHora = this.form.get('fechaHoraProcedimiento')?.value as string | null;
    if (!fechaHora || fechaHora.trim().length === 0) {
      faltantes.push('fecha y hora del procedimiento');
    }

    const lugar = this.form.get('lugar')?.value as string | null;
    if (!lugar || lugar.trim().length === 0) {
      faltantes.push('lugar');
    }

    return faltantes;
  }

  private construirMensajeCamposFaltantesProcedimiento(camposFaltantes: string[]): string {
    return `Falta completar ${this.formatearListaCampos(camposFaltantes)}.`;
  }

  private construirMensajeCamposFaltantesSeccion(
    seccion: string,
    camposFaltantes: string[],
  ): string {
    return `En ${seccion} falta completar ${this.formatearListaCampos(camposFaltantes)}.`;
  }

  private formatearListaCampos(items: string[]): string {
    if (items.length === 1) {
      return items[0] ?? '';
    }

    if (items.length === 2) {
      return `${items[0]} y ${items[1]}`;
    }

    const ultimo = items[items.length - 1] ?? '';
    const primeros = items.slice(0, -1).join(', ');
    return `${primeros} y ${ultimo}`;
  }

  private validarEvidenciasAntesDeGuardar(): boolean {
    const tieneErrores = this.evidenciasFormArray.controls.some((control) => {
      const archivoError = (control.get('archivoError')?.value as string | null) ?? '';
      return archivoError.trim().length > 0;
    });

    if (tieneErrores) {
      const primeraConError = this.evidenciasFormArray.controls.findIndex((control) => {
        const archivoError = (control.get('archivoError')?.value as string | null) ?? '';
        return archivoError.trim().length > 0;
      });
      const detalleError =
        primeraConError >= 0
          ? ((this.evidenciasFormArray.at(primeraConError) as FormGroup).get('archivoError')
              ?.value as string | null) ?? ''
          : '';
      this.errorGeneral = '';
      this.abrirAlertaAviso(
        detalleError.trim().length > 0
          ? `Evidencia ${primeraConError + 1}: ${detalleError}`
          : 'Corrige los errores de archivos en evidencias antes de continuar.',
      );
      return false;
    }

    const filasSinArchivo = this.evidenciasFormArray.controls
      .map((control, index) => ({
        index,
        archivoObj: control.get('archivoObj')?.value as File | null,
      }))
      .filter((item) => !item.archivoObj)
      .map((item) => item.index + 1);

    if (filasSinArchivo.length > 0) {
      this.errorGeneral = '';
      this.abrirAlertaAviso(
        `Falta seleccionar archivo en la evidencia ${this.formatearListaCampos(filasSinArchivo.map((fila) => String(fila)))}.`,
      );
      return false;
    }

    for (let i = 0; i < this.evidenciasFormArray.length; i += 1) {
      const evidenciaForm = this.evidenciaFormAt(i);
      const tipo = (evidenciaForm.get('tipoEvidencia')?.value as TipoEvidencia | null) ?? 'ADJUNTO_GENERAL';
      const personaRef = (evidenciaForm.get('personaRef')?.value as string | null) ?? '';

      if (!this.tipoEvidenciaRequierePersona(tipo)) {
        continue;
      }

      if (personaRef === '') {
        this.errorGeneral = '';
        this.abrirAlertaAviso(
          `Evidencia ${i + 1}: selecciona la persona asociada para ${this.etiquetaTipoEvidencia(tipo).toLowerCase()}.`,
        );
        return false;
      }

      const personaIndex = Number(personaRef);
      if (Number.isNaN(personaIndex) || !this.personas.at(personaIndex)) {
        this.errorGeneral = '';
        this.abrirAlertaAviso(
          `Evidencia ${i + 1}: la persona asociada seleccionada no es válida.`,
        );
        return false;
      }
    }

    return true;
  }

  private obtenerCamposFaltantesPersona(index: number): string[] {
    const persona = this.personaFormAt(index);
    persona.markAllAsTouched();

    const faltantes: string[] = [];
    const tipoPersona = (persona.get('tipoPersona')?.value as TipoPersona) ?? 'ACOMPANANTE';
    const campos: Array<{ control: string; etiqueta: string }> = [
      { control: 'nombres', etiqueta: 'nombres' },
      { control: 'apellidos', etiqueta: 'apellidos' },
      { control: 'nacionalidad', etiqueta: 'nacionalidad' },
      { control: 'fechaNacimiento', etiqueta: 'fecha de nacimiento' },
      { control: 'numeroDocumento', etiqueta: 'documento de identidad' },
    ];

    campos.forEach((campo) => {
      const valor = persona.get(campo.control)?.value;
      const texto = typeof valor === 'string' ? valor.trim() : '';
      if (!texto) {
        faltantes.push(campo.etiqueta);
      }
    });

    const edadControl = persona.get('edad');
    const edadRaw = edadControl?.value;
    const edadNumero = Number(edadRaw);
    if (edadRaw === null || edadRaw === '' || Number.isNaN(edadNumero) || edadNumero < 0) {
      faltantes.push('edad');
    } else if (tipoPersona === 'MENOR' && edadNumero > 18) {
      faltantes.push('edad (debe ser 18 años o menor)');
    }

    if (tipoPersona === 'MENOR') {
      const fechaNacimiento = (persona.get('fechaNacimiento')?.value as string | null)?.trim() ?? '';
      const edadCalculada = this.calcularEdadDesdeFecha(fechaNacimiento);
      if (!fechaNacimiento || edadCalculada === null || edadCalculada > 18 || edadCalculada < 0) {
        faltantes.push('fecha de nacimiento válida para menor de edad');
      }
    }

    if (tipoPersona === 'PRINCIPAL') {
      const fechaNacimiento = (persona.get('fechaNacimiento')?.value as string | null)?.trim() ?? '';
      const edadCalculada = this.calcularEdadDesdeFecha(fechaNacimiento);
      if (!fechaNacimiento || edadCalculada === null || edadCalculada < 18 || edadCalculada > 110) {
        faltantes.push('fecha de nacimiento válida para mayor de edad');
      }
    }

    return Array.from(new Set(faltantes));
  }

  private obtenerCamposFaltantesMigratorios(): string[] {
    const faltantes: string[] = [];
    const fechaIngreso = this.form.get('fechaIngreso')?.value as string | null;
    const estadoSalud = this.form.get('estadoSalud')?.value as string | null;
    const documentado = this.form.get('documentado')?.value as boolean | null;
    const presentaLesiones = this.form.get('presentaLesiones')?.value as boolean | null;

    if (!fechaIngreso || fechaIngreso.trim().length === 0) {
      faltantes.push('fecha de ingreso');
    }

    if (documentado === null || documentado === undefined) {
      faltantes.push('documentado');
    }

    if (presentaLesiones === null || presentaLesiones === undefined) {
      faltantes.push('presenta lesiones');
    }

    if (presentaLesiones === true && (!estadoSalud || estadoSalud.trim().length === 0)) {
      faltantes.push('detalle de lesión');
    }

    return faltantes;
  }

  private inicializarReglaEstadoSalud(): void {
    const controlLesiones = this.form.get('presentaLesiones');
    if (!controlLesiones) {
      return;
    }

    this.aplicarReglaEstadoSalud(controlLesiones.value === true, false);
    controlLesiones.valueChanges.subscribe((valor) => {
      this.aplicarReglaEstadoSalud(valor === true, true);
    });
  }

  private aplicarReglaEstadoSalud(
    presentaLesiones: boolean,
    limpiarDetalleCuandoNoLesiones: boolean,
  ): void {
    const controlEstadoSalud = this.form.get('estadoSalud');
    if (!controlEstadoSalud) {
      return;
    }

    if (presentaLesiones) {
      controlEstadoSalud.enable({ emitEvent: false });
      controlEstadoSalud.setValidators([Validators.required]);
      controlEstadoSalud.updateValueAndValidity({ emitEvent: false });
      return;
    }

    if (limpiarDetalleCuandoNoLesiones) {
      controlEstadoSalud.setValue('', { emitEvent: false });
    }
    controlEstadoSalud.clearValidators();
    controlEstadoSalud.disable({ emitEvent: false });
    controlEstadoSalud.updateValueAndValidity({ emitEvent: false });
  }

  private obtenerPendientesResumen(): string[] {
    const pendientes = new Set<string>();

    this.obtenerCamposFaltantesProcedimiento().forEach((campo) =>
      pendientes.add(`procedimiento: ${campo}`),
    );

    this.obtenerCamposFaltantesPersona(this.indicePersonaPrincipal).forEach((campo) =>
      pendientes.add(`antecedentes personales: ${campo}`),
    );

    if (this.esActaConMenor) {
      this.indicesPersonasMenores.forEach((indiceMenor, idx) => {
        this.obtenerCamposFaltantesPersona(indiceMenor).forEach((campo) => {
          pendientes.add(`antecedentes de menor ${idx + 1}: ${campo}`);
        });
      });
    }

    this.obtenerCamposFaltantesMigratorios().forEach((campo) =>
      pendientes.add(`antecedentes migratorios: ${campo}`),
    );

    if (this.form.get('tomaConocimiento')?.invalid) {
      pendientes.add('toma de conocimiento y conformidad');
    }

    return Array.from(pendientes);
  }

  private ajustarPasoActual(): void {
    const existePasoActual = this.pasosVisibles.some((paso) => paso.clave === this.pasoActual);
    if (existePasoActual) {
      return;
    }

    this.pasoActual = 'antecedentes_migratorios';
  }

  private calcularEdadDesdeFecha(fechaIso: string): number | null {
    if (!fechaIso || !fechaIso.includes('-')) {
      return null;
    }

    const partes = fechaIso.split('-').map((parte) => Number(parte));
    if (partes.length !== 3 || partes.some((parte) => Number.isNaN(parte))) {
      return null;
    }

    const [anio, mes, dia] = partes;
    if (!anio || !mes || !dia) {
      return null;
    }

    const nacimiento = new Date(anio, mes - 1, dia);
    if (Number.isNaN(nacimiento.getTime())) {
      return null;
    }

    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const diferenciaMes = hoy.getMonth() - nacimiento.getMonth();

    if (diferenciaMes < 0 || (diferenciaMes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad -= 1;
    }

    return edad;
  }

  private formatearFechaIso(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
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
