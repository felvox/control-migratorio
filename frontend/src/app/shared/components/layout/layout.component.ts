import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Jaf, MasterCandidate, Rol } from '../../../core/models/auth.model';
import { AlertModalComponent } from '../alert-modal.component';
import { ProgressivePasswordMaskDirective } from '../../directives/progressive-password-mask.directive';

type IconoMenu = 'dashboard' | 'casos' | 'usuarios' | 'reportes' | 'consulta';
type VistaModalCuenta = 'OPCIONES' | 'PASSWORD' | 'TRANSFER';

interface MenuItem {
  label: string;
  path: string;
  roles: Rol[];
  icon: IconoMenu;
  exact?: boolean;
  dividerBefore?: boolean;
  disabled?: boolean;
  masterOnly?: boolean;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AlertModalComponent,
    ProgressivePasswordMaskDirective,
  ],
  template: `
    <div class="layout-shell" [class.sidebar-collapsed]="sidebarOculta">
      <aside class="sidebar">
        <div class="sidebar-top" [class.sidebar-top-collapsed]="sidebarOculta">
          <div class="brand-mark" [class.brand-mark-jaf]="esLogoJaf">
            <img [src]="logoSidebarUrl" alt="Logo institucional" />
          </div>

          <div class="brand-text" *ngIf="!sidebarOculta">
            <h1>Control Migratorio</h1>
            <p *ngIf="subtituloSidebar">{{ subtituloSidebar }}</p>
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
        <header class="topbar" [class.topbar-dashboard]="esDashboardActivo">
          <div class="topbar-page-title">
            <h2>{{ tituloPaginaActual }}</h2>
          </div>
          <div class="topbar-center" *ngIf="esDashboardActivo">
            <label class="topbar-date-chip" aria-label="Fecha de referencia del panel">
              <span class="topbar-date-icon">📅</span>
              <input
                class="topbar-date-input"
                type="date"
                [value]="fechaDashboardIso"
                (change)="onDashboardFechaChange($event)"
              />
            </label>
          </div>
          <div class="topbar-user">
            <button
              type="button"
              class="btn-profile"
              (click)="abrirModalCambioPassword()"
              [disabled]="!authService.currentUser"
              title="Cambiar contraseña"
            >
              <span class="profile-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="4"></circle>
                  <path d="M4 20c0-4 3.2-7 8-7s8 3 8 7"></path>
                </svg>
              </span>
              <strong>{{ authService.currentUser?.nombreCompleto }}</strong>
            </button>
            <button
              type="button"
              class="badge badge-role"
              (click)="abrirModalCambioPassword()"
              [disabled]="!authService.currentUser"
              title="Cambiar contraseña"
            >
              {{ authService.currentUser?.rol }}
            </button>
          </div>
        </header>

        <section class="content-body">
          <router-outlet></router-outlet>
        </section>

        <div class="modal-backdrop" *ngIf="modalCambioPasswordAbierto">
          <section class="modal-card" role="dialog" aria-modal="true" aria-label="Cambiar contraseña">
            <p class="modal-text" *ngIf="authService.currentUser as user">
              Usuario: <strong>{{ user.nombreCompleto }}</strong>
              ({{ user.run }})
            </p>

            <ng-container *ngIf="authService.currentUser as user">
              <h3 *ngIf="vistaModalCuenta === 'OPCIONES'">Opciones de cuenta</h3>
              <h3 *ngIf="vistaModalCuenta === 'PASSWORD'">Cambiar contraseña</h3>
              <h3 *ngIf="vistaModalCuenta === 'TRANSFER'">Traspasar cuenta Administrador Master</h3>

              <section class="account-options" *ngIf="user.esMaster && vistaModalCuenta === 'OPCIONES'">
                <button type="button" class="account-option-card" (click)="abrirVistaCambioPassword()">
                  <strong>Cambiar contraseña</strong>
                  <span>Actualiza tu contraseña actual de acceso.</span>
                </button>
                <button type="button" class="account-option-card danger" (click)="abrirVistaTransferMaster()">
                  <strong>Traspasar cuenta Master</strong>
                  <span>Transfiere el control master a otro usuario activo.</span>
                </button>
              </section>

              <form
                *ngIf="vistaModalCuenta === 'PASSWORD'"
                [formGroup]="formCambioPassword"
                (ngSubmit)="confirmarCambioPassword()"
                class="page-grid"
              >
                <div>
                  <label>Contraseña actual</label>
                  <div class="password-field">
                    <input
                      formControlName="passwordActual"
                      [type]="mostrarPasswordActual ? 'text' : 'password'"
                      [appProgressivePasswordMask]="!mostrarPasswordActual"
                    />
                    <button
                      type="button"
                      class="password-toggle"
                      (click)="mostrarPasswordActual = !mostrarPasswordActual"
                    >
                      {{ mostrarPasswordActual ? 'Ocultar' : 'Mostrar' }}
                    </button>
                  </div>
                </div>

                <div>
                  <label>Nueva contraseña</label>
                  <div class="password-field">
                    <input
                      formControlName="nuevaPassword"
                      [type]="mostrarPasswordNueva ? 'text' : 'password'"
                      [appProgressivePasswordMask]="!mostrarPasswordNueva"
                    />
                    <button
                      type="button"
                      class="password-toggle"
                      (click)="mostrarPasswordNueva = !mostrarPasswordNueva"
                    >
                      {{ mostrarPasswordNueva ? 'Ocultar' : 'Mostrar' }}
                    </button>
                  </div>
                  <p
                    class="error-text"
                    *ngIf="formCambioPassword.get('nuevaPassword')?.invalid && formCambioPassword.get('nuevaPassword')?.touched"
                  >
                    Debe tener 10+ caracteres, mayúscula, minúscula, número y símbolo.
                  </p>
                </div>

                <div>
                  <label>Confirmar nueva contraseña</label>
                  <div class="password-field">
                    <input
                      formControlName="confirmarPassword"
                      [type]="mostrarPasswordConfirmar ? 'text' : 'password'"
                      [appProgressivePasswordMask]="!mostrarPasswordConfirmar"
                    />
                    <button
                      type="button"
                      class="password-toggle"
                      (click)="mostrarPasswordConfirmar = !mostrarPasswordConfirmar"
                    >
                      {{ mostrarPasswordConfirmar ? 'Ocultar' : 'Mostrar' }}
                    </button>
                  </div>
                  <p
                    class="error-text"
                    *ngIf="passwordsNoCoinciden && formCambioPassword.get('confirmarPassword')?.touched"
                  >
                    La confirmación no coincide con la nueva contraseña.
                  </p>
                </div>

                <div class="modal-actions">
                  <button
                    type="button"
                    class="btn-secondary"
                    [disabled]="loadingCambioPassword"
                    (click)="cerrarModalCambioPassword()"
                  >
                    Cancelar
                  </button>
                  <button
                    *ngIf="user.esMaster"
                    type="button"
                    class="btn-secondary"
                    [disabled]="loadingCambioPassword"
                    (click)="volverOpcionesCuenta()"
                  >
                    Volver
                  </button>
                  <button class="btn-primary" [disabled]="loadingCambioPassword">
                    {{ loadingCambioPassword ? 'Actualizando...' : 'Actualizar contraseña' }}
                  </button>
                </div>
              </form>

              <section class="master-transfer" *ngIf="user.esMaster && vistaModalCuenta === 'TRANSFER'">
                <p>
                  Selecciona al usuario que recibirá la cuenta master. Esta acción te quitará el estado master a ti.
                </p>

                <form [formGroup]="formCambioPassword" class="page-grid">
                  <div>
                    <label>Contraseña actual</label>
                    <div class="password-field">
                      <input
                        formControlName="passwordActual"
                        [type]="mostrarPasswordActual ? 'text' : 'password'"
                        [appProgressivePasswordMask]="!mostrarPasswordActual"
                      />
                      <button
                        type="button"
                        class="password-toggle"
                        (click)="mostrarPasswordActual = !mostrarPasswordActual"
                      >
                        {{ mostrarPasswordActual ? 'Ocultar' : 'Mostrar' }}
                      </button>
                    </div>
                  </div>
                </form>

                <div>
                  <label>Usuario destino</label>
                  <select [(ngModel)]="targetMasterUserId" [ngModelOptions]="{ standalone: true }">
                    <option value="">Seleccionar usuario</option>
                    <option *ngFor="let candidato of masterCandidates" [value]="candidato.id">
                      {{ candidato.nombreCompleto }} ({{ candidato.rol }}) - {{ candidato.run }}
                    </option>
                  </select>
                  <p class="modal-text" *ngIf="!masterCandidates.length">
                    No hay usuarios activos disponibles para recibir la cuenta master.
                  </p>
                </div>

                <div class="modal-actions">
                  <button
                    type="button"
                    class="btn-secondary"
                    [disabled]="loadingTransferMaster"
                    (click)="volverOpcionesCuenta()"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    class="btn-secondary"
                    [disabled]="loadingTransferMaster"
                    (click)="cerrarModalCambioPassword()"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    class="btn-danger-outline"
                    [disabled]="loadingTransferMaster || !masterCandidates.length"
                    (click)="confirmarTransferMaster()"
                  >
                    {{ loadingTransferMaster ? 'Traspasando...' : 'Traspasar Master' }}
                  </button>
                </div>
              </section>

              <div class="modal-actions" *ngIf="user.esMaster && vistaModalCuenta === 'OPCIONES'">
                <button type="button" class="btn-secondary" (click)="cerrarModalCambioPassword()">Cerrar</button>
              </div>
            </ng-container>
          </section>
        </div>

        <app-alert-modal
          [open]="alertPerfilAbierto"
          [title]="alertPerfilTitulo"
          [message]="alertPerfilMensaje"
          [variant]="alertPerfilTipo"
          (accepted)="cerrarAlertaPerfil()"
        />
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
        width: 46px;
        height: 46px;
        border-radius: 999px;
        overflow: hidden;
        background: #0f121a;
        border: 1px solid #2b3444;
        display: grid;
        place-items: center;
        flex: none;
      }

      .brand-mark img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 999px;
      }

      .brand-mark.brand-mark-jaf img {
        transform: scale(1.06);
      }

      .brand-text h1 {
        margin: 0;
        font-size: 1.12rem;
        line-height: 1.08;
        color: #ffffff;
        letter-spacing: 0;
        font-weight: 650;
      }

      .brand-text p {
        margin: 0.08rem 0 0;
        font-size: 0.73rem;
        line-height: 1.2;
        color: #a5b3c5;
        font-weight: 600;
        letter-spacing: 0.02em;
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
        justify-content: space-between;
        align-items: center;
        min-height: 58px;
        padding: 0.72rem 0.92rem;
        border-radius: 10px;
        border: 1px solid #d8e0e8;
        background: #ffffff;
        gap: 0.8rem;
      }

      .topbar-page-title {
        min-width: 0;
        flex: 1 1 auto;
      }

      .topbar-page-title h2 {
        margin: 0;
        font-size: 1.18rem;
        font-weight: 700;
        color: #223243;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .topbar-center {
        justify-self: center;
      }

      .topbar.topbar-dashboard {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      }

      .topbar-date-chip {
        border: 1px solid #d9e1eb;
        border-radius: 11px;
        background: #ffffff;
        padding: 0.56rem 0.78rem;
        display: inline-flex;
        align-items: center;
        gap: 0.52rem;
        color: #334155;
        font-weight: 600;
        white-space: nowrap;
      }

      .topbar-date-icon {
        opacity: 0.72;
      }

      .topbar-date-input {
        border: 0;
        background: transparent;
        padding: 0;
        color: #334155;
        font-weight: 700;
      }

      .topbar-date-input:focus {
        outline: none;
      }

      .topbar-user {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        margin-left: auto;
        min-width: 0;
      }

      .topbar.topbar-dashboard .topbar-user {
        justify-self: end;
        margin-left: 0;
      }

      .btn-profile {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        border: 1px solid #d5deea;
        background: #ffffff;
        color: #1f3146;
        border-radius: 999px;
        padding: 0.28rem 0.55rem;
        max-width: 100%;
      }

      .btn-profile strong {
        font-size: 1.01rem;
        font-weight: 700;
        color: #1f2f3f;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .btn-profile:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .profile-icon {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 1px solid #c8d3e2;
        background: #f4f8fc;
        display: grid;
        place-items: center;
        flex: none;
      }

      .profile-icon svg {
        width: 15px;
        height: 15px;
        stroke: #35516f;
        stroke-width: 1.9;
        fill: none;
      }

      .badge-role {
        font-weight: 700;
        color: #2f3f50;
        background: #f8fbff;
        border-color: #c8d3e2;
      }

      .badge-role:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .content-body {
        display: grid;
        align-content: start;
        gap: 0.75rem;
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(10, 21, 34, 0.5);
        display: grid;
        place-items: center;
        padding: 1rem;
        z-index: 1250;
      }

      .modal-card {
        width: min(560px, 100%);
        background: #ffffff;
        border: 1px solid #d7e0ea;
        border-radius: 12px;
        box-shadow: 0 18px 48px rgba(10, 29, 54, 0.24);
        padding: 1rem;
        display: grid;
        gap: 0.75rem;
      }

      .modal-card h3 {
        margin: 0;
        color: #1f3146;
      }

      .modal-text {
        margin: 0;
        color: #4c6178;
      }

      .account-options {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.65rem;
      }

      .account-option-card {
        border: 1px solid #cfdbea;
        background: #f7fbff;
        border-radius: 12px;
        padding: 0.75rem;
        text-align: left;
        display: grid;
        gap: 0.25rem;
        color: #204061;
      }

      .account-option-card strong {
        font-size: 1rem;
      }

      .account-option-card span {
        color: #5a7088;
        font-size: 0.9rem;
      }

      .account-option-card:hover {
        border-color: #7aa8db;
        background: #eef6ff;
      }

      .account-option-card.danger {
        background: #fff7f7;
        color: #8f2727;
        border-color: #efc0c0;
      }

      .account-option-card.danger span {
        color: #9f4a4a;
      }

      .password-field {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.4rem;
      }

      .password-toggle {
        border: 1px solid #c7d2df;
        background: #f8fbff;
        color: #2f445d;
        border-radius: 8px;
        padding: 0.5rem 0.72rem;
      }

      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.35rem;
      }

      .error-text {
        margin: 0.35rem 0 0;
        font-size: 0.84rem;
        color: #a12929;
      }

      .master-transfer {
        margin-top: 0.35rem;
        border-top: 1px solid #dce5ef;
        padding-top: 0.85rem;
        display: grid;
        gap: 0.55rem;
      }

      .master-transfer h4 {
        margin: 0;
        color: #1f3146;
      }

      .master-transfer p {
        margin: 0;
        color: #5d6f83;
        font-size: 0.9rem;
      }

      .btn-danger-outline {
        border: 1px solid #e8b0b0;
        background: #fff5f5;
        color: #a12929;
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

        .topbar.topbar-dashboard {
          grid-template-columns: 1fr;
        }

        .topbar.topbar-dashboard .topbar-page-title,
        .topbar.topbar-dashboard .topbar-center,
        .topbar.topbar-dashboard .topbar-user {
          justify-self: start;
        }

        .topbar-user {
          flex-wrap: wrap;
          width: 100%;
        }

        .btn-profile {
          max-width: 100%;
        }

        .account-options {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class LayoutComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  sidebarOculta = false;
  menuItemsVisibles: MenuItem[] = [];
  tituloPaginaActual = 'Sistema Web de Control Migratorio';
  esDashboardActivo = false;
  fechaDashboardIso = this.formatearFechaIso(new Date());
  modalCambioPasswordAbierto = false;
  vistaModalCuenta: VistaModalCuenta = 'PASSWORD';
  loadingCambioPassword = false;
  loadingTransferMaster = false;
  mostrarPasswordActual = false;
  mostrarPasswordNueva = false;
  mostrarPasswordConfirmar = false;
  targetMasterUserId = '';
  masterCandidates: MasterCandidate[] = [];
  alertPerfilAbierto = false;
  alertPerfilTitulo = 'Notificación';
  alertPerfilMensaje = '';
  alertPerfilTipo: 'success' | 'warning' = 'success';
  private readonly passwordPattern =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/;

  readonly formCambioPassword = this.formBuilder.group({
    passwordActual: ['', [Validators.required]],
    nuevaPassword: ['', [Validators.required, Validators.pattern(this.passwordPattern)]],
    confirmarPassword: ['', [Validators.required]],
  });
  private readonly logoAdminAuditor = '/assets/logo-ejercito-chile.png';
  private readonly logosPorJaf: Record<Jaf, string> = {
    TARAPACA: '/assets/JAF_TAPARACA.png',
    ANTOFAGASTA: '/assets/JAF_ANTOFAGASTA.png',
    ARICA_PARINACOTA: '/assets/JAF_ARICA_PARINACOTA.png',
  };

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
      roles: ['ADMINISTRADOR', 'OPERADOR', 'CONSULTA', 'AUDITOR'],
      icon: 'casos',
      exact: true,
    },
    {
      label: 'Gestión de Usuarios',
      path: '/usuarios',
      roles: ['ADMINISTRADOR'],
      icon: 'usuarios',
      dividerBefore: true,
    },
    {
      label: 'Trazabilidad',
      path: '/auditoria',
      roles: ['ADMINISTRADOR'],
      icon: 'reportes',
      masterOnly: true,
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

  get logoSidebarUrl(): string {
    const rol = this.authService.currentUser?.rol;
    if (rol === 'ADMINISTRADOR' || rol === 'AUDITOR') {
      return this.logoAdminAuditor;
    }

    const jaf = this.authService.currentUser?.jaf;
    if (!jaf) {
      return '/assets/logo-corneta.png';
    }

    return this.logosPorJaf[jaf] ?? '/assets/logo-corneta.png';
  }

  get esLogoJaf(): boolean {
    const rol = this.authService.currentUser?.rol;
    return rol !== 'ADMINISTRADOR' && rol !== 'AUDITOR';
  }

  get subtituloSidebar(): string {
    const rol = this.authService.currentUser?.rol;
    const jaf = this.authService.currentUser?.jaf;

    if ((rol === 'ADMINISTRADOR' || rol === 'AUDITOR') && !jaf) {
      return 'ADMINISTRACIÓN NACIONAL';
    }

    return this.etiquetaJaf(jaf);
  }

  get passwordsNoCoinciden(): boolean {
    const nueva = this.formCambioPassword.get('nuevaPassword')?.value ?? '';
    const confirmar = this.formCambioPassword.get('confirmarPassword')?.value ?? '';
    return Boolean(nueva && confirmar && nueva !== confirmar);
  }

  ngOnInit(): void {
    this.actualizarMenuItemsVisibles();
    this.actualizarTituloPagina();

    this.authService.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.actualizarMenuItemsVisibles());

    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.actualizarTituloPagina();
        }
      });
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

  abrirModalCambioPassword(): void {
    if (!this.authService.currentUser) {
      return;
    }

    this.modalCambioPasswordAbierto = true;
    this.loadingCambioPassword = false;
    this.mostrarPasswordActual = false;
    this.mostrarPasswordNueva = false;
    this.mostrarPasswordConfirmar = false;
    this.formCambioPassword.reset({
      passwordActual: '',
      nuevaPassword: '',
      confirmarPassword: '',
    });
    this.targetMasterUserId = '';
    this.masterCandidates = [];
    this.loadingTransferMaster = false;
    this.vistaModalCuenta = this.authService.currentUser.esMaster
      ? 'OPCIONES'
      : 'PASSWORD';

    if (this.authService.currentUser.esMaster) {
      this.cargarMasterCandidates();
    }
  }

  cerrarModalCambioPassword(): void {
    if (this.loadingCambioPassword) {
      return;
    }

    this.modalCambioPasswordAbierto = false;
    this.targetMasterUserId = '';
    this.masterCandidates = [];
    this.loadingTransferMaster = false;
    this.vistaModalCuenta = 'PASSWORD';
  }

  cerrarAlertaPerfil(): void {
    this.alertPerfilAbierto = false;
  }

  confirmarCambioPassword(): void {
    if (this.loadingCambioPassword) {
      return;
    }

    this.formCambioPassword.markAllAsTouched();
    if (this.formCambioPassword.invalid) {
      this.abrirAlertaPerfil(
        'Revisa la información',
        'Completa todos los campos y valida la nueva contraseña.',
        'warning',
      );
      return;
    }

    if (this.passwordsNoCoinciden) {
      this.abrirAlertaPerfil(
        'Revisa la información',
        'La confirmación no coincide con la nueva contraseña.',
        'warning',
      );
      return;
    }

    const passwordActual = this.formCambioPassword.get('passwordActual')?.value ?? '';
    const nuevaPassword = this.formCambioPassword.get('nuevaPassword')?.value ?? '';

    this.loadingCambioPassword = true;
    this.authService
      .changePassword({ passwordActual, nuevaPassword })
      .subscribe({
        next: () => {
          this.loadingCambioPassword = false;
          this.modalCambioPasswordAbierto = false;
          this.abrirAlertaPerfil(
            'Contraseña actualizada',
            'Tu nueva contraseña fue guardada correctamente.',
            'success',
          );
        },
        error: (error: HttpErrorResponse) => {
          this.loadingCambioPassword = false;
          const backendMessage =
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'No fue posible actualizar la contraseña. Intenta nuevamente.';
          this.abrirAlertaPerfil('Acción no completada', backendMessage, 'warning');
        },
      });
  }

  confirmarTransferMaster(): void {
    if (this.loadingTransferMaster || this.loadingCambioPassword) {
      return;
    }

    const passwordActual = this.formCambioPassword.get('passwordActual')?.value ?? '';
    if (!passwordActual) {
      this.abrirAlertaPerfil(
        'Revisa la información',
        'Ingresa tu contraseña actual para traspasar la cuenta master.',
        'warning',
      );
      return;
    }

    if (!this.targetMasterUserId) {
      this.abrirAlertaPerfil(
        'Revisa la información',
        'Selecciona un usuario destino para traspasar la cuenta master.',
        'warning',
      );
      return;
    }

    this.loadingTransferMaster = true;
    this.authService
      .transferMaster({
        passwordActual,
        targetUserId: this.targetMasterUserId,
      })
      .subscribe({
        next: (response) => {
          this.loadingTransferMaster = false;
          this.modalCambioPasswordAbierto = false;
          this.targetMasterUserId = '';
          this.masterCandidates = [];
          this.abrirAlertaPerfil(
            'Traspaso completado',
            `${response.message || 'La cuenta master fue transferida correctamente.'} Se cerrará tu sesión automáticamente.`,
            'success',
          );
          setTimeout(() => {
            this.authService.logout().subscribe(() => {
              this.router.navigate(['/login']);
            });
          }, 900);
        },
        error: (error: HttpErrorResponse) => {
          this.loadingTransferMaster = false;
          const backendMessage =
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'No fue posible traspasar la cuenta master. Intenta nuevamente.';
          this.abrirAlertaPerfil('Acción no completada', backendMessage, 'warning');
        },
      });
  }

  abrirVistaCambioPassword(): void {
    this.vistaModalCuenta = 'PASSWORD';
  }

  abrirVistaTransferMaster(): void {
    this.vistaModalCuenta = 'TRANSFER';
    if (!this.masterCandidates.length) {
      this.cargarMasterCandidates();
    }
  }

  volverOpcionesCuenta(): void {
    if (this.authService.currentUser?.esMaster) {
      this.vistaModalCuenta = 'OPCIONES';
      return;
    }
    this.vistaModalCuenta = 'PASSWORD';
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
        '/auditoria',
        '/reportes',
      ]);
    } else if (rolActual === 'OPERADOR') {
      menuPorRol = this.getMenuByPaths(['/casos/nuevo', '/casos']);
    } else {
      menuPorRol = this.getMenuByPaths(['/consulta', '/casos']);
    }

    this.menuItemsVisibles = menuPorRol;
  }

  private actualizarTituloPagina(): void {
    const rutaActiva = this.obtenerRutaActiva(this.activatedRoute);
    const titulo = rutaActiva.snapshot.data?.['pageTitle'];
    this.tituloPaginaActual =
      typeof titulo === 'string' && titulo.trim().length > 0
        ? titulo
        : 'Sistema Web de Control Migratorio';

    this.esDashboardActivo = rutaActiva.routeConfig?.path === 'dashboard';
    if (!this.esDashboardActivo) {
      return;
    }

    const fechaParam = rutaActiva.snapshot.queryParamMap.get('fecha') ?? '';
    const fechaNormalizada = this.normalizarFechaIso(fechaParam);
    this.fechaDashboardIso = fechaNormalizada ?? this.formatearFechaIso(new Date());
  }

  private obtenerRutaActiva(route: ActivatedRoute): ActivatedRoute {
    let actual = route;

    while (actual.firstChild) {
      actual = actual.firstChild;
    }

    return actual;
  }

  private getMenuByPaths(paths: string[]): MenuItem[] {
    return paths
      .map((path) => this.menuItems.find((item) => item.path === path))
      .filter((item): item is MenuItem => Boolean(item))
      .filter((item) => this.authService.hasRole(item.roles))
      .filter((item) => !item.masterOnly || Boolean(this.authService.currentUser?.esMaster));
  }

  private cargarMasterCandidates(): void {
    this.authService.listMasterCandidates().subscribe({
      next: (items) => {
        this.masterCandidates = items ?? [];
      },
      error: (error: HttpErrorResponse) => {
        this.masterCandidates = [];
        const backendMessage =
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible cargar los usuarios para traspaso master.';
        this.abrirAlertaPerfil('Acción no completada', backendMessage, 'warning');
      },
    });
  }

  private etiquetaJaf(jaf: Jaf | null | undefined): string {
    if (jaf === 'TARAPACA') {
      return 'JAF TARAPACÁ';
    }

    if (jaf === 'ANTOFAGASTA') {
      return 'JAF ANTOFAGASTA';
    }

    if (jaf === 'ARICA_PARINACOTA') {
      return 'JAF ARICA Y PARINACOTA';
    }

    return '';
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }

  private abrirAlertaPerfil(
    titulo: string,
    mensaje: string,
    tipo: 'success' | 'warning',
  ): void {
    this.alertPerfilTitulo = titulo;
    this.alertPerfilMensaje = mensaje;
    this.alertPerfilTipo = tipo;
    this.alertPerfilAbierto = true;
  }

  onDashboardFechaChange(event: Event): void {
    if (!this.esDashboardActivo) {
      return;
    }

    const target = event.target as HTMLInputElement | null;
    const fecha = this.normalizarFechaIso(target?.value ?? '');
    if (!fecha) {
      return;
    }

    this.fechaDashboardIso = fecha;
    this.router.navigate(['/dashboard'], { queryParams: { fecha } });
  }

  private normalizarFechaIso(fecha: string): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return null;
    }

    const date = new Date(`${fecha}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return this.formatearFechaIso(date);
  }

  private formatearFechaIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
