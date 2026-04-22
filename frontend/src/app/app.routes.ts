import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { HomeRedirectComponent } from './features/auth/home-redirect.component';
import { LayoutComponent } from './shared/components/layout/layout.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { UsuariosComponent } from './features/usuarios/usuarios.component';
import { CasosListComponent } from './features/casos/casos-list.component';
import { CasoFormComponent } from './features/casos/caso-form.component';
import { CasoDetalleComponent } from './features/casos/caso-detalle.component';
import { ReportesComponent } from './features/reportes/reportes.component';
import { AuditoriaComponent } from './features/auditoria/auditoria.component';
import { ConsultaComponent } from './features/consulta/consulta.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        component: HomeRedirectComponent,
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR'] },
      },
      {
        path: 'usuarios',
        component: UsuariosComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR'], disabled: true },
      },
      {
        path: 'casos',
        component: CasosListComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR', 'OPERADOR', 'CONSULTA'] },
      },
      {
        path: 'casos/nuevo',
        component: CasoFormComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR', 'OPERADOR'] },
      },
      {
        path: 'casos/:id/editar',
        component: CasoFormComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR', 'OPERADOR'] },
      },
      {
        path: 'casos/:id',
        component: CasoDetalleComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR', 'OPERADOR', 'CONSULTA'] },
      },
      {
        path: 'reportes',
        component: ReportesComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR'], disabled: true },
      },
      {
        path: 'auditoria',
        component: AuditoriaComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR'] },
      },
      {
        path: 'consulta',
        component: ConsultaComponent,
        canActivate: [roleGuard],
        data: { roles: ['CONSULTA'] },
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
