import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { HttpErrorResponse } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { AclService } from '../../core/services/acl.service';
import type { RegistroAuditoria } from '../../core/models/panel.model';
import { mensajeError } from '../clientes/panel-ui';

/** (02-oct-2026) Fase 3: bitácora de todo lo que se hace en el panel. */
@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './auditoria.component.html',
  styleUrls: ['../shared/crud-page.scss', '../clientes/clientes.component.scss', '../shared/acl-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditoriaComponent implements OnInit {
  private acl = inject(AclService);

  registros = signal<RegistroAuditoria[]>([]);
  pagina = signal(1);
  paginas = signal(1);
  total = signal(0);
  cargando = signal(true);
  error = signal<string | null>(null);
  accion = '';

  ngOnInit(): void {
    this.cargar(1);
  }

  cargar(pagina: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.acl.auditoria({ accion: this.accion.trim() || undefined, pagina }).subscribe({
      next: r => {
        this.registros.set(r.data);
        this.pagina.set(r.pagina);
        this.paginas.set(r.paginas);
        this.total.set(r.total);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => { this.cargando.set(false); this.error.set(mensajeError(err, 'No se pudo cargar la bitácora.')); },
    });
  }

  json(v: Record<string, unknown> | null): string {
    return v ? JSON.stringify(v, null, 1) : '—';
  }
}
