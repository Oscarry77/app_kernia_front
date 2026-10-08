import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { HttpErrorResponse } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { ClientesService } from '../../core/services/clientes.service';
import type { FilaMotivoSalida, ProductoCatalogo, ResumenMotivosSalida } from '../../core/models/panel.model';
import { mensajeError } from '../clientes/panel-ui';

/**
 * (08-oct-2026) "Motivos de salida" para Dirección: por qué se van los
 * clientes (o bajan de plan), según el asesor y según el propio cliente.
 */
@Component({
  selector: 'app-motivos-salida',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './motivos-salida.component.html',
  styleUrls: ['../shared/crud-page.scss', '../clientes/clientes.component.scss', './motivos-salida.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotivosSalidaComponent implements OnInit {
  private service = inject(ClientesService);

  filas = signal<FilaMotivoSalida[]>([]);
  resumen = signal<ResumenMotivosSalida | null>(null);
  productos = signal<ProductoCatalogo[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  filtros = { desde: '', hasta: '', origen: '', evento: '', producto: '' };

  readonly eventos: Record<string, string> = { retiro: 'Retiro de la app', finiquito: 'Finiquito', baja_plan: 'Baja de plan', archivo: 'Archivo de empresa' };

  /** Motivos con al menos una respuesta, de más a menos; la barra es relativa al mayor. */
  motivos = computed(() => {
    const r = this.resumen();
    if (!r) return [];
    const filas = r.por_motivo.map(m => ({ ...m, total: m.asesor + m.cliente })).filter(m => m.total > 0).sort((a, b) => b.total - a.total);
    const max = Math.max(1, ...filas.map(m => m.total));
    return filas.map(m => ({ ...m, pct: Math.round((100 * m.total) / max) }));
  });

  ngOnInit(): void {
    this.service.catalogo().subscribe({ next: r => this.productos.set(r.data) });
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.motivosSalidaDireccion(this.filtros).subscribe({
      next: r => { this.filas.set(r.data); this.resumen.set(r.resumen); this.cargando.set(false); },
      error: (err: HttpErrorResponse) => { this.cargando.set(false); this.error.set(mensajeError(err, 'No se pudieron cargar los motivos.')); },
    });
  }

  limpiar(): void {
    this.filtros = { desde: '', hasta: '', origen: '', evento: '', producto: '' };
    this.cargar();
  }

  estrellas(n: number | null): string {
    return n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—';
  }

  /** Una solicitud del asesor que se rechazó o canceló no fue una salida real. */
  noConcretada(f: FilaMotivoSalida): boolean {
    return f.estado_solicitud === 'rechazada' || f.estado_solicitud === 'cancelada';
  }
}
