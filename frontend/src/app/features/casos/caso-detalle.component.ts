import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CasosService, CerrarPdiPayload } from './casos.service';
import {
  Caso,
  Evidencia,
  EstadoCaso,
  PdiResultado,
  PdiSituacionMigratoria,
  TipoControl,
} from '../../core/models/caso.model';
import { AuthService } from '../../core/services/auth.service';
import { AlertModalComponent } from '../../shared/components/alert-modal.component';
import { HttpErrorResponse } from '@angular/common/http';
import { SidebarCountersService } from '../../core/services/sidebar-counters.service';
import {
  EstadoClaseCss,
  etiquetaEstado as etiquetaEstadoPresentacion,
  etiquetaJaf as etiquetaJafPresentacion,
  etiquetaOrdenJudicialPdi as etiquetaOrdenJudicialPdiPresentacion,
  etiquetaReconduciblePdi as etiquetaReconduciblePdiPresentacion,
  etiquetaResultadoPdi as etiquetaResultadoPdiPresentacion,
  etiquetaSituacionMigratoriaPdi as etiquetaSituacionMigratoriaPdiPresentacion,
  etiquetaTipoControl as etiquetaTipoControlPresentacion,
  etiquetaTipoEvidencia as etiquetaTipoEvidenciaPresentacion,
  etiquetaTipoPersona as etiquetaTipoPersonaPresentacion,
  estadoClase as estadoClasePresentacion,
} from './casos-presentacion.utils';
import {
  esEvidenciaCarabineros,
  esEvidenciaInstitucional,
  esEvidenciaPdi,
  esFormatoEvidenciaValido,
  esNombreArchivoWord,
  etiquetaOrigenEvidencia,
  etiquetaPersonaEvidencia,
  extraerNombreArchivoDesdeContentDisposition,
  mimeTypePorExtension,
  nombrePdfDesdeOriginal,
} from './caso-evidencias.utils';
import {
  ObservacionInstitucionalDetalle,
  construirBitacoraInstitucional,
  extraerObservacionesBase,
} from './caso-observaciones.utils';

type AlertaTipo = 'success' | 'warning';
type AccionFlujo =
  | 'ENVIAR_DERIVACION'
  | 'RECEPCIONAR_CARABINEROS'
  | 'DERIVAR_A_PDI'
  | 'RECEPCIONAR_PDI'
  | 'CERRAR_PDI';
type OpcionSiNo = '' | 'SI' | 'NO';

@Component({
  selector: 'app-caso-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AlertModalComponent],
  templateUrl: './caso-detalle.component.html',
  styleUrl: './caso-detalle.component.css',
})
export class CasoDetalleComponent implements OnInit, OnDestroy {
  @ViewChild('evidenciaCarabinerosInput')
  private evidenciaCarabinerosInput?: ElementRef<HTMLInputElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly casosService = inject(CasosService);
  private readonly authService = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly sidebarCountersService = inject(SidebarCountersService);

  caso: Caso | null = null;
  evidencias: Evidencia[] = [];

  alertaAbierta = false;
  alertaTitulo = 'Notificación';
  alertaMensaje = '';
  alertaTipo: AlertaTipo = 'success';

  loadingPdf = false;
  loadingAccionFlujo = false;
  loadingObservacion = false;
  loadingEvidenciaCarabineros = false;
  convirtiendoEvidenciaCarabineros = false;
  loadingEliminarEvidenciaId = '';
  observacionInstitucional = '';
  evidenciaCarabinerosArchivo: File | null = null;
  evidenciaCarabinerosNombre = '';
  evidenciaCarabinerosError = '';
  evidenciaCarabinerosPreviewUrl = '';
  evidenciaCarabinerosPreviewEsImagen = false;
  evidenciaCarabinerosPreviewEsPdf = false;
  pdiOrdenJudicialVigente: OpcionSiNo = '';
  pdiSituacionMigratoria: '' | PdiSituacionMigratoria = '';
  pdiReconducible: OpcionSiNo = '';
  confirmacionDerivacionAbierta = false;
  confirmacionEliminarEvidenciaAbierta = false;
  evidenciaPendienteEliminar: Evidencia | null = null;
  accionConfirmadaDerivacion: Extract<AccionFlujo, 'ENVIAR_DERIVACION' | 'DERIVAR_A_PDI'> =
    'ENVIAR_DERIVACION';
  vistaPreviaAbierta = false;
  vistaPreviaCargando = false;
  vistaPreviaUrl = '';
  vistaPreviaResourceUrl: SafeResourceUrl | null = null;
  vistaPreviaNombre = '';
  vistaPreviaMimeType = '';
  private vistaPreviaObjectUrl = '';
  private evidenciaCarabinerosPreviewObjectUrl = '';
  private readonly maxEvidenciaCarabinerosBytes = 10 * 1024 * 1024;

  get rolActual() {
    return this.authService.currentUser?.rol;
  }

  get esPerfilCarabineros(): boolean {
    return this.rolActual === 'CARABINEROS';
  }

