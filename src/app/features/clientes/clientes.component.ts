import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { ClientesService } from '../../core/services/clientes.service';
import type { Cliente, SuscripcionDetalle } from '../../core/models/panel.model';
import { ClienteFormComponent } from './cliente-form.component';
import { etiquetaEstatus, mensajeError, etiquetaTipoCliente } from './panel-ui';

/** (02-oct-2026) Lista de expedientes (clientes del modelo v2), con sus apps, y alta de cliente. */
@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, ClienteFormComponent],
  templateUrl: './clientes.component.html',
  styleUrls: ['../shared/crud-page.scss', './clientes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientesComponent implements OnInit {
  private service = inject(ClientesService);
  private auth = inject(AuthService);

  /** (02-oct-2026) Fase 3: oculta lo que el rol no permite; Kernia valida de nuevo. */
  puede(permiso: string): boolean {
    return this.auth.puede(permiso);
  }
  private router = inject(Router);

  clientes = signal<Cliente[]>([]);
  cargando = signal(false);
  errorCarga = signal<string | null>(null);
  busqueda = signal('');
  mostrarForm = signal(false);

  readonly etiqueta = etiquetaEstatus;

  readonly etiquetaTipo = etiquetaTipoCliente;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.service.listar(this.busqueda()).subscribe({
      next: res => { this.clientes.set(res.data); this.cargando.set(false); },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.errorCarga.set(mensajeError(err, 'No se pudo cargar la lista de clientes.'));
      },
    });
  }

  buscar(valor: string): void {
    this.busqueda.set(valor.trim());
    this.cargar();
  }

  abrir(c: Cliente): void {
    this.router.navigate(['/clientes', c.id]);
  }

  creado(c: Cliente<SuscripcionDetalle>): void {
    this.mostrarForm.set(false);
    this.router.navigate(['/clientes', c.id]);
  }
}
