import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import type { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { ClientesService } from '../../core/services/clientes.service';
import type { Cliente, Pago, ProductoCatalogo, SuscripcionDetalle } from '../../core/models/panel.model';
import { ClienteFormComponent } from './cliente-form.component';
import { COLOR_PRIMARIO, etiquetaDias, etiquetaEstatus, etiquetaLimite, mensajeError, mostrarPasswordUnaVez } from './panel-ui';

interface EdicionVigencia {
  s: SuscripcionDetalle;
  modalidad_pago: string;
  fecha_contratacion: string;
  fecha_proximo_pago: string;
  dias_gracia: number;
  suspension_automatica: boolean;
}

interface CapturaPago {
  s: SuscripcionDetalle;
  referencia: string;
  fecha_pago: string;
  monto: number | null;
  moneda: string;
  notas: string;
}

/**
 * (02-oct-2026) Detalle de un cliente: datos generales y, por cada app
 * contratada, su plan, módulos, límites, extras y acciones (suspender,
 * reactivar, restablecer al administrador, reintentar alta, métricas).
 * Cada acción queda en la bitácora de Kernia.
 */
@Component({
  selector: 'app-cliente-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, ClienteFormComponent],
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
  readonly etiquetaDias = etiquetaDias;
  readonly modalidades = ['mensual', 'trimestral', 'semestral', 'anual'];
  readonly hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

  // Fase 2 (02-oct-2026): vigencia y pagos.
  vigenciaEdit = signal<EdicionVigencia | null>(null);
  pagoEdit = signal<CapturaPago | null>(null);
  pagos = signal<Record<number, Pago[] | 'cargando'>>({});

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
    this.editando.set(true);
  }

  clienteGuardado(c: Cliente<SuscripcionDetalle>): void {
    this.cliente.set(c);
    this.editando.set(false);
  }

  /** Domicilio fiscal en una línea, como en la Constancia. */
  domicilio(f: NonNullable<Cliente['fiscal']>): string {
    const partes = [
      [f.tipo_vialidad, f.nombre_vialidad].filter(Boolean).join(' '),
      f.numero_exterior ? `NO. EXT. ${f.numero_exterior}` : null,
      f.numero_interior ? `NO. INT. ${f.numero_interior}` : null,
      f.colonia ? `COL. ${f.colonia}` : null,
      f.localidad,
      f.municipio,
      f.entidad_federativa,
      f.codigo_postal ? `C.P. ${f.codigo_postal}` : null,
    ];
    return partes.filter(Boolean).join(', ') || '—';
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

  async cambiarWs(s: SuscripcionDetalle, habilitar: boolean): Promise<void> {
    const ok = await Swal.fire({
      icon: 'question',
      title: habilitar ? 'Habilitar WS-CNTPAQi.Net' : 'Deshabilitar WS-CNTPAQi.Net',
      text: `Para ${s.producto_nombre} de este cliente. La configuración de la conexión la captura el cliente dentro de la app.`,
      showCancelButton: true, confirmButtonText: habilitar ? 'Habilitar' : 'Deshabilitar', cancelButtonText: 'Cancelar',
      confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true,
    });
    if (!ok.isConfirmed) { this.cargar(); return; }
    this.ejecutar(s.id, this.service.wsCntpaq(s.id, habilitar), habilitar ? 'WS-CNTPAQi.Net habilitado' : 'WS-CNTPAQi.Net deshabilitado');
  }

  // ── Vigencia y pagos (fase 2) ─────────────────────────────────────────

  claseDias(s: SuscripcionDetalle): string {
    if (s.dias_restantes === null) return 'dias--sin';
    if (s.activa_hasta || s.dias_restantes < 0) return 'dias--critico';
    if (s.aviso?.nivel === 'advertencia' || s.dias_restantes === 0) return 'dias--advertencia';
    if (s.aviso?.nivel === 'info') return 'dias--info';
    return 'dias--ok';
  }

  editarVigencia(s: SuscripcionDetalle): void {
    this.error.set(null);
    this.vigenciaEdit.set({
      s,
      modalidad_pago: s.modalidad_pago ?? 'anual',
      fecha_contratacion: s.fecha_contratacion ?? this.hoy,
      fecha_proximo_pago: s.fecha_proximo_pago ?? '',
      dias_gracia: s.dias_gracia ?? 0,
      suspension_automatica: s.suspension_automatica ?? true,
    });
  }

  async guardarVigencia(): Promise<void> {
    const e = this.vigenciaEdit();
    if (!e || this.guardando()) return;
    if (!e.fecha_proximo_pago) { this.error.set('Indica la fecha de próximo pago.'); return; }

    if (e.suspension_automatica && e.fecha_proximo_pago <= this.hoy && e.s.estatus_almacenado === 'activo') {
      const ok = await Swal.fire({
        icon: 'warning', title: 'Esa fecha ya llegó',
        text: 'Con la suspensión automática encendida, la app se suspenderá en el siguiente corte (a más tardar en una hora). ¿Continuar?',
        showCancelButton: true, confirmButtonText: 'Sí, guardar', cancelButtonText: 'Revisar', confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true,
      });
      if (!ok.isConfirmed) return;
    }

    this.guardando.set(true);
    this.error.set(null);
    this.service.actualizarVigencia(e.s.id, {
      modalidad_pago: e.modalidad_pago, fecha_contratacion: e.fecha_contratacion || null,
      fecha_proximo_pago: e.fecha_proximo_pago, dias_gracia: Number(e.dias_gracia) || 0, suspension_automatica: e.suspension_automatica,
    }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.vigenciaEdit.set(null);
        this.cargar();
        Swal.fire({ icon: 'success', title: 'Vigencia guardada', timer: 1500, showConfirmButton: false });
      },
      error: (err: HttpErrorResponse) => { this.guardando.set(false); this.error.set(mensajeError(err, 'No se pudo guardar la vigencia.')); },
    });
  }

  registrarPago(s: SuscripcionDetalle): void {
    this.error.set(null);
    this.pagoEdit.set({ s, referencia: '', fecha_pago: this.hoy, monto: null, moneda: 'MXN', notas: '' });
  }

  /** Periodo que cubrirá el pago (misma regla que Kernia: sin desbordar fin de mes). */
  periodoPago(e: CapturaPago): string {
    const meses = ({ mensual: 1, trimestral: 3, semestral: 6, anual: 12 } as Record<string, number>)[e.s.modalidad_pago ?? ''] ?? 0;
    if (!e.s.fecha_proximo_pago || !meses) return '—';
    const [y, m, d] = e.s.fecha_proximo_pago.split('-').map(Number);
    const mesFin = m - 1 + meses;
    const ultimoDia = new Date(Date.UTC(y, mesFin + 1, 0)).getUTCDate();
    const fin = new Date(Date.UTC(y, mesFin, Math.min(d, ultimoDia)));
    const f = (x: Date) => x.toISOString().slice(0, 10).split('-').reverse().join('/');
    return `${f(new Date(Date.UTC(y, m - 1, d)))} al ${f(fin)}`;
  }

  guardarPago(): void {
    const e = this.pagoEdit();
    if (!e || this.guardando()) return;
    if (!e.referencia.trim()) { this.error.set('La referencia del pago es obligatoria.'); return; }

    this.guardando.set(true);
    this.error.set(null);
    this.service.registrarPago(e.s.id, {
      referencia: e.referencia.trim(), fecha_pago: e.fecha_pago || null, monto: e.monto, moneda: e.moneda, notas: e.notas || null,
    }).subscribe({
      next: async r => {
        this.guardando.set(false);
        this.pagoEdit.set(null);
        this.cargar();
        const ps = { ...this.pagos() };
        delete ps[e.s.id];
        this.pagos.set(ps);
        const reactivacion = r.reactivada
          ? (r.app_confirmo ? ' La app fue reactivada.' : ' Reactivada en Kernia; Kernia reintentará el aviso a la app.')
          : '';
        await Swal.fire({
          icon: 'success', title: 'Pago registrado',
          text: `Próximo pago: ${r.data.fecha_proximo_pago?.split('-').reverse().join('/')}.${reactivacion}`,
          confirmButtonColor: COLOR_PRIMARIO,
        });
      },
      error: (err: HttpErrorResponse) => { this.guardando.set(false); this.error.set(mensajeError(err, 'No se pudo registrar el pago.')); },
    });
  }

  verPagos(s: SuscripcionDetalle): void {
    const actuales = { ...this.pagos() };
    if (actuales[s.id]) {
      delete actuales[s.id];
      this.pagos.set(actuales);
      return;
    }
    this.pagos.set({ ...actuales, [s.id]: 'cargando' });
    this.service.pagos(s.id).subscribe({
      next: r => this.pagos.set({ ...this.pagos(), [s.id]: r.data }),
      error: () => this.pagos.set({ ...this.pagos(), [s.id]: [] }),
    });
  }

  pagosDe(id: number): Pago[] | 'cargando' | undefined {
    return this.pagos()[id];
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
