import { DOCUMENT } from '@angular/common';
import { Injectable, NgZone, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class SessionIdleService {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly document = inject(DOCUMENT);

  private readonly idleTimeoutMs =
    (environment.sessionIdleTimeoutMinutes ?? 30) * 60 * 1000;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private listenersBound = false;
  private cerrandoSesion = false;

  constructor() {
    this.inicializarMonitoreo();
  }

  expirarSesionPorBackend(): void {
    if (!this.authService.isAuthenticated() || this.cerrandoSesion) {
      return;
    }

    this.cerrarSesionLocalYRedirigir('expirada');
  }

  private inicializarMonitoreo(): void {
    this.authService.user$.subscribe((user) => {
      if (user) {
        this.bindListeners();
        this.resetIdleTimer();
        return;
      }

      this.limpiarTimer();
      this.cerrandoSesion = false;
    });

    this.router.events
      .pipe(filter((evento) => evento instanceof NavigationEnd))
      .subscribe(() => {
        if (this.authService.isAuthenticated()) {
          this.resetIdleTimer();
        }
      });
  }

  private bindListeners(): void {
    if (this.listenersBound || !this.document?.defaultView) {
      return;
    }

    const eventos: Array<keyof DocumentEventMap> = [
      'click',
      'keydown',
      'mousemove',
      'scroll',
      'touchstart',
      'visibilitychange',
    ];

    const win = this.document.defaultView;

    this.zone.runOutsideAngular(() => {
      eventos.forEach((evento) => {
        this.document.addEventListener(evento, this.onActivity, {
          passive: true,
        });
      });

      win.addEventListener('focus', this.onActivity, {
        passive: true,
      });
    });

    this.listenersBound = true;
  }

  private readonly onActivity = () => {
    if (!this.authService.isAuthenticated() || this.esRutaLogin()) {
      return;
    }

    this.resetIdleTimer();
  };

  private resetIdleTimer(): void {
    this.limpiarTimer();

    this.timeoutId = setTimeout(() => {
      this.zone.run(() => {
        this.cerrarSesionPorInactividad();
      });
    }, this.idleTimeoutMs);
  }

  private cerrarSesionPorInactividad(): void {
    if (!this.authService.isAuthenticated() || this.cerrandoSesion) {
      return;
    }

    this.cerrandoSesion = true;
    this.authService.logout('INACTIVIDAD').subscribe({
      next: () => {
        this.redirigirConMotivo('inactividad');
      },
      error: () => {
        this.redirigirConMotivo('inactividad');
      },
      complete: () => {
        this.cerrandoSesion = false;
      },
    });
  }

  private cerrarSesionLocalYRedirigir(motivo: 'expirada' | 'inactividad'): void {
    this.cerrandoSesion = true;
    this.authService.clearLocalSession();
    this.redirigirConMotivo(motivo);
    this.cerrandoSesion = false;
  }

  private redirigirConMotivo(motivo: 'expirada' | 'inactividad'): void {
    this.router.navigate(['/login'], {
      queryParams: { reason: motivo },
      replaceUrl: true,
    });
  }

  private esRutaLogin(): boolean {
    return this.router.url.startsWith('/login');
  }

  private limpiarTimer(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
