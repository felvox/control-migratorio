import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Rol } from '../../../core/models/auth.model';

type IconoMenu = 'dashboard' | 'casos' | 'usuarios' | 'reportes' | 'consulta';

interface MenuItem {
  label: string;
  path: string;
  roles: Rol[];
  icon: IconoMenu;
  exact?: boolean;
  dividerBefore?: boolean;
  disabled?: boolean;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout-shell" [class.sidebar-collapsed]="sidebarOculta">
      <aside class="sidebar">
        <div class="sidebar-top" [class.sidebar-top-collapsed]="sidebarOculta">
          <div class="brand-mark">
            <img src="/assets/logo-corneta.png" alt="Logo institucional" />
          </div>

          <div class="brand-text" *ngIf="!sidebarOculta">
            <h1>Control Migratorio</h1>
          </div>
        </div>

        <button
          class="btn-sidebar-edge"
          type="button"
          [attr.aria-label]="sidebarOculta ? 'Mostrar barra lateral' : 'Ocultar barra lateral'"
          [attr.title]="sidebarOculta ? 'Mostrar barra lateral' : 'Ocultar barra lateral'"
          (click)="toggleSidebar()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
            <path *ngIf="!sidebarOculta" d="m15 12-3-3m3 3-3 3" />
            <path *ngIf="sidebarOculta" d="m12 12 3-3m-3 3 3 3" />
          </svg>
        </button>

        <nav class="menu" [class.menu-collapsed]="sidebarOculta">
          <ng-container *ngFor="let item of menuItemsVisibles">
            <div class="menu-divider" *ngIf="item.dividerBefore"></div>
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
              [attr.title]="sidebarOculta ? item.label : null"
              [class.link-collapsed]="sidebarOculta"
              [class.link-disabled]="item.disabled"
              [attr.aria-disabled]="item.disabled ? 'true' : null"
              [attr.tabindex]="item.disabled ? -1 : null"
              (click)="onMenuClick($event, item)"
            >
              <span class="menu-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" [ngSwitch]="item.icon">
                  <g *ngSwitchCase="'dashboard'">
                    <path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z" />
                  </g>
                  <g *ngSwitchCase="'casos'">
                    <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </g>
                  <g *ngSwitchCase="'usuarios'">
                    <path d="M16 11a4 4 0 1 0-3.999-4A4 4 0 0 0 16 11zM8 13a3 3 0 1 0-.001-6A3 3 0 0 0 8 13z" />
                    <path d="M8 14c-2.9 0-5 1.6-5 3.4V19h10v-1.6C13 15.6 10.9 14 8 14zM16 12c-2.5 0-4.5 1.3-4.5 2.9V19H21v-4.1C21 13.3 19 12 16 12z" />
                  </g>
                  <g *ngSwitchCase="'reportes'">
                    <path d="M4 19h16M7 16V9M12 16V5M17 16v-4" />
                  </g>
                  <g *ngSwitchCase="'consulta'">
                    <circle cx="10.5" cy="10.5" r="5.5" />
                    <path d="m21 21-6-6" />
                  </g>
                </svg>
              </span>
              <span class="menu-label" *ngIf="!sidebarOculta">{{ item.label }}</span>
            </a>
          </ng-container>
        </nav>

        <div class="sidebar-bottom">
          <button
            class="btn-logout"
            [class.btn-logout-collapsed]="sidebarOculta"
            [attr.title]="sidebarOculta ? 'Cerrar sesión' : null"
            (click)="logout()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" />
              <path d="m15 16 5-4-5-4M20 12H9" />
            </svg>
            <span *ngIf="!sidebarOculta">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main class="content">
        <header class="topbar">
          <div class="topbar-user">
            <strong>{{ authService.currentUser?.nombreCompleto }}</strong>
            <span class="badge">{{ authService.currentUser?.rol }}</span>
          </div>
        </header>

