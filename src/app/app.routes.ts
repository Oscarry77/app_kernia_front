import { Routes } from '@angular/router';
import { authGuard, permisoGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then(m => m.LoginComponent),
  },
  // (08-oct-2026) Encuesta de salida que contesta el CLIENTE: pública, sin sesión.
  {
    path: 'salida/:token',
    loadComponent: () =>
      import('./features/formulario-salida/formulario-salida.component').then(m => m.FormularioSalidaComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/shell/shell.component').then(m => m.ShellComponent),
    children: [
      // (02-oct-2026) El inicio es el modelo v2 (clientes y sus apps).
      { path: '', redirectTo: 'clientes', pathMatch: 'full' },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./features/clientes/clientes.component').then(m => m.ClientesComponent),
      },
      {
        path: 'clientes/:id',
        loadComponent: () =>
          import('./features/clientes/cliente-detalle.component').then(m => m.ClienteDetalleComponent),
      },
      {
        path: 'vigencias',
        loadComponent: () =>
          import('./features/vigencias/vigencias.component').then(m => m.VigenciasComponent),
      },
      {
        path: 'catalogo/productos',
        loadComponent: () =>
          import('./features/catalogo/catalogo-productos.component').then(m => m.CatalogoProductosComponent),
      },
      // Fase 3 (02-oct-2026)
      {
        path: 'prorrogas',
        canActivate: [permisoGuard('prorrogas.solicitar')],
        loadComponent: () =>
          import('./features/prorrogas/prorrogas.component').then(m => m.ProrrogasComponent),
      },
      {
        path: 'operadores',
        canActivate: [permisoGuard('operadores.gestionar')],
        loadComponent: () =>
          import('./features/operadores/operadores.component').then(m => m.OperadoresComponent),
      },
      {
        path: 'escalafon',
        canActivate: [permisoGuard('escalafon.gestionar')],
        loadComponent: () =>
          import('./features/escalafon/escalafon.component').then(m => m.EscalafonComponent),
      },
      // (07-oct-2026) Centro de correo.
      {
        path: 'correos',
        canActivate: [permisoGuard('correos.ver')],
        loadComponent: () =>
          import('./features/correos/correos.component').then(m => m.CorreosComponent),
      },
      // (07-oct-2026) Bóveda: solo el superadministrador.
      {
        path: 'boveda',
        canActivate: [permisoGuard('boveda.gestionar')],
        loadComponent: () =>
          import('./features/boveda/boveda.component').then(m => m.BovedaComponent),
      },
      // (08-oct-2026) Motivos de salida: Dirección.
      {
        path: 'motivos-salida',
        canActivate: [permisoGuard('salidas.motivos')],
        loadComponent: () =>
          import('./features/motivos-salida/motivos-salida.component').then(m => m.MotivosSalidaComponent),
      },
      {
        path: 'bitacora',
        canActivate: [permisoGuard('auditoria.ver')],
        loadComponent: () =>
          import('./features/auditoria/auditoria.component').then(m => m.AuditoriaComponent),
      },
      // Modelo heredado, solo consulta.
      {
        path: 'tenants',
        canActivate: [permisoGuard('auditoria.ver')],
        loadComponent: () =>
          import('./features/tenants/tenants.component').then(m => m.TenantsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
