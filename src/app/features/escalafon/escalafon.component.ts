import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';

import { AclService } from '../../core/services/acl.service';
import type { NivelEscalafon, Operador } from '../../core/models/panel.model';
import { mensajeError } from '../clientes/panel-ui';

interface EdicionNivel {
  id: number | null;
  nivel: number;
  puesto: string;
  usuario_id: number | null;
  dias_max: number;
  activo: boolean;
}

/**
 * (02-oct-2026) Fase 3: escalafón de autorización de prórrogas. Mientras no
 * haya ningún nivel capturado, solo el superadministrador autoriza.
 */
@Component({
  selector: 'app-escalafon',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './escalafon.component.html',
  styleUrls: ['../shared/crud-page.scss', '../clientes/clientes.component.scss', '../shared/acl-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EscalafonComponent implements OnInit {
  private acl = inject(AclService);

  niveles = signal<NivelEscalafon[]>([]);
  operadores = signal<Operador[]>([]);
  maxDias = signal(6);
  cargando = signal(true);
  errorCarga = signal<string | null>(null);

  edicion = signal<EdicionNivel | null>(null);
  guardando = signal(false);
  error = signal<string | null>(null);

  /** Candidatos: dirección y gerencia activos (los únicos roles que autorizan). */
  readonly candidatos = computed(() => this.operadores().filter(o => o.activo && ['direccion', 'gerente'].includes(o.rol)));

  ngOnInit(): void {
    this.cargar();
    this.acl.operadores().subscribe({ next: r => this.operadores.set(r.data) });
  }

  cargar(): void {
    this.errorCarga.set(null);
    this.acl.escalafon().subscribe({
      next: r => { this.niveles.set(r.data); this.maxDias.set(r.max_dias); this.cargando.set(false); },
      error: (err: HttpErrorResponse) => { this.cargando.set(false); this.errorCarga.set(mensajeError(err, 'No se pudo cargar el escalafón.')); },
    });
  }

  nuevo(): void {
    this.error.set(null);
    const siguiente = Math.max(0, ...this.niveles().map(n => n.nivel)) + 1;
    this.edicion.set({ id: null, nivel: siguiente, puesto: '', usuario_id: null, dias_max: Math.min(siguiente * 2, this.maxDias()), activo: true });
  }

  editar(n: NivelEscalafon): void {
    this.error.set(null);
    this.edicion.set({ id: n.id, nivel: n.nivel, puesto: n.puesto, usuario_id: n.usuario_id, dias_max: n.dias_max, activo: n.activo });
  }

  guardar(): void {
    const e = this.edicion();
    if (!e || this.guardando()) return;
    if (!e.puesto.trim() || !e.usuario_id) { this.error.set('Puesto y persona son obligatorios.'); return; }

    this.guardando.set(true);
    this.error.set(null);
    this.acl.guardarNivel(e.id, {
      nivel: Number(e.nivel), puesto: e.puesto.trim(), usuario_id: Number(e.usuario_id), dias_max: Number(e.dias_max), activo: e.activo,
    }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.edicion.set(null);
        this.cargar();
        Swal.fire({ icon: 'success', title: 'Escalafón actualizado', timer: 1500, showConfirmButton: false });
      },
      error: (err: HttpErrorResponse) => { this.guardando.set(false); this.error.set(mensajeError(err, 'No se pudo guardar.')); },
    });
  }
}
