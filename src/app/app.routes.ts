import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then(m => m.LoginComponent),
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
      // Modelo heredado, solo consulta.
      {
        path: 'tenants',
        loadComponent: () =>
          import('./features/tenants/tenants.component').then(m => m.TenantsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
