import type { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import type { ClientesService } from '../../core/services/clientes.service';
import type { MotivoSalida, SolicitudSalida, SuscripcionDetalle, TipoSalida } from '../../core/models/panel.model';
import { COLOR_PRIMARIO, escapar, mensajeError } from '../clientes/panel-ui';

/**
 * (08-oct-2026) Salida de una app: "Retirar app" (baja lógica y reversible),
 * "Reactivar" y "Finiquitar" (salida definitiva). Todo se solicita y lo
 * autoriza el escalafón; el retiro y el finiquito se aplican a las 00:00.
 * Kernia valida cada regla; aquí solo se presenta.
 */

const fecha = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const TENUE = 'color:#6b7280';
const PELIGRO = '#b91c1c';

const TITULO: Record<TipoSalida, string> = {
  retiro: 'Retirar app',
  reactivacion: 'Reactivar app',
  finiquito: 'Finiquitar',
  archivo: 'Archivar empresa',
};

export function etiquetaTipoSalida(tipo: TipoSalida): string {
  return ({ retiro: 'Retiro de la app', reactivacion: 'Reactivación', finiquito: 'Finiquito', archivo: 'Archivo de empresa' } as Record<string, string>)[tipo] ?? tipo;
}

/** Una línea: «Retiro de la app · se aplica el 09/10/2026 a las 00:00». */
export function resumenSalida(sol: SolicitudSalida): string {
  const cuando = sol.estado === 'programada'
    ? `se aplica el ${fecha(sol.fecha_efectiva)} a las 00:00`
    : sol.tipo === 'reactivacion' ? 'inmediata al autorizarse' : 'a las 00:00 siguientes a la autorización';
  const empresa = sol.empresa_nombre ? ` (${sol.empresa_nombre})` : '';
  return `${etiquetaTipoSalida(sol.tipo)}${empresa} · ${cuando}`;
}

let motivosCache: MotivoSalida[] | null = null;

/** Catálogo de motivos de salida (se pide una vez por sesión). */
export async function motivosSalida(service: ClientesService): Promise<MotivoSalida[]> {
  motivosCache ??= (await firstValueFrom(service.motivosSalida())).data;
  return motivosCache;
}

/** Select de motivo de salida para los diálogos (formulario del asesor, obligatorio). */
export function selectMotivoHtml(motivos: MotivoSalida[], id: string): string {
  return `<label for="${id}" style="display:block;font-weight:600">Motivo de salida del cliente</label>
    <select id="${id}" class="swal2-select" style="margin:6px 0 12px;width:100%">
      <option value="">Elige un motivo…</option>
      ${motivos.map(m => `<option value="${escapar(m.clave)}">${escapar(m.nombre)}</option>`).join('')}
    </select>`;
}

function explicacion(tipo: TipoSalida, s: SuscripcionDetalle): string {
  switch (tipo) {
    case 'retiro':
      return `Nadie del cliente podrá entrar a <b>${escapar(s.producto_nombre)}</b>. Es una baja lógica: la base y la información
        se conservan intactas y la app puede reactivarse con otra autorización. Se aplica a las 00:00 siguientes a la autorización.`;
    case 'reactivacion':
      return `El cliente vuelve a entrar a <b>${escapar(s.producto_nombre)}</b> con su plan y su vigencia actuales en cuanto se autorice.`;
    case 'archivo':
      return 'Se exporta la empresa, se entrega al cliente y después se retira de la app.';
    case 'finiquito':
      return `<b>Salida definitiva de ${escapar(s.producto_nombre)}.</b> A las 00:00 siguientes a la autorización, solo el administrador del cliente
        podrá entrar, y únicamente a «Descargas», durante 15 días. Después pierde el acceso y su respaldo queda en retención 90 días
        antes de eliminarse. <b>No se puede deshacer.</b>`;
  }
}

/** Solicitud de salida. Devuelve true si se registró. */
export async function solicitarSalida(service: ClientesService, s: SuscripcionDetalle, tipo: TipoSalida, slug: string): Promise<boolean> {
  const finiquito = tipo === 'finiquito';
  const conMotivo = tipo !== 'reactivacion';
  let motivos: MotivoSalida[] = [];
  if (conMotivo) {
    try {
      motivos = await motivosSalida(service);
    } catch {
      await Swal.fire({ icon: 'error', title: 'No se pudo cargar la lista de motivos', confirmButtonColor: COLOR_PRIMARIO });
      return false;
    }
  }
  const r = await Swal.fire({
    title: `${TITULO[tipo]}: ${escapar(s.producto_nombre)}`,
    width: 620,
    icon: tipo === 'reactivacion' ? 'question' : 'warning',
    html: `
      <div style="text-align:left">
        <p style="margin:0 0 12px">${explicacion(tipo, s)} La autoriza una persona del escalafón con su usuario y contraseña.</p>
        ${conMotivo ? selectMotivoHtml(motivos, 'sl-motivo-salida') : ''}
        <label for="sl-motivo" style="display:block;font-weight:600">${conMotivo ? 'Detalle' : 'Motivo'} (queda en la bitácora)</label>
        <textarea id="sl-motivo" class="swal2-textarea" style="margin:6px 0 12px;width:100%"
          placeholder="${finiquito ? 'Por ejemplo: cierre de operaciones del cliente' : tipo === 'retiro' ? 'Por ejemplo: el cliente dejará de usar la app' : 'Por ejemplo: el cliente regresa'}"></textarea>
        ${finiquito ? `
        <fieldset style="border:0;padding:0;margin:0 0 12px">
          <legend style="font-weight:600;padding:0">Conformidad del cliente (obligatoria)</legend>
          <label style="margin:6px 12px 6px 0"><input type="radio" name="sl-conf" value="correo" checked> Correo del cliente</label>
          <label style="margin:6px 0"><input type="radio" name="sl-conf" value="documento"> Documento firmado</label>
          <input id="sl-ref" class="swal2-input" style="margin:6px 0 0;width:100%" maxlength="500"
            placeholder="Referencia: fecha, remitente y asunto del correo, o folio del documento">
        </fieldset>
        <label for="sl-slug" style="display:block;font-weight:600">Para confirmar, escribe el identificador del cliente: <code>${escapar(slug)}</code></label>
        <input id="sl-slug" class="swal2-input" autocomplete="off" style="margin:6px 0 0;width:100%">` : ''}
      </div>`,
    showCancelButton: true, confirmButtonText: 'Solicitar', cancelButtonText: 'Cancelar',
    confirmButtonColor: tipo === 'reactivacion' ? COLOR_PRIMARIO : PELIGRO, reverseButtons: true, focusConfirm: false, showLoaderOnConfirm: true,
    preConfirm: async () => {
      const motivo = (document.getElementById('sl-motivo') as HTMLTextAreaElement).value.trim();
      if (!motivo) {
        Swal.showValidationMessage('El motivo es obligatorio.');
        return false;
      }
      const datos: Parameters<ClientesService['solicitarSalida']>[1] = { tipo, motivo };
      if (conMotivo) {
        datos.motivo_salida = (document.getElementById('sl-motivo-salida') as HTMLSelectElement).value;
        if (!datos.motivo_salida) {
          Swal.showValidationMessage('Elige el motivo de salida del cliente.');
          return false;
        }
      }
      if (finiquito) {
        const referencia = (document.getElementById('sl-ref') as HTMLInputElement).value.trim();
        const confirmacion = (document.getElementById('sl-slug') as HTMLInputElement).value.trim();
        if (!referencia) {
          Swal.showValidationMessage('Indica la referencia de la conformidad del cliente.');
          return false;
        }
        if (confirmacion.toLowerCase() !== slug) {
          Swal.showValidationMessage(`Escribe exactamente «${slug}» para confirmar.`);
          return false;
        }
        datos.conformidad_tipo = (document.querySelector('input[name="sl-conf"]:checked') as HTMLInputElement | null)?.value === 'documento' ? 'documento' : 'correo';
        datos.conformidad_referencia = referencia;
        datos.confirmacion_slug = confirmacion;
      }
      try {
        return await firstValueFrom(service.solicitarSalida(s.id, datos));
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

/**
 * Autorizar o rechazar una salida: quien autoriza teclea SU correo y
 * contraseña, aunque la sesión sea de otra persona. Devuelve true si se resolvió.
 */
export async function resolverSalida(service: ClientesService, sol: SolicitudSalida, accion: 'autorizar' | 'rechazar', contexto: string): Promise<boolean> {
  const autorizar = accion === 'autorizar';
  const conformidad = sol.conformidad_referencia
    ? `<div style="${TENUE}">Conformidad del cliente (${sol.conformidad_tipo === 'documento' ? 'documento firmado' : 'correo'}): ${escapar(sol.conformidad_referencia)}</div>`
    : '';
  const r = await Swal.fire({
    title: `${autorizar ? 'Autorizar' : 'Rechazar'}: ${etiquetaTipoSalida(sol.tipo).toLowerCase()}`,
    html: `
      <div style="text-align:left;margin:0 0 12px">
        <div>${escapar(contexto)}</div>
        <div><b>${escapar(resumenSalida(sol))}</b></div>
        <div>${escapar(sol.motivo)}</div>
        ${conformidad}
        <div style="${TENUE}">Solicitó: ${escapar(sol.solicitada_por ?? '—')}</div>
        ${autorizar && sol.tipo === 'finiquito' ? '<div style="margin-top:8px;font-weight:600;color:#b91c1c">El finiquito no se puede deshacer.</div>' : ''}
      </div>
      <p style="margin:0 0 8px;text-align:left">Quien ${autorizar ? 'autoriza' : 'rechaza'} escribe su usuario y contraseña de Kernia.</p>
      <input id="sl-email" class="swal2-input" type="email" autocomplete="off" placeholder="Correo" style="margin:6px 0;width:100%">
      <input id="sl-pass" class="swal2-input" type="password" autocomplete="new-password" placeholder="Contraseña" style="margin:6px 0;width:100%">
      <textarea id="sl-com" class="swal2-textarea" style="margin:6px 0 0;width:100%"
        placeholder="${autorizar ? 'Comentario (opcional)' : 'Motivo del rechazo (obligatorio)'}"></textarea>`,
    icon: autorizar ? 'question' : 'warning',
    showCancelButton: true, confirmButtonText: autorizar ? 'Autorizar' : 'Rechazar', cancelButtonText: 'Cancelar',
    confirmButtonColor: autorizar && sol.tipo === 'reactivacion' ? COLOR_PRIMARIO : PELIGRO, reverseButtons: true, focusConfirm: false,
    allowOutsideClick: false, showLoaderOnConfirm: true,
    preConfirm: async () => {
      const email = (document.getElementById('sl-email') as HTMLInputElement).value.trim();
      const passInput = document.getElementById('sl-pass') as HTMLInputElement;
      const comentario = (document.getElementById('sl-com') as HTMLTextAreaElement).value.trim();
      if (!email || !passInput.value) {
        Swal.showValidationMessage('Escribe el correo y la contraseña de quien resuelve.');
        return false;
      }
      if (!autorizar && !comentario) {
        Swal.showValidationMessage('Indica el motivo del rechazo.');
        return false;
      }
      try {
        return await firstValueFrom(service.resolverSalida(sol.id, { accion, email, password: passInput.value, comentario: comentario || null }));
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
    await Swal.fire({ icon: 'success', title: 'Solicitud rechazada', confirmButtonColor: COLOR_PRIMARIO });
  } else if (res.data.estado === 'fallida') {
    await Swal.fire({ icon: 'error', title: 'No se pudo aplicar', text: res.data.error ?? '', confirmButtonColor: COLOR_PRIMARIO });
  } else {
    await Swal.fire({
      icon: 'success',
      title: res.aplicada ? 'App reactivada' : 'Salida programada',
      text: res.aplicada
        ? 'El cliente vuelve a entrar en menos de un minuto.'
        : `Se aplicará el ${fecha(res.data.fecha_efectiva)} a las 00:00. Hasta entonces el cliente opera normalmente y ve el aviso en su app.`,
      confirmButtonColor: COLOR_PRIMARIO,
    });
  }
  return true;
}

export async function cancelarSalida(service: ClientesService, sol: SolicitudSalida): Promise<boolean> {
  const r = await Swal.fire({
    title: `Cancelar: ${etiquetaTipoSalida(sol.tipo).toLowerCase()}`,
    text: resumenSalida(sol),
    input: 'textarea', inputLabel: 'Motivo (queda en la bitácora)',
    showCancelButton: true, confirmButtonText: 'Cancelar la solicitud', cancelButtonText: 'Volver',
    confirmButtonColor: PELIGRO, reverseButtons: true, showLoaderOnConfirm: true,
    inputValidator: v => (!v?.trim() ? 'El motivo es obligatorio.' : null),
    preConfirm: async (motivo: string) => {
      try {
        return await firstValueFrom(service.cancelarSalida(sol.id, motivo.trim()));
      } catch (err) {
        Swal.showValidationMessage(mensajeError(err as HttpErrorResponse, 'No se pudo cancelar.'));
        return false;
      }
    },
  });
  return r.isConfirmed && !!r.value;
}