  get esPerfilPdi(): boolean {
    return this.rolActual === 'PDI';
  }

  get esPerfilInstitucional(): boolean {
    return this.esPerfilCarabineros || this.esPerfilPdi;
  }

  get tituloMesaTrabajo(): string {
    if (this.esPerfilCarabineros) {
      return 'Mesa de trabajo Carabineros';
    }

    if (this.esPerfilPdi) {
      return 'Mesa de trabajo PDI';
    }

    return 'Detalle operativo';
  }

  get nombreInstitucionConstancia(): string {
    if (this.esPerfilPdi) {
      return 'PDI';
    }

    return 'Carabineros';
  }

  get cantidadMenores(): number {
    if (!this.caso) {
      return 0;
    }

    return this.caso.personas.filter((persona) => persona.tipoPersona === 'MENOR').length;
  }

  get composicionCaso(): string {
    if (!this.caso) {
      return 'Sin datos';
    }

    const adultos = this.caso.personas.length - this.cantidadMenores;
    if (this.cantidadMenores > 0) {
      return `${adultos} adulto(s), ${this.cantidadMenores} menor(es)`;
    }

    return `${adultos} adulto(s), sin menores`;
  }

  get responsableActual(): string {
    if (!this.caso) {
      return 'No disponible';
    }

    if (this.caso.estado === 'DERIVADO_CARABINEROS') {
      return 'Carabineros';
    }

    if (this.caso.estado === 'DERIVADO_PDI' || this.caso.estado === 'CERRADO') {
      return 'PDI';
    }

    if (this.caso.estado === 'PENDIENTE') {
      return 'Pendiente de envío';
    }

    return 'Ejército';
  }

  get siguienteEtapa(): string {
    if (!this.caso) {
      return 'No disponible';
    }

    if (this.caso.estado === 'DERIVADO_CARABINEROS') {
      return 'Derivar a PDI';
    }

    if (this.caso.estado === 'DERIVADO_PDI') {
      return 'Seguimiento PDI';
    }

    if (this.caso.estado === 'CERRADO') {
      return 'Caso cerrado';
    }

    if (this.caso.estado === 'PENDIENTE') {
      return `Enviar a ${this.destinoDerivacion}`;
    }

    return 'Definir derivación';
  }

  get fechaIngresoTexto(): string {
    if (!this.caso?.fechaIngreso) {
      return 'No informada';
    }

    const fecha = new Date(this.caso.fechaIngreso);
    if (Number.isNaN(fecha.getTime())) {
      return this.caso.fechaIngreso;
    }

    return fecha.toLocaleDateString('es-CL');
  }

  get puedeEditar(): boolean {
    if (
      this.caso?.estado !== 'PENDIENTE' ||
      !this.authService.hasRole(['ADMINISTRADOR', 'OPERADOR'])
    ) {
      return false;
    }

    return this.puedeGestionarComoMasterEnJafCaso && this.esCreadorDelCaso;
  }

  get puedeGenerarPdf(): boolean {
    return this.authService.hasRole(['ADMINISTRADOR', 'OPERADOR', 'CARABINEROS']);
  }

  get puedeGestionInstitucional(): boolean {
    if (!this.caso) {
      return false;
    }

    if (!this.puedeGestionarComoMasterEnJafCaso) {
      return false;
    }

    if (this.authService.hasRole(['CARABINEROS'])) {
      return this.caso.estado === 'DERIVADO_CARABINEROS';
    }

    if (this.authService.hasRole(['PDI'])) {
      return this.caso.estado === 'DERIVADO_PDI';
    }

    return false;
  }

  get destinoDerivacion(): string {
    if (this.caso?.institucionDerivacion === 'CARABINEROS') {
      return 'Carabineros';
    }

    if (this.caso?.institucionDerivacion === 'PDI') {
      return 'PDI';
    }

    return 'institución correspondiente';
  }

  get etiquetaEstadoCorta(): string {
    if (!this.caso) {
      return 'No informado';
    }

    return this.etiquetaEstado(this.caso.estado);
  }

  get etiquetaTituloEstadoResumen(): string {
    if (this.caso?.estado === 'PENDIENTE') {
      return 'Estado pendiente';
    }

    return 'Estado';
  }

  get etiquetaDetalleEstadoResumen(): string {
    if (!this.caso) {
      return 'No informado';
    }

    if (this.caso.estado === 'PENDIENTE') {
      return this.etiquetaDerivacionPendiente || 'Sin derivación definida';
    }

    return this.etiquetaEstado(this.caso.estado);
  }

  get etiquetaDerivacionPendiente(): string {
    if (!this.caso || this.caso.estado !== 'PENDIENTE') {
      return '';
    }

    if (this.caso?.institucionDerivacion === 'CARABINEROS') {
      return 'Derivación a Carabineros';
    }

    if (this.caso?.institucionDerivacion === 'PDI') {
      return 'Derivación a PDI';
    }

    return '';
  }

  get vistaPreviaEsImagen(): boolean {
    return this.vistaPreviaMimeType.startsWith('image/');
  }

