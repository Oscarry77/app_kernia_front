import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { ClientesService } from '../../core/services/clientes.service';
import type { Cliente, ProductoCatalogo, SuscripcionDetalle } from '../../core/models/panel.model';
import { COLOR_PRIMARIO, etiquetaEstatus, etiquetaLimite, mensajeError, mostrarPasswordUnaVez } from './panel-ui';

/**
 * (02-oct-2026) Detalle de un cliente: datos generales y, por cada app
 * contratada, su plan, módulos, límites, extras y acciones (suspender,
 * reactivar, restablecer al administrador, reintentar alta, métricas).
 * Cada acción queda en la bitácora de Kernia.
 */
@Component({
  selector: 'app-cliente-detalle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './cliente-detalle.component.html',
  styleUrls: ['../shared/crud-page.scss', './clientes.component.scss', './cliente-detalle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClienteDetalleComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private service = inject(ClientesService);

  cliente = signal<Cliente<SuscripcionDetalle> | null>(null);
  catalogo = signal<ProductoCatalogo[]>([]);
  cargando = signal(true);
  errorCarga = signal<string | null>(null);
  ocupado = signal<number | null>(null);
  metricas = signal<Record<number, Record<string, unknown> | 'cargando'>>({});

  editando = signal(false);
  agregando = signal(false);
  guardando = signal(false);
  error = signal<string | null>(null);

  readonly etiqueta = etiquetaEstatus;
  readonly etiquetaLimite = etiquetaLimite;

  formCliente = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(255)]],
    rfc: ['', [Validators.maxLength(20)]],
    notas: [''],
  });

  formApp = this.fb.group({
    producto: ['', Validators.required],
    plan: [''],
    admin_nombre: ['', [Validators.required, Validators.maxLength(120)]],
    admin_email: ['', [Validators.required, Validators.email]],
  });

  /** Apps que el cliente aún no tiene (no se permite una segunda suscripción a la misma app). */
  productosDisponibles = computed(() => {
    const tiene = new Set((this.cliente()?.suscripciones ?? []).map(s => s.producto));
    return this.catalogo().filter(p => !tiene.has(p.slug));
  });

  private productoSeleccionado = signal<string>('');
  planesDelProducto = computed(() => this.catalogo().find(p => p.slug === this.productoSeleccionado())?.planes ?? []);

  private get id(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  ngOnInit(): void {
    this.service.catalogo().subscribe({ next: r => this.catalogo.set(r.data) });
    this.cargar();
    this.formApp.controls.producto.valueChanges.subscribe(v => {
      this.productoSeleccionado.set(v ?? '');
      const planes = this.planesDelProducto();
      this.formApp.controls.plan.setValue(planes[0]?.codigo ?? '');
    });
  }

  cargar(): void {
    this.errorCarga.set(null);
    this.service.obtener(this.id).subscribe({
      next: r => { this.cliente.set(r.data); this.cargando.set(false); },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.errorCarga.set(err.status === 404 ? 'El cliente no existe.' : mensajeError(err, 'No se pudo cargar el cliente.'));
      },
    });
  }

  // ── Catálogo ──────────────────────────────────────────────────────────

  producto(slug: string): ProductoCatalogo | undefined {
    return this.catalogo().find(p => p.slug === slug);
  }

  nombreModulo(producto: string, clave: string): string {
    return this.producto(producto)?.modulos.find(m => m.clave === clave)?.nombre ?? clave;
  }

  limites(s: SuscripcionDetalle): { clave: string; valor: number | null }[] {
    return Object.entries(s.limites ?? {}).map(([clave, valor]) => ({ clave, valor }));
  }

  extrasDe(s: SuscripcionDetalle) {
    return (this.producto(s.producto)?.extras ?? []).map(e => ({ ...e, total: s.extras?.[e.codigo] ?? 0 }));
  }

  // ── Cliente ───────────────────────────────────────────────────────────

  editarCliente(): void {
    const c = this.cliente();
    if (!c) return;
    this.formCliente.reset({ nombre: c.nombre, rfc: c.rfc ?? '', notas: c.notas ?? '' });
    this.error.set(null);
    this.editando.set(true);
  }

  guardarCliente(): void {
    if (this.formCliente.invalid || this.guardando()) return;
    this.guardando.set(true);
    const v = this.formCliente.getRawValue();
    this.service.actualizar(this.id, { nombre: v.nombre!, rfc: v.rfc || null, notas: v.notas || null }).subscribe({
      next: r => { this.cliente.set(r.data); this.guardando.set(false); this.editando.set(false); },
      error: (err: HttpErrorResponse) => { this.guardando.set(false); this.error.set(mensajeError(err, 'No se pudo guardar.')); },
    });
  }

  // ── Alta de app ───────────────────────────────────────────────────────

  agregarApp(): void {
    const primero = this.productosDisponibles()[0]?.slug ?? '';
    this.formApp.reset({ producto: '', plan: '', admin_nombre: '', admin_email: '' });
    this.formApp.controls.producto.setValue(primero);
    this.error.set(null);
    this.agregando.set(true);
  }

  guardarApp(): void {
    if (this.formApp.invalid || this.guardando()) {
      this.formApp.markAllAsTouched();
      return;
    }
    if (this.planesDelProducto().length > 0 && !this.formApp.controls.plan.value) {
      this.error.set('Esta app requiere un plan.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    const v = this.formApp.getRawValue();

    this.service.suscribir(this.id, {
      producto: v.producto!, plan: v.plan || null, admin_nombre: v.admin_nombre!, admin_email: v.admin_email!,
    }).subscribe({
      next: async r => {
        this.guardando.set(false);
        this.agregando.set(false);
        this.cargar();
        const titulo = r.data.estatus === 'en_aprovisionamiento'
          ? `${r.data.producto_nombre}: en aprovisionamiento`
          : `${r.data.producto_nombre} contratada`;
        await mostrarPasswordUnaVez(titulo, r.data.admin_email, r.password_temporal);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(mensajeError(err, 'No se pudo dar de alta la app.'));
        this.cargar();
      },
    });
  }

  // ── Acciones por suscripción ──────────────────────────────────────────

  async cambiarPlan(s: SuscripcionDetalle, codigo: string): Promise<void> {
    if (!codigo || codigo === s.plan) return;
    const plan = this.producto(s.producto)?.planes.find(p => p.codigo === codigo);
    const ok = await Swal.fire({
      icon: 'question',
      title: `¿Cambiar a ${plan?.nombre ?? codigo}?`,
      text: 'Los módulos y límites del cliente cambiarán en su app en menos de un minuto. No se borra ningún dato.',
      showCancelButton: true, confirmButtonText: 'Cambiar plan', cancelButtonText: 'Cancelar',
      confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true,
    });
    if (!ok.isConfirmed) { this.cargar(); return; }

    this.ejecutar(s.id, this.service.cambiarPlan(s.id, codigo), 'Plan actualizado');
  }

  async moverExtra(s: SuscripcionDetalle, extra: { codigo: string; nombre: string; total: number }, signo: 1 | -1): Promise<void> {
    const r = await Swal.fire({
      title: `${signo > 0 ? 'Agregar' : 'Retirar'}: ${extra.nombre}`,
      html: `<p style="margin:0 0 8px">Contratados actualmente: <b>${extra.total}</b></p>`,
      input: 'number',
      inputLabel: 'Cantidad',
      inputValue: 1,
      inputAttributes: { min: '1', max: signo > 0 ? '1000' : String(extra.total), step: '1' },
      showCancelButton: true, confirmButtonText: signo > 0 ? 'Agregar' : 'Retirar', cancelButtonText: 'Cancelar',
      confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true,
      inputValidator: v => (!v || Number(v) < 1 ? 'Indica una cantidad mayor a 0.' : null),
    });
    if (!r.isConfirmed) return;

    const motivo = await this.pedirMotivo(signo > 0 ? 'Referencia de pago o motivo' : 'Motivo del retiro');
    if (!motivo) return;

    this.ejecutar(s.id, this.service.agregarExtra(s.id, extra.codigo, signo * Number(r.value), motivo), 'Extras actualizados');
  }

  async cambiarEstatus(s: SuscripcionDetalle): Promise<void> {
    const suspender = s.estatus_almacenado === 'activo';
    const motivo = await this.pedirMotivo(
      suspender ? `Suspender ${s.producto_nombre}` : `Reactivar ${s.producto_nombre}`,
      suspender
        ? 'El cliente perderá el acceso a la app de inmediato y se cerrarán sus sesiones.'
        : 'El cliente recuperará el acceso a la app.',
    );
    if (!motivo) return;

    this.ocupado.set(s.id);
    try {
      const r = await firstValueFrom(this.service.cambiarEstatus(s.id, suspender ? 'suspendido' : 'activo', motivo));
      this.cargar();
      await Swal.fire(r.app_confirmo
        ? { icon: 'success', title: suspender ? 'Suscripción suspendida' : 'Suscripción reactivada', text: 'La app confirmó el cambio.', timer: 2200, showConfirmButton: false }
        : { icon: 'warning', title: 'Cambio aplicado en Kernia', text: 'La app no confirmó todavía. Kernia reintentará el aviso automáticamente cada minuto hasta que la app lo confirme.', confirmButtonColor: COLOR_PRIMARIO });
    } catch (err) {
      await this.mostrarError(err as HttpErrorResponse, 'No se pudo cambiar el estatus.');
    } finally {
      this.ocupado.set(null);
    }
  }

  async restablecerAdmin(s: SuscripcionDetalle): Promise<void> {
    const r = await Swal.fire({
      icon: 'warning',
      title: 'Restablecer acceso del administrador',
      html: `Se generará una contraseña temporal nueva para <b>${s.admin_email ?? 'el administrador'}</b> en ${s.producto_nombre}.<br>
             Su contraseña actual y sus sesiones abiertas dejarán de funcionar.`,
      showCancelButton: true, confirmButtonText: 'Restablecer', cancelButtonText: 'Cancelar',
      confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true,
    });
    if (!r.isConfirmed) return;

    this.ocupado.set(s.id);
    try {
      const res = await firstValueFrom(this.service.restablecerAdmin(s.id));
      await mostrarPasswordUnaVez('Acceso restablecido', res.email, res.password_temporal);
    } catch (err) {
      await this.mostrarError(err as HttpErrorResponse, 'No se pudo restablecer el acceso.');
    } finally {
      this.ocupado.set(null);
    }
  }

  async reintentar(s: SuscripcionDetalle): Promise<void> {
    const r = await Swal.fire({
      title: `Reintentar alta de ${s.producto_nombre}`,
      text: 'Se repite el aprovisionamiento con la misma llave; la app no duplica nada.',
      input: 'text', inputLabel: 'Nombre del administrador', inputValue: '',
      showCancelButton: true, confirmButtonText: 'Reintentar', cancelButtonText: 'Cancelar',
      confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true,
      inputValidator: v => (!v?.trim() ? 'Indica el nombre del administrador.' : null),
    });
    if (!r.isConfirmed) return;

    this.ocupado.set(s.id);
    try {
      const res = await firstValueFrom(this.service.reintentar(s.id, r.value.trim()));
      this.cargar();
      await mostrarPasswordUnaVez(
        res.data.estatus === 'activo' ? 'Alta completada' : 'Reintento enviado',
        res.data.admin_email,
        res.password_temporal,
      );
    } catch (err) {
      await this.mostrarError(err as HttpErrorResponse, 'No se pudo reintentar el alta.');
    } finally {
      this.ocupado.set(null);
    }
  }

  verMetricas(s: SuscripcionDetalle): void {
    const actuales = { ...this.metricas() };
    if (actuales[s.id]) {
      delete actuales[s.id];
      this.metricas.set(actuales);
      return;
    }
    this.metricas.set({ ...actuales, [s.id]: 'cargando' });
    this.service.metricas(s.id).subscribe({
      next: r => this.metricas.set({ ...this.metricas(), [s.id]: r.data }),
      error: () => this.metricas.set({ ...this.metricas(), [s.id]: { ok: false } }),
    });
  }

  metricasDe(id: number): Record<string, unknown> | 'cargando' | undefined {
    return this.metricas()[id];
  }

  entradas(m: Record<string, unknown>): { clave: string; valor: unknown }[] {
    return Object.entries(m).filter(([k]) => k !== 'ok').map(([clave, valor]) => ({ clave: clave.replace(/_/g, ' '), valor }));
  }

  // ── Auxiliares ────────────────────────────────────────────────────────

  private async pedirMotivo(titulo: string, texto?: string): Promise<string | null> {
    const r = await Swal.fire({
      title: titulo,
      text: texto,
      input: 'textarea',
      inputLabel: 'Motivo (queda en la bitácora)',
      showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar',
      confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true,
      inputValidator: v => (!v?.trim() ? 'El motivo es obligatorio.' : null),
    });
    return r.isConfirmed ? String(r.value).trim() : null;
  }

  private ejecutar(id: number, accion: ReturnType<ClientesService['cambiarPlan']>, exito: string): void {
    this.ocupado.set(id);
    accion.subscribe({
      next: () => {
        this.ocupado.set(null);
        this.cargar();
        Swal.fire({ icon: 'success', title: exito, timer: 1600, showConfirmButton: false });
      },
      error: async (err: HttpErrorResponse) => {
        this.ocupado.set(null);
        this.cargar();
        await this.mostrarError(err, 'No se pudo completar la acción.');
      },
    });
  }

  private async mostrarError(err: HttpErrorResponse, porDefecto: string): Promise<void> {
    await Swal.fire({ icon: 'error', title: 'No se pudo completar', text: mensajeError(err, porDefecto), confirmButtonColor: COLOR_PRIMARIO });
  }
}
