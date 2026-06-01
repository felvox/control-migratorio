import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TrazabilidadUiService {
  private readonly abrirUsuariosActivosSubject = new Subject<
    'ACTIVOS' | 'DESCONECTADOS'
  >();
  private readonly verEventosSeguridadSubject = new Subject<void>();
  private readonly eventosSeguridadPendientesSubject = new BehaviorSubject<number>(0);
  readonly abrirUsuariosActivos$ = this.abrirUsuariosActivosSubject.asObservable();
  readonly verEventosSeguridad$ = this.verEventosSeguridadSubject.asObservable();
  readonly eventosSeguridadPendientes$ =
    this.eventosSeguridadPendientesSubject.asObservable();

  solicitarAbrirUsuariosActivos(estado: 'ACTIVOS' | 'DESCONECTADOS'): void {
    this.abrirUsuariosActivosSubject.next(estado);
  }

  solicitarVerEventosSeguridad(): void {
    this.verEventosSeguridadSubject.next();
  }

  actualizarEventosSeguridadPendientes(total: number): void {
    this.eventosSeguridadPendientesSubject.next(Math.max(0, total));
  }
}