  get vistaPreviaEsPdf(): boolean {
    return this.vistaPreviaMimeType === 'application/pdf';
  }

  get mensajeConfirmacionDerivacion(): string {
    if (this.accionConfirmadaDerivacion === 'DERIVAR_A_PDI') {
      return '¿Está seguro de derivar a PDI?';
    }

    return `¿Está seguro de enviar a ${this.destinoDerivacion}?`;
  }

  get observacionesBase(): string {
    return extraerObservacionesBase(this.caso?.observaciones);
  }

  get observacionesInstitucionalesDetalladas(): ObservacionInstitucionalDetalle[] {
    return construirBitacoraInstitucional(
      this.caso?.observaciones,
      this.caso?.creadoAt ?? null,
    );
  }

  get puedeRecepcionarCarabineros(): boolean {
    if (!this.caso) {
      return false;
    }
    if (!this.puedeGestionarComoMasterEnJafCaso) {
      return false;
    }
    if (this.caso.estado !== 'DERIVADO_CARABINEROS') {
      return false;
    }
    return this.authService.hasRole(['CARABINEROS']);
  }

  get puedeCargarEvidenciaCarabineros(): boolean {
    if (!this.caso || this.caso.estado !== 'DERIVADO_CARABINEROS') {
      return false;
    }
    if (!this.puedeGestionarComoMasterEnJafCaso) {
      return false;
    }

    return this.authService.hasRole(['ADMINISTRADOR', 'CARABINEROS']);
  }

  get puedeCargarEvidenciaPdi(): boolean {
    if (!this.caso || this.caso.estado !== 'DERIVADO_PDI') {
      return false;
    }
    if (!this.puedeGestionarComoMasterEnJafCaso) {
      return false;
    }

    return this.authService.hasRole(['ADMINISTRADOR', 'PDI']);
  }

  get puedeCargarEvidenciaInstitucional(): boolean {
    return this.puedeCargarEvidenciaCarabineros || this.puedeCargarEvidenciaPdi;
  }

  get documentacionCarabineros(): Evidencia[] {
    return this.evidencias.filter((evidencia) => esEvidenciaCarabineros(evidencia));
  }

  get documentacionPdi(): Evidencia[] {
    return this.evidencias.filter((evidencia) => esEvidenciaPdi(evidencia));
  }

  get evidenciasEjercito(): Evidencia[] {
    return this.evidencias.filter((evidencia) => !esEvidenciaInstitucional(evidencia));
  }

  get evidenciasDisponiblesPdi(): Evidencia[] {
    return this.evidencias.filter((evidencia) => !esEvidenciaPdi(evidencia));
  }

  get puedeCerrarPdiConResolucion(): boolean {
    if (!this.puedeCerrarEnPdi) {
      return false;
    }

    if (this.pdiOrdenJudicialVigente === 'SI') {
      return true;
    }

    if (this.pdiOrdenJudicialVigente !== 'NO') {
      return false;
    }

    if (!this.pdiSituacionMigratoria) {
      return false;
    }

    if (this.pdiSituacionMigratoria === 'EGRESO_PNH') {
      return true;
    }

    return this.pdiReconducible === 'SI' || this.pdiReconducible === 'NO';
  }

  get resultadoPdiCalculado(): PdiResultado | '' {
    if (this.pdiOrdenJudicialVigente === 'SI') {
      return 'PUESTA_DISPOSICION_TRIBUNAL';
    }

    if (this.pdiOrdenJudicialVigente !== 'NO' || !this.pdiSituacionMigratoria) {
      return '';
    }

    if (this.pdiSituacionMigratoria === 'EGRESO_PNH') {
      return 'DENUNCIA_SNM_SALIDA_VOLUNTARIA';
    }

    if (this.pdiReconducible === 'SI') {
      return 'RECONDUCCION';
    }

    if (this.pdiReconducible === 'NO') {
      return 'DENUNCIA_SNM_TERRITORIO_NACIONAL';
    }

    return '';
  }

  get resolucionPdiRegistrada(): boolean {
    return this.caso?.estado === 'CERRADO' || Boolean(this.caso?.pdiResultado);
  }

  get puedeEnviarDerivacionPendiente(): boolean {
    if (!this.caso) {
      return false;
    }
    if (!this.puedeGestionarComoMasterEnJafCaso) {
      return false;
    }

    if (this.caso.estado !== 'PENDIENTE') {
      return false;
    }

    if (
      this.caso.institucionDerivacion !== 'CARABINEROS' &&
      this.caso.institucionDerivacion !== 'PDI'
    ) {
      return false;
    }

    return this.authService.hasRole(['ADMINISTRADOR', 'OPERADOR']) && this.esCreadorDelCaso;
  }

  get puedeDerivarAPdi(): boolean {
    if (!this.caso) {
      return false;
    }
    if (!this.puedeGestionarComoMasterEnJafCaso) {
      return false;
    }
    if (this.caso.estado !== 'DERIVADO_CARABINEROS') {
      return false;
    }
    return this.authService.hasRole(['CARABINEROS']);
  }

