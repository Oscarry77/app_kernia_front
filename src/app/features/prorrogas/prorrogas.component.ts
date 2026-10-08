import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { HttpErrorResponse } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { AclService } from '../../core/services/acl.service';
import { AuthService } from '../../core/services/auth.service';
import { ClientesService } from '../../core/services/clientes.service';
import type { Prorroga, SolicitudPlan, SolicitudSalida } from '../../core/models/panel.model';
import { resolverCambioPlan, resumenSolicitud } from '../planes/planes-ui';
import { etiquetaTipoSalida, resolverSalida, resumenSalida } from '../salidas/salidas-ui';
import { mensajeError } from '../clientes/panel-ui';
import { resolverProrroga } from './prorroga-ui';

/**
 * (02-oct-2026) Fase 3: solicitudes de prórroga pendientes. Cualquiera con
 * acceso puede abrir la ventana; autoriza quien escribe sus credenciales y
 * tiene nivel suficiente en el escalafón.
 *
 * (05-oct-2026) "Autorizaciones": también los cambios de plan pendientes,
 * con el resumen de pagos del cliente.
 *
 * (08-oct-2026) También las salidas: retiro, reactivación y finiquito.
 */
@Component({
  selector: 'app-prorrogas',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './prorrogas.component.html',
  styleUrls: ['../shared/crud-page.scss', '../clientes/clientes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProrrogasComponent implements OnInit {
  private acl = inject(AclService);
  private auth = inject(AuthService);
  private clientes = inject(ClientesService);

  filas = signal<Prorroga[]>([]);
  cambios = signal<SolicitudPlan[]>([]);
  readonly resumenCambio = resumenSolicitud;
  readonly veCambios = this.auth.puede('planes.solicitar');
  salidas = signal<SolicitudSalida[]>([]);
  readonly veSalidas = this.auth.puede('salidas.solicitar');
  readonly resumenSalida = resumenSalida;
  readonly etiquetaTipoSalida = etiquetaTipoSalida;
  cargando = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.acl.pendientes().subscribe({
      next: r => { this.filas.set(r.data); this.cargando.set(false); },
      error: (err: HttpErrorResponse) => { this.cargando.set(false); this.error.set(mensajeError(err, 'No se pudieron cargar las solicitudes.')); },
    });
    if (this.veCambios) {
      this.clientes.cambiosPlanPendientes().subscribe({ next: r => this.cambios.set(r.data), error: () => this.cambios.set([]) });
    }
    if (this.veSalidas) {
      this.clientes.salidasPendientes().subscribe({ next: r => this.salidas.set(r.data), error: () => this.salidas.set([]) });
    }
  }

  async resolverCambio(sol: SolicitudPlan, accion: 'autorizar' | 'rechazar'): Promise<void> {
    if (await resolverCambioPlan(this.clientes, sol, accion, `${sol.cliente} · ${sol.producto_nombre}`)) {
      this.cargar();
    }
  }

  async resolverSalida(sol: SolicitudSalida, accion: 'autorizar' | 'rechazar'): Promise<void> {
    if (await resolverSalida(this.clientes, sol, accion, `${sol.cliente} · ${sol.producto_nombre}`)) {
      this.cargar();
    }
  }

  async resolver(p: Prorroga, accion: 'autorizar' | 'rechazar'): Promise<void> {
    if (await resolverProrroga(this.acl, p, accion, `${p.cliente} · ${p.producto_nombre}`)) {
      this.cargar();
    }
  }
}
