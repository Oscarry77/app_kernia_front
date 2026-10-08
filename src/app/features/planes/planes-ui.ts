import type { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import type { ClientesService } from '../../core/services/clientes.service';
import type { ProductoCatalogo, ResumenPagos, SolicitudPlan, SuscripcionDetalle, VistaPreviaPlan } from '../../core/models/panel.model';
import { COLOR_PRIMARIO, escapar, etiquetaLimite, mensajeError } from '../clientes/panel-ui';
import { motivosSalida, selectMotivoHtml } from '../salidas/salidas-ui';
import type { MotivoSalida } from '../../core/models/panel.model';

/**
 * (05-oct-2026) Planes para los operadores: la ficha comparativa de cada
 * producto y el cambio de plan por solicitud con autorización del escalafón
 * (subir y bajar). Kernia valida cada regla; aquí solo se presenta.
 */

const fecha = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const TENUE = 'color:#6b7280';

export function etiquetaEstadoCambio(estado: string): string {
  return ({
    solicitada: 'Pendiente de autorización',
    programada: 'Programado',
    aplicada: 'Aplicado',
    rechazada: 'Rechazado',
    cancelada: 'Cancelado',
    fallida: 'Falló',
  } as Record<string, string>)[estado] ?? estado;
}

export function valorLimite(v: number | null | undefined): string {
  return v === null || v === undefined ? 'Sin límite' : String(v);
}

/** Claves de límite que aparecen en algún plan del producto, en orden fijo. */
export function clavesLimite(p: ProductoCatalogo): string[] {
  const todas = new Set(p.planes.flatMap(pl => Object.keys(pl.limites ?? {})));
  return ['max_empresas', 'max_empleados', 'max_usuarios'].filter(k => todas.has(k));
}

export function nombreModulo(p: ProductoCatalogo, clave: string): string {
  return p.modulos.find(m => m.clave === clave)?.nombre ?? clave;
}

/** Tabla comparativa de los planes de un producto (HTML para SweetAlert). */
export function fichaPlanesHtml(p: ProductoCatalogo, planActual?: string | null): string {
  const celda = 'padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center';
  const primera = 'padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:left;font-weight:600';
  const actual = (codigo: string) => (codigo === planActual ? ';background:#fdf3ea' : '');

  const encabezado = p.planes.map(pl =>
    `<th style="${celda}${actual(pl.codigo)}">${escapar(pl.nombre)}${pl.codigo === planActual ? `<div style="font-weight:400;font-size:12px;color:${COLOR_PRIMARIO}">Plan actual</div>` : ''}</th>`).join('');

  const filas: string[] = [];
  if (p.planes.some(pl => pl.descripcion)) {
    filas.push(`<tr><td style="${primera}">Descripción</td>${p.planes.map(pl =>
      `<td style="${celda};font-size:13px${actual(pl.codigo)}">${escapar(pl.descripcion ?? '—')}</td>`).join('')}</tr>`);
  }
  for (const m of p.modulos) {
    filas.push(`<tr><td style="${primera}">${escapar(m.nombre)}${m.requiere?.length ? `<div style="font-weight:400;font-size:12px;${TENUE}">Requiere ${escapar(m.requiere.map(r => nombreModulo(p, r)).join(', '))}</div>` : ''}</td>${p.planes.map(pl =>
      `<td style="${celda}${actual(pl.codigo)}">${(pl.modulos ?? []).includes(m.clave) ? '✓' : '—'}</td>`).join('')}</tr>`);
  }
  for (const k of clavesLimite(p)) {
    filas.push(`<tr><td style="${primera}">${escapar(etiquetaLimite(k))}</td>${p.planes.map(pl =>
      `<td style="${celda}${actual(pl.codigo)}">${escapar(valorLimite(pl.limites?.[k]))}</td>`).join('')}</tr>`);
  }

  const extras = p.extras.length
    ? `<p style="margin:12px 0 0;text-align:left"><b>Extras</b> (se suman al plan): ${p.extras.map(e =>
        `${escapar(e.nombre)} (+${e.incremento} ${escapar(etiquetaLimite(e.limite).toLowerCase())} por unidad)`).join(' · ')}</p>`
    : '';

  return `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr><th style="${primera}"></th>${encabezado}</tr></thead><tbody>${filas.join('')}</tbody></table></div>${extras}`;
}

export async function mostrarFichaPlanes(p: ProductoCatalogo, planActual?: string | null): Promise<void> {
  await Swal.fire({
    title: `Planes de ${escapar(p.nombre)}`,
    html: fichaPlanesHtml(p, planActual),
    width: 760,
    confirmButtonText: 'Cerrar',
    confirmButtonColor: COLOR_PRIMARIO,
  });
}

/** Qué cambia con el plan nuevo, en palabras del operador. */
function vistaPreviaHtml(p: ProductoCatalogo, v: VistaPreviaPlan): string {
  const bajada = v.direccion === 'bajada';
  const lineas: string[] = [
    `<div style="font-weight:600;color:${bajada ? '#b45309' : '#047857'}">${bajada ? 'Baja de plan' : 'Sube de plan'}: ${escapar(v.plan_actual_nombre ?? 'sin plan')} → ${escapar(v.plan_nuevo_nombre)}</div>`,
  ];
  if (v.modulos_gana.length) {
    lineas.push(`<div>Gana: <b>${escapar(v.modulos_gana.map(m => nombreModulo(p, m)).join(', '))}</b></div>`);
  }
  if (v.modulos_pierde.length) {
    lineas.push(`<div>Pierde: <b>${escapar(v.modulos_pierde.map(m => nombreModulo(p, m)).join(', '))}</b> <span style="${TENUE}">(sus datos se conservan, ocultos)</span></div>`);
  }
  const claves = Array.from(new Set([...Object.keys(v.limites_antes), ...Object.keys(v.limites_despues)]));
  for (const k of claves) {
    const antes = v.limites_antes[k];
    const despues = v.limites_despues[k];
    if (antes === despues) continue;
    lineas.push(`<div>${escapar(etiquetaLimite(k))}: ${escapar(valorLimite(antes))} → <b>${escapar(valorLimite(despues))}</b></div>`);
  }
  if (v.limites_reducidos.includes('max_empresas')) {
    lineas.push(`<div style="${TENUE};margin-top:4px">Si hoy usa más empresas que el nuevo límite, seguirán operando pero no podrá crear nuevas.
      (La selección de empresas que se conservan llegará con el estándar v2.2.)</div>`);
  }
  return lineas.join('');
}

/**
 * Solicitud de cambio de plan con vista previa de lo que cambia. Una subida
 * se aplica al autorizarse; una bajada, en la renovación o de inmediato.
 * Devuelve true si se registró.
 */
export async function solicitarCambioPlan(service: ClientesService, s: SuscripcionDetalle, p: ProductoCatalogo): Promise<boolean> {
  const opciones = p.planes.filter(pl => pl.codigo !== s.plan)
    .map(pl => `<option value="${escapar(pl.codigo)}">${escapar(pl.nombre)}</option>`).join('');
  if (!opciones) {
    await Swal.fire({ icon: 'info', title: 'No hay otro plan disponible', confirmButtonColor: COLOR_PRIMARIO });
    return false;
  }
  let vista: VistaPreviaPlan | null = null;
  // (08-oct-2026) Una baja pide el motivo de salida (formulario del asesor).
  let motivos: MotivoSalida[] = [];
  try {
    motivos = await motivosSalida(service);
  } catch {
    motivos = [];
  }

  const r = await Swal.fire({
    title: `Cambiar plan: ${escapar(s.producto_nombre)}`,
    width: 620,
    html: `
      <div style="text-align:left">
        <p style="margin:0 0 10px">Plan actual: <b>${escapar(s.plan_nombre ?? 'sin plan')}</b>.
          El cambio lo autoriza una persona del escalafón con su usuario y contraseña.
          <a href="#" id="cp-ficha" style="color:${COLOR_PRIMARIO}">Ver todos los planes</a></p>
        <label for="cp-plan" style="display:block;font-weight:600">Plan nuevo</label>
        <select id="cp-plan" class="swal2-select" style="margin:6px 0 12px;width:100%"><option value="">Elige un plan…</option>${opciones}</select>
        <div id="cp-vista" style="margin:0 0 12px;padding:10px;border-radius:8px;background:#f9fafb;display:none"></div>
        <fieldset id="cp-aplicacion" style="display:none;border:0;padding:0;margin:0 0 12px">
          <legend style="font-weight:600;padding:0">¿Cuándo se aplica la baja?</legend>
          <label style="display:block;margin:6px 0"><input type="radio" name="cp-ap" value="renovacion" checked>
            En la renovación <span id="cp-fecha" style="${TENUE}"></span></label>
          <label style="display:block;margin:6px 0"><input type="radio" name="cp-ap" value="inmediata"> En el siguiente corte (00:00 de mañana)</label>
          <div style="${TENUE};font-size:13px">Una baja siempre se aplica a las 00:00. El cliente ve un aviso en su app desde que se autoriza.</div>
          <div style="margin-top:10px">${selectMotivoHtml(motivos, 'cp-motivo-salida')}</div>
        </fieldset>
        <label for="cp-motivo" style="display:block;font-weight:600">Motivo (queda en la bitácora)</label>
        <textarea id="cp-motivo" class="swal2-textarea" style="margin:6px 0 0;width:100%" placeholder="Por ejemplo: el cliente contrató Tesorería"></textarea>
      </div>`,
    showCancelButton: true, confirmButtonText: 'Solicitar', cancelButtonText: 'Cancelar',
    confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true, focusConfirm: false, showLoaderOnConfirm: true,
    didOpen: () => {
      const select = document.getElementById('cp-plan') as HTMLSelectElement;
      const caja = document.getElementById('cp-vista') as HTMLDivElement;
      const aplicacion = document.getElementById('cp-aplicacion') as HTMLFieldSetElement;
      document.getElementById('cp-ficha')?.addEventListener('click', e => {
        e.preventDefault();
        caja.style.display = 'block';
        caja.innerHTML = fichaPlanesHtml(p, s.plan);
      });
      select.addEventListener('change', async () => {
        vista = null;
        aplicacion.style.display = 'none';
        if (!select.value) { caja.style.display = 'none'; return; }
        caja.style.display = 'block';
        caja.textContent = 'Calculando qué cambia…';
        try {
          const res = await firstValueFrom(service.vistaPreviaPlan(s.id, select.value));
          if (select.value !== res.data.plan_nuevo) return; // cambió mientras se calculaba
          vista = res.data;
          caja.innerHTML = vistaPreviaHtml(p, vista);
          if (vista.direccion === 'bajada') {
            aplicacion.style.display = 'block';
            const renovacion = aplicacion.querySelector<HTMLInputElement>('input[value="renovacion"]')!;
            const etiqueta = document.getElementById('cp-fecha')!;
            renovacion.disabled = !vista.fecha_proximo_pago;
            etiqueta.textContent = vista.fecha_proximo_pago ? `(${fecha(vista.fecha_proximo_pago)})` : '(no tiene fecha de próximo pago)';
            if (!vista.fecha_proximo_pago) aplicacion.querySelector<HTMLInputElement>('input[value="inmediata"]')!.checked = true;
          }
        } catch (err) {
          caja.textContent = mensajeError(err as HttpErrorResponse, 'No se pudo calcular el cambio.');
        }
      });
    },
    preConfirm: async () => {
      const motivo = (document.getElementById('cp-motivo') as HTMLTextAreaElement).value.trim();
      if (!vista) {
        Swal.showValidationMessage('Elige el plan nuevo y espera la vista previa.');
        return false;
      }
      if (!motivo) {
        Swal.showValidationMessage('El motivo es obligatorio.');
        return false;
      }
      const aplicacion = (document.querySelector('input[name="cp-ap"]:checked') as HTMLInputElement | null)?.value === 'inmediata'
        ? 'inmediata' : 'renovacion';
      const motivoSalida = vista.direccion === 'bajada' ? (document.getElementById('cp-motivo-salida') as HTMLSelectElement).value : '';
      if (vista.direccion === 'bajada' && !motivoSalida) {
        Swal.showValidationMessage('Elige el motivo de la baja de plan.');
        return false;
      }
      try {
        return await firstValueFrom(service.solicitarCambioPlan(s.id, { plan: vista.plan_nuevo, aplicacion, motivo, ...(motivoSalida ? { motivo_salida: motivoSalida } : {}) }));
      } catch (err) {
        Swal.showValidationMessage(mensajeError(err as HttpErrorResponse, 'No se pudo registrar la solicitud.'));
        return false;
      }
    },
  });
  if (!r.isConfirmed) return false;

  await Swal.fire({ icon: 'success', title: 'Solicitud registrada', text: 'Queda pendiente de autorización en «Autorizaciones».', confirmButtonColor: COLOR_PRIMARIO });
  return true;
}

/** Una línea con lo que pide la solicitud: «Corporativo → Básico · baja en la renovación». */
export function resumenSolicitud(sol: SolicitudPlan): string {
  const cuando = sol.direccion === 'subida' ? 'inmediata'
    : sol.estado === 'programada' ? `se aplica el ${fecha(sol.fecha_efectiva)}`
    : sol.aplicacion === 'renovacion' ? 'en la renovación' : 'en el siguiente corte (00:00)';
  return `${sol.plan_actual_nombre ?? 'Sin plan'} → ${sol.plan_nuevo_nombre ?? sol.plan_nuevo} · ${sol.direccion === 'subida' ? 'subida' : 'baja'} ${cuando}`;
}

function pagosHtml(pg: ResumenPagos): string {
  return `<div style="${TENUE}">Pagos: ${pg.pagos_registrados} registrado(s)` +
    (pg.ultimo_pago ? ` · último el ${fecha(pg.ultimo_pago.fecha)} (cubre hasta ${fecha(pg.ultimo_pago.periodo_hasta)})` : '') +
    ` · próximo pago ${fecha(pg.fecha_proximo_pago)}${pg.modalidad_pago ? ` (${escapar(pg.modalidad_pago)})` : ''}</div>`;
}

/**
 * Autorizar o rechazar un cambio de plan: quien autoriza teclea SU correo y
 * contraseña, aunque la sesión sea de otra persona. Devuelve true si se resolvió.
 */
export async function resolverCambioPlan(service: ClientesService, sol: SolicitudPlan, accion: 'autorizar' | 'rechazar', contexto: string): Promise<boolean> {
  const autorizar = accion === 'autorizar';
  const r = await Swal.fire({
    title: autorizar ? 'Autorizar cambio de plan' : 'Rechazar cambio de plan',
    html: `
      <div style="text-align:left;margin:0 0 12px">
        <div>${escapar(contexto)}</div>
        <div><b>${escapar(resumenSolicitud(sol))}</b></div>
        <div>${escapar(sol.motivo)}</div>
        <div style="${TENUE}">Solicitó: ${escapar(sol.solicitada_por ?? '—')}</div>
        ${sol.pagos ? pagosHtml(sol.pagos) : ''}
      </div>
      <p style="margin:0 0 8px;text-align:left">Quien ${autorizar ? 'autoriza' : 'rechaza'} escribe su usuario y contraseña de Kernia.</p>
      <input id="cp-email" class="swal2-input" type="email" autocomplete="off" placeholder="Correo" style="margin:6px 0;width:100%">
      <input id="cp-pass" class="swal2-input" type="password" autocomplete="new-password" placeholder="Contraseña" style="margin:6px 0;width:100%">
      <textarea id="cp-com" class="swal2-textarea" style="margin:6px 0 0;width:100%"
        placeholder="${autorizar ? 'Comentario (opcional)' : 'Motivo del rechazo (obligatorio)'}"></textarea>`,
    icon: autorizar ? 'question' : 'warning',
    showCancelButton: true, confirmButtonText: autorizar ? 'Autorizar' : 'Rechazar', cancelButtonText: 'Cancelar',
    confirmButtonColor: autorizar ? COLOR_PRIMARIO : '#b91c1c', reverseButtons: true, focusConfirm: false,
    allowOutsideClick: false, showLoaderOnConfirm: true,
    preConfirm: async () => {
      const email = (document.getElementById('cp-email') as HTMLInputElement).value.trim();
      const passInput = document.getElementById('cp-pass') as HTMLInputElement;
      const comentario = (document.getElementById('cp-com') as HTMLTextAreaElement).value.trim();
      if (!email || !passInput.value) {
        Swal.showValidationMessage('Escribe el correo y la contraseña de quien resuelve.');
        return false;
      }
      if (!autorizar && !comentario) {
        Swal.showValidationMessage('Indica el motivo del rechazo.');
        return false;
      }
      try {
        return await firstValueFrom(service.resolverCambioPlan(sol.id, { accion, email, password: passInput.value, comentario: comentario || null }));
      } catch (err) {
        passInput.value = '';
        Swal.showValidationMessage(mensajeError(err as HttpErrorResponse, 'No se pudo resolver la solicitud.'));
        return false;
      }
    },
  });
  if (!r.isConfirmed || !r.value) return false;

  const res = r.value;
  if (!autorizar) {
    await Swal.fire({ icon: 'success', title: 'Solicitud rechazada', html: res.pagos ? pagosHtml(res.pagos) : '', confirmButtonColor: COLOR_PRIMARIO });
  } else if (res.data.estado === 'fallida') {
    await Swal.fire({ icon: 'error', title: 'No se pudo aplicar', text: res.data.error ?? '', confirmButtonColor: COLOR_PRIMARIO });
  } else {
    await Swal.fire({
      icon: 'success',
      title: res.aplicada ? 'Plan cambiado' : 'Cambio programado',
      text: res.aplicada
        ? `El cliente ya tiene ${res.data.plan_nuevo_nombre}. Su app lo recibe en menos de un minuto.`
        : `Se aplicará el ${fecha(res.data.fecha_efectiva)} a las 00:00. Desde hoy el cliente ve el aviso en su app.`,
      confirmButtonColor: COLOR_PRIMARIO,
    });
  }
  return true;
}

export async function cancelarCambioPlan(service: ClientesService, sol: SolicitudPlan): Promise<boolean> {
  const r = await Swal.fire({
    title: 'Cancelar cambio de plan',
    text: resumenSolicitud(sol),
    input: 'textarea', inputLabel: 'Motivo (queda en la bitácora)',
    showCancelButton: true, confirmButtonText: 'Cancelar el cambio', cancelButtonText: 'Volver',
    confirmButtonColor: '#b91c1c', reverseButtons: true, showLoaderOnConfirm: true,
    inputValidator: v => (!v?.trim() ? 'El motivo es obligatorio.' : null),
    preConfirm: async (motivo: string) => {
      try {
        return await firstValueFrom(service.cancelarCambioPlan(sol.id, motivo.trim()));
      } catch (err) {
        Swal.showValidationMessage(mensajeError(err as HttpErrorResponse, 'No se pudo cancelar.'));
        return false;
      }
    },
  });
  return r.isConfirmed && !!r.value;
}