  get puedeRecepcionarPdi(): boolean {
    if (!this.caso) {
      return false;
    }
    if (!this.puedeGestionarComoMasterEnJafCaso) {
      return false;
    }
    if (this.caso.estado !== 'DERIVADO_PDI') {
      return false;
    }
    return this.authService.hasRole(['PDI']);
  }

  get puedeCerrarEnPdi(): boolean {
    if (!this.caso) {
      return false;
    }
    if (!this.puedeGestionarComoMasterEnJafCaso) {
      return false;
    }
    if (this.caso.estado !== 'DERIVADO_PDI') {
      return false;
    }
    return this.authService.hasRole(['PDI']);
  }

  private get puedeGestionarComoMasterEnJafCaso(): boolean {
    const user = this.authService.currentUser;
    if (!user || user.rol !== 'ADMINISTRADOR' || !user.esMaster) {
      return true;
    }

    if (!this.caso) {
      return false;
    }

    const creadoPorMaster = this.caso.creadoPor?.id === user.id;
    const mismaJaf = Boolean(user.jaf && user.jaf === this.caso.jaf);
    return creadoPorMaster || mismaJaf;
  }

  private get esCreadorDelCaso(): boolean {
    const user = this.authService.currentUser;
    return Boolean(this.caso && user && this.caso.creadoPor?.id === user.id);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.cargarCaso(id);
  }

  ngOnDestroy(): void {
    this.limpiarVistaPrevia();
    this.limpiarEvidenciaCarabineros();
  }

  cargarCaso(id: string): void {
    this.casosService.obtenerPorId(id).subscribe({
      next: (caso) => {
        this.caso = caso;
        this.sincronizarResolucionPdi(caso);
        this.cargarEvidencias();
      },
      error: (error: HttpErrorResponse) => {
        const backendMessage =
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible cargar el caso.';
        this.abrirAlerta('Acción no completada', backendMessage, 'warning');
      },
    });
  }

  cargarEvidencias(): void {
    if (!this.caso) {
      return;
    }

    this.casosService.listarEvidencias(this.caso.id).subscribe({
      next: (items) => {
        this.evidencias = items ?? [];
      },
      error: (error: HttpErrorResponse) => {
        const backendMessage =
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible cargar evidencias.';
        this.abrirAlerta('Acción no completada', backendMessage, 'warning');
      },
    });
  }

  private sincronizarResolucionPdi(caso: Caso): void {
    if (!caso.pdiResultado) {
      this.pdiOrdenJudicialVigente = '';
      this.pdiSituacionMigratoria = '';
      this.pdiReconducible = '';
      return;
    }

    this.pdiOrdenJudicialVigente =
      caso.pdiOrdenJudicialVigente === true
        ? 'SI'
        : caso.pdiOrdenJudicialVigente === false
          ? 'NO'
          : '';
    this.pdiSituacionMigratoria = caso.pdiSituacionMigratoria ?? '';
    this.pdiReconducible =
      caso.pdiReconducible === true
        ? 'SI'
        : caso.pdiReconducible === false
          ? 'NO'
          : '';
  }

