import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';

import { AuthService } from '../../core/services/auth.service';
import { CatalogoService } from '../../core/services/catalogo.service';
import type { ExtraCatalogo, ModuloCatalogo, PlanCatalogo, ProductoCatalogo } from '../../core/models/panel.model';
import { COLOR_PRIMARIO, etiquetaLimite, mensajeError } from '../clientes/panel-ui';

interface EdicionPlan {
  producto: ProductoCatalogo;
  esNuevo: boolean;
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
  modulos: Set<string>;
  limites: Record<string, { valor: number | null; sinLimite: boolean; usar: boolean }>;
  clientes: number;
}

interface EdicionExtra {
  producto: ProductoCatalogo;
  esNuevo: boolean;
  codigo: string;
  nombre: string;
  limite: string;
  incremento: number;
  activo: boolean;
}

/**
 * (02-oct-2026) Catálogo de apps: datos generales, módulos (con sus
 * dependencias), planes y extras. Cambiar un plan afecta a todos los
 * clientes que lo tienen: se pide confirmación indicando cuántos son.
 */
@Component({
  selector: 'app-catalogo-productos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './catalogo-productos.component.html',
  styleUrls: ['../shared/crud-page.scss', '../clientes/clientes.component.scss', './catalogo-productos.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoProductosComponent implements OnInit {
  private service = inject(CatalogoService);
  private auth = inject(AuthService);

  /** (02-oct-2026) Fase 3: oculta lo que el rol no permite; Kernia valida de nuevo. */
  puede(permiso: string): boolean {
    return this.auth.puede(permiso);
  }

  productos = signal<ProductoCatalogo[]>([]);
  limitesDisponibles = signal<string[]>([]);
  cargando = signal(true);
  errorCarga = signal<string | null>(null);

  editandoProducto = signal<(Pick<ProductoCatalogo, 'slug' | 'nombre' | 'nombre_corto' | 'descripcion' | 'permite_ws_cntpaq'>) | null>(null);
  editandoPlan = signal<EdicionPlan | null>(null);
  editandoExtra = signal<EdicionExtra | null>(null);
  guardando = signal(false);
  error = signal<string | null>(null);

  readonly etiquetaLimite = etiquetaLimite;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.service.completo().subscribe({
      next: r => { this.productos.set(r.data); this.limitesDisponibles.set(r.limites_disponibles); this.cargando.set(false); },
      error: (err: HttpErrorResponse) => { this.cargando.set(false); this.errorCarga.set(mensajeError(err, 'No se pudo cargar el catálogo.')); },
    });
  }

  nombreModulo(p: ProductoCatalogo, clave: string): string {
    return p.modulos.find(m => m.clave === clave)?.nombre ?? clave;
  }

  limitesDe(plan: PlanCatalogo): { clave: string; valor: number | null }[] {
    return Object.entries(plan.limites ?? {}).map(([clave, valor]) => ({ clave, valor }));
  }

  requiereTexto(p: ProductoCatalogo, m: ModuloCatalogo): string | null {
    return m.requiere?.length ? 'Requiere ' + m.requiere.map(r => this.nombreModulo(p, r)).join(', ') : null;
  }

  // ── Producto ──────────────────────────────────────────────────────────

  editarProducto(p: ProductoCatalogo): void {
    this.error.set(null);
    this.editandoProducto.set({ slug: p.slug, nombre: p.nombre, nombre_corto: p.nombre_corto, descripcion: p.descripcion, permite_ws_cntpaq: p.permite_ws_cntpaq });
  }

  guardarProducto(): void {
    const e = this.editandoProducto();
    if (!e || this.guardando()) return;
    this.guardar(this.service.actualizarProducto(e.slug, e), () => this.editandoProducto.set(null), 'App actualizada');
  }

  // ── Planes ────────────────────────────────────────────────────────────

  nuevoPlan(p: ProductoCatalogo): void {
    this.abrirPlan(p, null);
  }

  editarPlan(p: ProductoCatalogo, plan: PlanCatalogo): void {
    this.abrirPlan(p, plan);
  }

  private abrirPlan(p: ProductoCatalogo, plan: PlanCatalogo | null): void {
    this.error.set(null);
    // Claves que ya usa el producto + las reconocidas.
    const claves = new Set([...this.limitesDisponibles(), ...p.planes.flatMap(pl => Object.keys(pl.limites ?? {}))]);
    const usadas = new Set(p.planes.flatMap(pl => Object.keys(pl.limites ?? {})));
    const limites: EdicionPlan['limites'] = {};
    for (const clave of claves) {
      const actual = plan?.limites?.[clave];
      const definido = plan ? clave in (plan.limites ?? {}) : usadas.has(clave);
      limites[clave] = { valor: actual ?? null, sinLimite: definido && actual === null && !!plan, usar: definido };
    }

    this.editandoPlan.set({
      producto: p,
      esNuevo: !plan,
      codigo: plan?.codigo ?? '',
      nombre: plan?.nombre ?? '',
      orden: plan?.orden ?? (Math.max(0, ...p.planes.map(x => x.orden ?? 0)) + 1),
      activo: plan?.activo ?? true,
      modulos: new Set(plan?.modulos ?? []),
      limites,
      clientes: plan?.clientes ?? 0,
    });
  }

  /** Marcar un módulo marca lo que requiere; desmarcarlo desmarca a quien depende de él. */
  alternarModulo(e: EdicionPlan, clave: string, marcado: boolean): void {
    const mods = new Set(e.modulos);
    const catalogo = e.producto.modulos;
    if (marcado) {
      const agregar = (c: string) => {
        mods.add(c);
        (catalogo.find(m => m.clave === c)?.requiere ?? []).forEach(agregar);
      };
      agregar(clave);
    } else {
      const quitar = (c: string) => {
        mods.delete(c);
        catalogo.filter(m => m.requiere?.includes(c)).forEach(m => quitar(m.clave));
      };
      quitar(clave);
    }
    this.editandoPlan.set({ ...e, modulos: mods });
  }

  async guardarPlan(): Promise<void> {
    const e = this.editandoPlan();
    if (!e || this.guardando()) return;

    if (!e.esNuevo && e.clientes > 0) {
      const ok = await Swal.fire({
        icon: 'warning',
        title: `Este cambio afecta a ${e.clientes} cliente(s)`,
        text: 'Sus módulos y límites cambiarán en sus apps en menos de un minuto. No se borra ningún dato.',
        showCancelButton: true, confirmButtonText: 'Aplicar a todos', cancelButtonText: 'Cancelar',
        confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true,
      });
      if (!ok.isConfirmed) return;
    }

    const limites: Record<string, number | null> = {};
    for (const [clave, l] of Object.entries(e.limites)) {
      if (l.usar) limites[clave] = l.sinLimite ? null : Number(l.valor ?? 0);
    }

    const plan: Partial<PlanCatalogo> = {
      codigo: e.codigo.trim(), nombre: e.nombre.trim(), orden: e.orden,
      modulos: e.producto.modulos.length ? e.producto.modulos.map(m => m.clave).filter(c => e.modulos.has(c)) : null,
      limites, ...(e.esNuevo ? {} : { activo: e.activo }),
    };

    this.guardar(this.service.guardarPlan(e.producto.slug, plan, e.esNuevo), () => this.editandoPlan.set(null), e.esNuevo ? 'Plan creado' : 'Plan actualizado');
  }

  // ── Extras ────────────────────────────────────────────────────────────

  nuevoExtra(p: ProductoCatalogo): void {
    this.error.set(null);
    this.editandoExtra.set({ producto: p, esNuevo: true, codigo: '', nombre: '', limite: this.limitesDisponibles()[0] ?? 'max_empresas', incremento: 1, activo: true });
  }

  editarExtra(p: ProductoCatalogo, x: ExtraCatalogo): void {
    this.error.set(null);
    this.editandoExtra.set({ producto: p, esNuevo: false, codigo: x.codigo, nombre: x.nombre, limite: x.limite, incremento: x.incremento, activo: x.activo ?? true });
  }

  guardarExtra(): void {
    const e = this.editandoExtra();
    if (!e || this.guardando()) return;
    const extra: Partial<ExtraCatalogo> = {
      codigo: e.codigo.trim(), nombre: e.nombre.trim(), limite: e.limite, incremento: Number(e.incremento),
      ...(e.esNuevo ? {} : { activo: e.activo }),
    };
    this.guardar(this.service.guardarExtra(e.producto.slug, extra, e.esNuevo), () => this.editandoExtra.set(null), e.esNuevo ? 'Extra creado' : 'Extra actualizado');
  }

  // ── Auxiliar ──────────────────────────────────────────────────────────

  private guardar(accion: ReturnType<CatalogoService['actualizarProducto']>, cerrar: () => void, exito: string): void {
    this.guardando.set(true);
    this.error.set(null);
    accion.subscribe({
      next: () => {
        this.guardando.set(false);
        cerrar();
        this.cargar();
        Swal.fire({ icon: 'success', title: exito, timer: 1500, showConfirmButton: false });
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(mensajeError(err, 'No se pudo guardar.'));
      },
    });
  }
}
