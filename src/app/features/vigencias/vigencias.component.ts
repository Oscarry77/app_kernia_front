import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { ClientesService } from '../../core/services/clientes.service';
import type { FilaVigencia } from '../../core/models/panel.model';
import { etiquetaDias, etiquetaEstatus, mensajeError } from '../clientes/panel-ui';

/**
 * (02-oct-2026) Fase 2: vista general de vencimientos de todas las apps
 * contratadas. Clic en una fila abre el expediente del cliente.
 */
@Component({
  selector: 'app-vigencias',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vigencias.component.html',
  styleUrls: ['../shared/crud-page.scss', '../clientes/clientes.component.scss', './vigencias.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VigenciasComponent implements OnInit {
  private service = inject(ClientesService);
  private router = inject(Router);

  readonly filtros = [
    { clave: 'por_vencer', nombre: 'Por vencer (30 días)' },
    { clave: 'vencidas', nombre: 'Vencidas' },
    { clave: 'suspendidas', nombre: 'Suspendidas' },
    { clave: 'prorroga', nombre: 'En prórroga' },
    { clave: 'sin_definir', nombre: 'Sin vigencia definida' },
    { clave: 'todas', nombre: 'Todas' },
  ];

  filtro = signal('por_vencer');
  filas = signal<FilaVigencia[]>([]);
  hoy = signal('');
  cargando = signal(false);
  error = signal<string | null>(null);

  readonly etiqueta = etiquetaEstatus;
  readonly etiquetaDias = etiquetaDias;

  ngOnInit(): void {
    this.cargar();
  }

  elegir(clave: string): void {
    this.filtro.set(clave);
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.vigencias(this.filtro()).subscribe({
      next: r => { this.filas.set(r.data); this.hoy.set(r.hoy); this.cargando.set(false); },
      error: (err: HttpErrorResponse) => { this.cargando.set(false); this.error.set(mensajeError(err, 'No se pudieron cargar las vigencias.')); },
    });
  }

  abrir(f: FilaVigencia): void {
    this.router.navigate(['/clientes', f.cliente_id]);
  }

  claseDias(f: FilaVigencia): string {
    if (f.dias_restantes === null) return 'dias--sin';
    if (f.en_prorroga || f.dias_restantes < 0) return 'dias--critico';
    if (f.aviso?.nivel === 'advertencia' || f.dias_restantes === 0) return 'dias--advertencia';
    if (f.aviso?.nivel === 'info') return 'dias--info';
    return 'dias--ok';
  }
}