  generarActa(): void {
    if (!this.caso || this.loadingPdf) {
      return;
    }

    this.loadingPdf = true;
    this.casosService.generarActaPdf(this.caso.id).subscribe({
      next: (doc) => {
        this.casosService.descargarDocumento(doc.id).subscribe({
          next: (blob) => {
            this.loadingPdf = false;
            this.descargarBlob(blob, doc.nombreOriginal);
            this.abrirAlerta('Documento generado', 'El PDF del acta se descargó correctamente.', 'success');
          },
          error: () => {
            this.loadingPdf = false;
            this.abrirAlerta(
              'Acción no completada',
              'El PDF se generó, pero no fue posible descargarlo.',
              'warning',
            );
          },
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loadingPdf = false;
        const backendMessage =
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible generar el PDF.';
        this.abrirAlerta('Acción no completada', backendMessage, 'warning');
      },
    });
  }

  ejecutarAccionFlujo(accion: AccionFlujo): void {
    if (!this.caso || this.loadingAccionFlujo) {
      return;
    }

    if (accion === 'CERRAR_PDI') {
      this.cerrarCasoPdiConResolucion();
      return;
    }

    this.loadingAccionFlujo = true;
    const onSuccess = (mensaje: string) => {
      if (!this.caso) {
        this.loadingAccionFlujo = false;
        return;
      }
      this.cargarCaso(this.caso.id);
      this.sidebarCountersService.solicitarRefresh();
      this.loadingAccionFlujo = false;
      this.abrirAlerta('Estado actualizado', mensaje, 'success');
    };

    const onError = (error: HttpErrorResponse) => {
      this.loadingAccionFlujo = false;
      const backendMessage =
        typeof error.error?.message === 'string'
          ? error.error.message
          : 'No fue posible ejecutar la acción de flujo.';
      this.abrirAlerta('Acción no completada', backendMessage, 'warning');
    };

    if (accion === 'ENVIAR_DERIVACION') {
      this.confirmacionDerivacionAbierta = false;
      const destino = this.destinoDerivacion;
      this.casosService.enviarDerivacionPendiente(this.caso.id).subscribe({
        next: () => onSuccess(`Caso enviado a ${destino} correctamente.`),
        error: onError,
      });
      return;
    }

    if (accion === 'RECEPCIONAR_CARABINEROS') {
      this.casosService.recepcionarEnCarabineros(this.caso.id).subscribe({
        next: () => onSuccess('Caso recepcionado por Carabineros.'),
        error: onError,
      });
      return;
    }

    if (accion === 'DERIVAR_A_PDI') {
      this.confirmacionDerivacionAbierta = false;
      this.casosService.derivarDesdeCarabinerosAPdi(this.caso.id).subscribe({
        next: () => onSuccess('Caso derivado a PDI correctamente.'),
        error: onError,
      });
      return;
    }

    if (accion === 'RECEPCIONAR_PDI') {
      this.casosService.recepcionarEnPdi(this.caso.id).subscribe({
        next: () => onSuccess('Caso recepcionado por PDI.'),
        error: onError,
      });
      return;
    }

    this.loadingAccionFlujo = false;
  }

  abrirConfirmacionDerivacion(): void {
    if (!this.caso || this.loadingAccionFlujo) {
      return;
    }

    this.accionConfirmadaDerivacion = 'ENVIAR_DERIVACION';
    this.confirmacionDerivacionAbierta = true;
  }

  abrirConfirmacionDerivacionAPdi(): void {
    if (!this.caso || this.loadingAccionFlujo) {
      return;
    }

    this.accionConfirmadaDerivacion = 'DERIVAR_A_PDI';
    this.confirmacionDerivacionAbierta = true;
  }

  cerrarConfirmacionDerivacion(): void {
    if (this.loadingAccionFlujo) {
      return;
    }

    this.confirmacionDerivacionAbierta = false;
  }

  confirmarEnvioDerivacion(): void {
    this.ejecutarAccionFlujo(this.accionConfirmadaDerivacion);
  }

  cerrarCasoPdiConResolucion(): void {
    if (!this.caso || this.loadingAccionFlujo) {
      return;
    }

    const payload = this.crearPayloadCierrePdi();
    if (!payload) {
      this.abrirAlerta(
        'Resolución incompleta',
        'Completa las preguntas obligatorias de la resolución antes de cerrar el caso.',
        'warning',
      );
      return;
    }

    this.loadingAccionFlujo = true;
    this.casosService.cerrarEnPdi(this.caso.id, payload).subscribe({
      next: () => {
        if (!this.caso) {
          this.loadingAccionFlujo = false;
          return;
        }
        this.cargarCaso(this.caso.id);
        this.sidebarCountersService.solicitarRefresh();
        this.loadingAccionFlujo = false;
        this.abrirAlerta(
          'Caso cerrado',
          'La resolución PDI quedó registrada y el caso fue cerrado correctamente.',
          'success',
        );
      },
      error: (error: HttpErrorResponse) => {
        this.loadingAccionFlujo = false;
        const backendMessage =
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible cerrar el caso en PDI.';
        this.abrirAlerta('Acción no completada', backendMessage, 'warning');
      },
    });
  }

  onOrdenJudicialPdiChange(): void {
    if (this.pdiOrdenJudicialVigente === 'SI') {
      this.pdiSituacionMigratoria = '';
      this.pdiReconducible = '';
    }
  }

  private crearPayloadCierrePdi(): CerrarPdiPayload | null {
    if (!this.puedeCerrarPdiConResolucion) {
      return null;
    }

    const ordenJudicialVigente = this.pdiOrdenJudicialVigente === 'SI';
    const payload: CerrarPdiPayload = {
      ordenJudicialVigente,
    };

    if (!ordenJudicialVigente && this.pdiSituacionMigratoria) {
      payload.situacionMigratoria = this.pdiSituacionMigratoria;
    }

    if (!ordenJudicialVigente && this.pdiSituacionMigratoria === 'INGRESO_PNH') {
      payload.reconducible = this.pdiReconducible === 'SI';
    }

    return payload;
  }

  guardarObservacionInstitucional(): void {
    if (!this.caso || this.loadingObservacion) {
      return;
    }

    if (!this.puedeGestionInstitucional) {
      this.abrirAlerta(
        'Acción no disponible',
        'La etapa institucional actual no permite agregar nuevas constancias.',
        'warning',
      );
      return;
    }

    const observacion = this.observacionInstitucional.trim();
    if (!observacion) {
      this.abrirAlerta(
        'Revisa la información',
        'Ingresa una observación antes de guardar.',
        'warning',
      );
      return;
    }

    this.loadingObservacion = true;
    this.casosService.agregarObservacionInstitucional(this.caso.id, observacion).subscribe({
      next: () => {
        this.loadingObservacion = false;
        this.observacionInstitucional = '';
        this.cargarCaso(this.caso!.id);
        this.abrirAlerta(
          'Constancia guardada',
          `La constancia de ${this.nombreInstitucionConstancia} fue registrada.`,
          'success',
        );
      },
      error: (error: HttpErrorResponse) => {
        this.loadingObservacion = false;
        const backendMessage =
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible guardar la constancia.';
        this.abrirAlerta('Acción no completada', backendMessage, 'warning');
      },
    });
  }

  abrirSelectorEvidenciaCarabineros(): void {
    if (!this.puedeCargarEvidenciaInstitucional) {
      this.abrirAlerta(
        'Acción no disponible',
        `Solo se puede agregar evidencia mientras el caso está en gestión de ${this.nombreInstitucionConstancia}.`,
        'warning',
      );
      return;
    }

    this.evidenciaCarabinerosInput?.nativeElement.click();
  }

  onEvidenciaCarabinerosSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;

    this.evidenciaCarabinerosError = '';
    this.evidenciaCarabinerosArchivo = null;
    this.evidenciaCarabinerosNombre = '';

    if (!archivo) {
      return;
    }

    if (!this.puedeCargarEvidenciaInstitucional) {
      this.evidenciaCarabinerosError =
        `La carga solo está habilitada durante la gestión de ${this.nombreInstitucionConstancia}.`;
      input.value = '';
      return;
    }

    if (!esFormatoEvidenciaValido(archivo)) {
      this.evidenciaCarabinerosError =
        'Formato no permitido. Usa JPG, PNG, PDF, DOC o DOCX.';
      input.value = '';
      return;
    }

    if (archivo.size > this.maxEvidenciaCarabinerosBytes) {
      this.evidenciaCarabinerosError = 'El archivo supera el máximo permitido de 10 MB.';
      input.value = '';
      return;
    }

    if (esNombreArchivoWord(archivo.name)) {
      this.convertirWordSeleccionadoAPdf(archivo, input);
      return;
    }

    this.evidenciaCarabinerosArchivo = archivo;
    this.evidenciaCarabinerosNombre = archivo.name;
    this.aplicarPreviewEvidenciaCarabineros(archivo);
  }

  private convertirWordSeleccionadoAPdf(
    archivo: File,
    input: HTMLInputElement,
  ): void {
    const formData = new FormData();
    formData.append('archivo', archivo);

    this.convirtiendoEvidenciaCarabineros = true;
    this.evidenciaCarabinerosArchivo = archivo;
    this.evidenciaCarabinerosNombre = archivo.name;
    this.aplicarPreviewEvidenciaCarabineros(archivo);

    this.casosService.convertirWordAPdf(formData).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.convirtiendoEvidenciaCarabineros = false;
          this.evidenciaCarabinerosArchivo = null;
          this.evidenciaCarabinerosNombre = '';
          this.evidenciaCarabinerosError = 'No fue posible convertir el Word a PDF.';
          this.limpiarPreviewEvidenciaCarabineros();
          input.value = '';
          return;
        }

        const nombrePdf =
          extraerNombreArchivoDesdeContentDisposition(
            response.headers.get('content-disposition'),
          ) || nombrePdfDesdeOriginal(archivo.name);
        const pdfFile = new File([blob], nombrePdf, { type: 'application/pdf' });

        this.convirtiendoEvidenciaCarabineros = false;
        this.evidenciaCarabinerosArchivo = pdfFile;
        this.evidenciaCarabinerosNombre = nombrePdf;
        this.evidenciaCarabinerosError = '';
        this.aplicarPreviewEvidenciaCarabineros(pdfFile);
      },
      error: (error: HttpErrorResponse) => {
        this.convirtiendoEvidenciaCarabineros = false;
        this.evidenciaCarabinerosArchivo = null;
        this.evidenciaCarabinerosNombre = '';
        this.limpiarPreviewEvidenciaCarabineros();
        input.value = '';
        const backendMessage =
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible convertir el Word a PDF.';
        this.abrirAlerta('Acción no completada', backendMessage, 'warning');
      },
    });
  }

  subirEvidenciaCarabineros(): void {
    if (!this.caso || this.loadingEvidenciaCarabineros || this.convirtiendoEvidenciaCarabineros) {
      return;
    }

    if (!this.puedeCargarEvidenciaInstitucional) {
      this.abrirAlerta(
        'Acción no disponible',
        `Solo se puede subir documentación mientras el caso está en gestión de ${this.nombreInstitucionConstancia}.`,
        'warning',
      );
      return;
    }

    if (!this.evidenciaCarabinerosArchivo) {
      this.evidenciaCarabinerosError = 'Selecciona un archivo antes de subir.';
      return;
    }

    const formData = new FormData();
    formData.append('archivo', this.evidenciaCarabinerosArchivo);
    formData.append('tipoEvidencia', 'ADJUNTO_GENERAL');

    this.loadingEvidenciaCarabineros = true;
    this.casosService.subirEvidencia(this.caso.id, formData).subscribe({
      next: () => {
        this.loadingEvidenciaCarabineros = false;
        this.limpiarEvidenciaCarabineros();
        this.cargarEvidencias();
        this.abrirAlerta(
          'Documentación cargada',
          'El archivo quedó incorporado como evidencia del caso.',
          'success',
        );
      },
      error: (error: HttpErrorResponse) => {
        this.loadingEvidenciaCarabineros = false;
        const backendMessage =
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible subir la documentación.';
        this.abrirAlerta('Acción no completada', backendMessage, 'warning');
      },
    });
  }

  puedeEliminarDocumentacionCarabineros(evidencia: Evidencia): boolean {
    if (!this.puedeCargarEvidenciaCarabineros) {
      return false;
    }

    return esEvidenciaCarabineros(evidencia);
  }

  puedeEliminarDocumentacionPdi(evidencia: Evidencia): boolean {
    if (!this.puedeCargarEvidenciaPdi) {
      return false;
    }

    return esEvidenciaPdi(evidencia);
  }

  eliminarDocumentacionCarabineros(evidencia: Evidencia): void {
    if (!this.puedeEliminarDocumentacionCarabineros(evidencia)) {
      return;
    }

    this.evidenciaPendienteEliminar = evidencia;
    this.confirmacionEliminarEvidenciaAbierta = true;
  }

  eliminarDocumentacionPdi(evidencia: Evidencia): void {
    if (!this.puedeEliminarDocumentacionPdi(evidencia)) {
      return;
    }

    this.evidenciaPendienteEliminar = evidencia;
    this.confirmacionEliminarEvidenciaAbierta = true;
  }

  cerrarConfirmacionEliminarEvidencia(): void {
    if (this.loadingEliminarEvidenciaId) {
      return;
    }

    this.confirmacionEliminarEvidenciaAbierta = false;
    this.evidenciaPendienteEliminar = null;
  }

  confirmarEliminarEvidencia(): void {
    const evidencia = this.evidenciaPendienteEliminar;
    if (
      !evidencia ||
      (!this.puedeEliminarDocumentacionCarabineros(evidencia) &&
        !this.puedeEliminarDocumentacionPdi(evidencia))
    ) {
      this.cerrarConfirmacionEliminarEvidencia();
      return;
    }

    this.loadingEliminarEvidenciaId = evidencia.id;
    this.casosService.eliminarEvidencia(evidencia.id).subscribe({
      next: () => {
        this.loadingEliminarEvidenciaId = '';
        this.confirmacionEliminarEvidenciaAbierta = false;
        this.evidenciaPendienteEliminar = null;
        this.cargarEvidencias();
        this.abrirAlerta(
          'Evidencia eliminada',
          'La documentación institucional fue eliminada correctamente.',
          'success',
        );
      },
      error: (error: HttpErrorResponse) => {
        this.loadingEliminarEvidenciaId = '';
        this.confirmacionEliminarEvidenciaAbierta = false;
        this.evidenciaPendienteEliminar = null;
        const backendMessage =
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible eliminar la evidencia.';
        this.abrirAlerta('Acción no completada', backendMessage, 'warning');
      },
    });
  }

  previsualizarEvidenciaCarabinerosSeleccionada(): void {
    if (!this.evidenciaCarabinerosArchivo) {
      return;
    }

    this.limpiarVistaPrevia();

    const url = URL.createObjectURL(this.evidenciaCarabinerosArchivo);
    this.vistaPreviaObjectUrl = url;
    this.vistaPreviaUrl = url;
    this.vistaPreviaResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.vistaPreviaNombre = this.evidenciaCarabinerosArchivo.name;
    this.vistaPreviaMimeType =
      this.evidenciaCarabinerosArchivo.type ||
      mimeTypePorExtension(this.evidenciaCarabinerosArchivo.name);
    this.vistaPreviaCargando = false;
    this.vistaPreviaAbierta = true;
  }

  descargarEvidencia(evidencia: Evidencia): void {
    this.casosService.descargarEvidencia(evidencia.id).subscribe({
      next: (blob) => this.descargarBlob(blob, evidencia.nombreOriginal),
      error: () =>
        this.abrirAlerta(
          'Acción no completada',
          'No fue posible descargar la evidencia.',
          'warning',
        ),
    });
  }

  previsualizarEvidencia(evidencia: Evidencia): void {
    this.limpiarVistaPrevia();
    this.vistaPreviaAbierta = true;
    this.vistaPreviaCargando = true;
    this.vistaPreviaNombre = evidencia.nombreOriginal;
    this.vistaPreviaMimeType = evidencia.mimeType || '';

    this.casosService.descargarEvidencia(evidencia.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.vistaPreviaObjectUrl = url;
        this.vistaPreviaUrl = url;
        this.vistaPreviaResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.vistaPreviaMimeType = blob.type || evidencia.mimeType || '';
        this.vistaPreviaCargando = false;
      },
      error: () => {
        this.cerrarVistaPrevia();
        this.abrirAlerta(
          'Acción no completada',
          'No fue posible abrir la vista previa de la evidencia.',
          'warning',
        );
      },
    });
  }

  cerrarVistaPrevia(): void {
    this.vistaPreviaAbierta = false;
    this.vistaPreviaCargando = false;
    this.limpiarVistaPrevia();
  }

  descargarVistaPrevia(): void {
    if (!this.vistaPreviaUrl || !this.vistaPreviaNombre) {
      return;
    }

    this.descargarBlobUrl(this.vistaPreviaUrl, this.vistaPreviaNombre);
  }

  etiquetaEstado(estado: EstadoCaso | string): string {
    return etiquetaEstadoPresentacion(estado);
  }

  estadoClase(estado: EstadoCaso | string): EstadoClaseCss {
    return estadoClasePresentacion(estado);
  }

  etiquetaTipoControl(tipoControl: TipoControl | string): string {
    return etiquetaTipoControlPresentacion(tipoControl);
  }

  etiquetaJaf(jaf: string): string {
    return etiquetaJafPresentacion(jaf);
  }

  etiquetaTipoEvidencia(tipo: string): string {
    return etiquetaTipoEvidenciaPresentacion(tipo);
  }

  etiquetaTipoPersona(tipo: string): string {
    return etiquetaTipoPersonaPresentacion(tipo);
  }

  contarEvidencias(tipo: string): number {
    return this.evidencias.filter((evidencia) => evidencia.tipoEvidencia === tipo).length;
  }

  contarEvidenciasEjercito(tipo: string): number {
    return this.evidenciasEjercito.filter(
      (evidencia) => evidencia.tipoEvidencia === tipo,
    ).length;
  }

  etiquetaPersonaEvidencia(evidencia: Evidencia): string {
    return etiquetaPersonaEvidencia(evidencia, this.caso?.personas);
  }

  etiquetaOrigenEvidencia(evidencia: Evidencia): string {
    return etiquetaOrigenEvidencia(evidencia);
  }

  etiquetaSituacionMigratoriaPdi(
    situacion: PdiSituacionMigratoria | '' | null | undefined,
  ): string {
    return etiquetaSituacionMigratoriaPdiPresentacion(situacion);
  }

  etiquetaResultadoPdi(resultado: PdiResultado | '' | null | undefined): string {
    return etiquetaResultadoPdiPresentacion(resultado);
  }

  etiquetaReconduciblePdi(valor: boolean | null | undefined): string {
    return etiquetaReconduciblePdiPresentacion(valor);
  }

  etiquetaOrdenJudicialPdi(valor: boolean | null | undefined): string {
    return etiquetaOrdenJudicialPdiPresentacion(valor);
  }

  cerrarAlerta(): void {
    this.alertaAbierta = false;
  }

  private aplicarPreviewEvidenciaCarabineros(archivo: File): void {
    this.limpiarPreviewEvidenciaCarabineros();

    const mimeType = archivo.type || mimeTypePorExtension(archivo.name);
    const url = URL.createObjectURL(archivo);
    this.evidenciaCarabinerosPreviewObjectUrl = url;
    this.evidenciaCarabinerosPreviewUrl = url;
    this.evidenciaCarabinerosPreviewEsImagen = mimeType.startsWith('image/');
    this.evidenciaCarabinerosPreviewEsPdf = mimeType === 'application/pdf';
  }

  limpiarEvidenciaCarabineros(): void {
    this.convirtiendoEvidenciaCarabineros = false;
    this.evidenciaCarabinerosArchivo = null;
    this.evidenciaCarabinerosNombre = '';
    this.evidenciaCarabinerosError = '';
    this.limpiarPreviewEvidenciaCarabineros();

    if (this.evidenciaCarabinerosInput?.nativeElement) {
      this.evidenciaCarabinerosInput.nativeElement.value = '';
    }
  }

  private limpiarPreviewEvidenciaCarabineros(): void {
    if (this.evidenciaCarabinerosPreviewObjectUrl) {
      URL.revokeObjectURL(this.evidenciaCarabinerosPreviewObjectUrl);
    }

    this.evidenciaCarabinerosPreviewObjectUrl = '';
    this.evidenciaCarabinerosPreviewUrl = '';
    this.evidenciaCarabinerosPreviewEsImagen = false;
    this.evidenciaCarabinerosPreviewEsPdf = false;
  }

  private descargarBlob(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    this.descargarBlobUrl(url, nombre);
    URL.revokeObjectURL(url);
  }

  private descargarBlobUrl(url: string, nombre: string): void {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = nombre;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  private limpiarVistaPrevia(): void {
    if (this.vistaPreviaObjectUrl) {
      URL.revokeObjectURL(this.vistaPreviaObjectUrl);
    }

    this.vistaPreviaObjectUrl = '';
    this.vistaPreviaUrl = '';
    this.vistaPreviaResourceUrl = null;
    this.vistaPreviaNombre = '';
    this.vistaPreviaMimeType = '';
  }

  private abrirAlerta(
    titulo: string,
    mensaje: string,
    tipo: AlertaTipo,
  ): void {
    this.alertaTitulo = titulo;
    this.alertaMensaje = mensaje;
    this.alertaTipo = tipo;
    this.alertaAbierta = true;
  }
}
