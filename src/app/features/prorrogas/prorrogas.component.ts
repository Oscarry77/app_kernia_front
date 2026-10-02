import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { HttpErrorResponse } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { AclService } from '../../core/services/acl.service';
import type { Prorroga } from '../../core/models/panel.model';
import { mensajeError } from '../clientes/panel-ui';
import { resolverProrroga } from './prorroga-ui';

/**
 * (02-oct-2026) Fase 3: solicitudes de prórroga pendientes. Cualquiera con
 * acceso puede abrir la ventana; autoriza quien escribe sus credenciales y
 * tiene nivel suficiente en el escalafón.
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

  filas = signal<Prorroga[]>([]);
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
  }

  async resolver(p: Prorroga, accion: 'autorizar' | 'rechazar'): Promise<void> {
    if (await resolverProrroga(this.acl, p, accion, `${p.cliente} · ${p.producto_nombre}`)) {
      this.cargar();
    }
  }
}