        <section class="content-body">
          <router-outlet></router-outlet>
        </section>
      </main>
    </div>
  `,
  styles: [
    `
      .layout-shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 292px 1fr;
        background: #f4f6fa;
      }

      .layout-shell.sidebar-collapsed {
        grid-template-columns: 92px 1fr;
      }

      .sidebar {
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0)),
          #0a0b10;
        color: #f4f7fa;
        position: sticky;
        top: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        padding: 0.78rem;
        gap: 0.58rem;
        border-right: 1px solid #1f222f;
        transition: width 180ms ease;
        overflow: visible;
      }

      .sidebar-top {
        display: grid;
        grid-template-columns: 44px 1fr;
        gap: 0.68rem;
        align-items: center;
      }

      .sidebar-top.sidebar-top-collapsed {
        grid-template-columns: 44px;
        justify-content: center;
      }

      .brand-mark {
        width: 42px;
        height: 42px;
        border-radius: 0;
        overflow: hidden;
        background: transparent;
        border: 0;
        display: grid;
        place-items: center;
        flex: none;
        transform: translateY(-1px);
      }

      .brand-mark img {
        width: 34px;
        height: 34px;
        object-fit: contain;
      }

      .brand-text h1 {
        margin: 0;
        font-size: 1.12rem;
        line-height: 1.08;
        color: #ffffff;
        letter-spacing: 0;
        font-weight: 650;
      }

      .btn-sidebar-edge {
        position: absolute;
        top: 0.98rem;
        right: -16px;
        width: 32px;
        height: 32px;
        padding: 0;
        margin: 0;
        border-radius: 10px;
        border: 1px solid #324153;
        background: #121b29;
        color: #f2f6fb;
        display: grid;
        place-items: center;
        line-height: 0;
        z-index: 30;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.34);
      }

      .btn-sidebar-edge svg {
        width: 15px;
        height: 15px;
        stroke: currentColor;
        stroke-width: 1.9;
        fill: none;
        display: block;
        transform: translateY(-1px);
      }

      .btn-sidebar-edge:hover {
        background: #1d2737;
      }

      .menu {
        display: grid;
        gap: 0.24rem;
        align-content: start;
        align-items: start;
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        margin-top: 0.35rem;
        padding-bottom: 1.1rem;
      }

      .menu.menu-collapsed {
        justify-items: center;
      }

      .menu a {
        display: grid;
        grid-template-columns: 24px 1fr;
        align-items: center;
        gap: 0.56rem;
        padding: 0.65rem 0.68rem;
        border-radius: 12px;
        color: #e5e9ee;
        border: 1px solid transparent;
        transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
        min-height: 44px;
      }

      .menu a.link-collapsed {
        width: 52px;
        grid-template-columns: 1fr;
        justify-items: center;
        padding: 0.55rem 0;
      }

      .menu a.link-disabled {
        color: #95a1b2;
        cursor: not-allowed;
      }

      .menu a.link-disabled:hover {
        background: transparent;
        border-color: transparent;
        color: #95a1b2;
      }

      .menu a.link-disabled.active {
        background: transparent;
        border-color: transparent;
        color: #95a1b2;
      }

      .menu-icon {
        display: inline-flex;
      }

      .menu-icon svg {
        width: 20px;
        height: 20px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .menu-label {
        font-weight: 600;
        font-size: 1rem;
      }

      .menu-divider {
        height: 1px;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0));
        margin: 0.3rem 0.2rem 0.34rem;
      }

      .menu a.active {
        background: #1b2433;
        border-color: #364256;
        color: #ffffff;
      }

      .menu a:hover {
        background: #151d2a;
        border-color: #2c333d;
        color: #fff;
      }

      .sidebar-bottom {
        display: grid;
        gap: 0.56rem;
        padding-top: 0.72rem;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .btn-logout {
        width: 100%;
        border-radius: 10px;
        border: 1px solid #2b3342;
        background: #141a25;
        color: #f4f7fa;
        padding: 0.62rem 0.72rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
      }

      .btn-logout svg {
        width: 18px;
        height: 18px;
        stroke: currentColor;
        stroke-width: 1.9;
        fill: none;
      }

      .btn-logout.btn-logout-collapsed {
        width: 52px;
        justify-self: center;
        padding: 0.58rem 0;
      }

      .btn-logout:hover {
        background: #1b2433;
      }

      .content {
        padding: 0.85rem 1rem;
        display: grid;
        grid-template-rows: auto 1fr;
        align-content: start;
        gap: 0.75rem;
      }

      .topbar {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        min-height: 58px;
        padding: 0.72rem 0.92rem;
        border-radius: 10px;
        border: 1px solid #d8e0e8;
        background: #ffffff;
      }

      .topbar-user {
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }

      .content-body {
        display: grid;
        align-content: start;
        gap: 0.75rem;
      }

      @media (max-width: 980px) {
        .layout-shell,
        .layout-shell.sidebar-collapsed {
          grid-template-columns: 1fr;
        }

        .sidebar {
          position: relative;
          top: auto;
          height: auto;
          z-index: 10;
          border-right: none;
          border-bottom: 1px solid #1f2328;
          overflow: visible;
        }

        .menu {
          overflow: visible;
        }

        .topbar {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }
      }
    `,
  ],
})
export class LayoutComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  sidebarOculta = false;
  menuItemsVisibles: MenuItem[] = [];

  private readonly menuItems: MenuItem[] = [
    {
      label: 'Inicio',
      path: '/dashboard',
      roles: ['ADMINISTRADOR'],
      icon: 'dashboard',
      exact: true,
    },
    {
      label: 'Crear Caso',
      path: '/casos/nuevo',
      roles: ['ADMINISTRADOR', 'OPERADOR'],
      icon: 'casos',
      exact: true,
    },
    {
      label: 'Consultar Casos',
      path: '/casos',
      roles: ['ADMINISTRADOR', 'OPERADOR', 'CONSULTA'],
      icon: 'casos',
      exact: true,
    },
    {
      label: 'Usuarios',
      path: '/usuarios',
      roles: ['ADMINISTRADOR'],
      icon: 'usuarios',
      dividerBefore: true,
      disabled: true,
    },
    {
      label: 'Reportes',
      path: '/reportes',
      roles: ['ADMINISTRADOR'],
      icon: 'reportes',
      disabled: true,
    },
    {
      label: 'Consulta',
      path: '/consulta',
      roles: ['CONSULTA'],
      icon: 'consulta',
      exact: true,
    },
  ];

  ngOnInit(): void {
    this.actualizarMenuItemsVisibles();
    this.authService.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.actualizarMenuItemsVisibles());
  }

  toggleSidebar(): void {
    this.sidebarOculta = !this.sidebarOculta;
  }

  onMenuClick(event: Event, item: MenuItem): void {
    if (!item.disabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  private actualizarMenuItemsVisibles(): void {
    const rolActual = this.authService.currentUser?.rol;

    if (!rolActual) {
      this.menuItemsVisibles = [];
      return;
    }

    let menuPorRol: MenuItem[] = [];

    if (rolActual === 'ADMINISTRADOR') {
      menuPorRol = this.getMenuByPaths([
        '/dashboard',
        '/casos/nuevo',
        '/casos',
        '/usuarios',
        '/reportes',
      ]);
    } else if (rolActual === 'OPERADOR') {
      menuPorRol = this.getMenuByPaths(['/casos/nuevo', '/casos']);
    } else {
      menuPorRol = this.getMenuByPaths(['/consulta', '/casos']);
    }

    this.menuItemsVisibles = menuPorRol;
  }

  private getMenuByPaths(paths: string[]): MenuItem[] {
    return paths
      .map((path) => this.menuItems.find((item) => item.path === path))
      .filter((item): item is MenuItem => Boolean(item))
      .filter((item) => this.authService.hasRole(item.roles));
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}
