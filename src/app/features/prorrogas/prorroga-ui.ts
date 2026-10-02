import type { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import type { AclService } from '../../core/services/acl.service';
import type { MotivoProrroga, Prorroga, SuscripcionDetalle } from '../../core/models/panel.model';
import { COLOR_PRIMARIO, escapar, mensajeError } from '../clientes/panel-ui';

const fecha = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

export function etiquetaEstadoProrroga(estado: string): string {
  return ({
    solicitada: 'Pendiente',
    autorizada: 'Autorizada',
    rechazada: 'Rechazada',
    vencida: 'Vencida',
    cerrada_por_pago: 'Cerrada por pago',
    cancelada: 'Cancelada',
  } as Record<string, string>)[estado] ?? estado;
}

/**
 * (02-oct-2026) Fase 3: solicitud de prórroga (1 a 6 días, motivo de lista).
 * Devuelve true si se registró.
 */
export async function solicitarProrroga(acl: AclService, s: SuscripcionDetalle, motivos: MotivoProrroga[], maxDias: number): Promise<boolean> {
  const opciones = motivos.map(m => `<option value="${escapar(m.clave)}">${escapar(m.nombre)}</option>`).join('');
  const r = await Swal.fire({
    title: `Solicitar prórroga: ${escapar(s.producto_nombre)}`,
    html: `
      <p style="margin:0 0 12px;text-align:left">El cliente recupera el acceso de forma provisional desde el día en que se autorice.
      La autoriza una persona del escalafón con su usuario y contraseña.</p>
      <label for="pr-dias" style="display:block;text-align:left;font-weight:600">Días (1 a ${maxDias})</label>
      <input id="pr-dias" class="swal2-input" type="number" min="1" max="${maxDias}" value="3" style="margin:6px 0 12px;width:100%">
      <label for="pr-motivo" style="display:block;text-align:left;font-weight:600">Motivo</label>
      <select id="pr-motivo" class="swal2-select" style="margin:6px 0 12px;width:100%">${opciones}</select>
      <label for="pr-detalle" style="display:block;text-align:left;font-weight:600">Detalle</label>
      <textarea id="pr-detalle" class="swal2-textarea" style="margin:6px 0 0;width:100%" placeholder="Obligatorio si el motivo es «Otro»"></textarea>`,
    showCancelButton: true, confirmButtonText: 'Solicitar', cancelButtonText: 'Cancelar',
    confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true, focusConfirm: false,
    showLoaderOnConfirm: true,
    preConfirm: async () => {
      const dias = Number((document.getElementById('pr-dias') as HTMLInputElement).value);
      const motivo = (document.getElementById('pr-motivo') as HTMLSelectElement).value;
      const detalle = (document.getElementById('pr-detalle') as HTMLTextAreaElement).value.trim();
      if (!Number.isInteger(dias) || dias < 1 || dias > maxDias) {
        Swal.showValidationMessage(`Indica de 1 a ${maxDias} días.`);
        return false;
      }
      if (motivo === 'otro' && !detalle) {
        Swal.showValidationMessage('Describe el motivo en el detalle.');
        return false;
      }
      try {
        return await firstValueFrom(acl.solicitar(s.id, { dias, motivo, detalle: detalle || null }));
      } catch (err) {
        Swal.showValidationMessage(mensajeError(err as HttpErrorResponse, 'No se pudo registrar la solicitud.'));
        return false;
      }
    },
  });
  if (!r.isConfirmed) return false;

  await Swal.fire({ icon: 'success', title: 'Solicitud registrada', text: 'Queda pendiente de autorización en «Prórrogas».', confirmButtonColor: COLOR_PRIMARIO });
  return true;
}

/**
 * Autorizar o rechazar: quien autoriza teclea SU correo y contraseña, aunque
 * la sesión sea de otra persona. La contraseña solo viaja a Kernia para
 * verificarla; no se guarda. Devuelve true si se resolvió.
 */
export async function resolverProrroga(acl: AclService, p: Prorroga, accion: 'autorizar' | 'rechazar', contexto: string): Promise<boolean> {
  const autorizar = accion === 'autorizar';
  const r = await Swal.fire({
    title: autorizar ? 'Autorizar prórroga' : 'Rechazar prórroga',
    html: `
      <div style="text-align:left;margin:0 0 12px">
        <div>${escapar(contexto)}</div>
        <div><b>${p.dias} día${p.dias === 1 ? '' : 's'}</b> · ${escapar(p.motivo_nombre)}${p.detalle ? ` — ${escapar(p.detalle)}` : ''}</div>
        <div style="color:#6b7280">Solicitó: ${escapar(p.solicitada_por ?? '—')} · Vencimiento del ${fecha(p.fecha_vencimiento)}</div>
      </div>
      <p style="margin:0 0 8px;text-align:left">Quien ${autorizar ? 'autoriza' : 'rechaza'} escribe su usuario y contraseña de Kernia.</p>
      <input id="pr-email" class="swal2-input" type="email" autocomplete="off" placeholder="Correo" style="margin:6px 0;width:100%">
      <input id="pr-pass" class="swal2-input" type="password" autocomplete="new-password" placeholder="Contraseña" style="margin:6px 0;width:100%">
      <textarea id="pr-com" class="swal2-textarea" style="margin:6px 0 0;width:100%"
        placeholder="${autorizar ? 'Comentario (opcional)' : 'Motivo del rechazo (obligatorio)'}"></textarea>`,
    icon: autorizar ? 'question' : 'warning',
    showCancelButton: true, confirmButtonText: autorizar ? 'Autorizar' : 'Rechazar', cancelButtonText: 'Cancelar',
    confirmButtonColor: autorizar ? COLOR_PRIMARIO : '#b91c1c', reverseButtons: true, focusConfirm: false,
    allowOutsideClick: false,
    showLoaderOnConfirm: true,
    preConfirm: async () => {
      const email = (document.getElementById('pr-email') as HTMLInputElement).value.trim();
      const passInput = document.getElementById('pr-pass') as HTMLInputElement;
      const comentario = (document.getElementById('pr-com') as HTMLTextAreaElement).value.trim();
      if (!email || !passInput.value) {
        Swal.showValidationMessage('Escribe el correo y la contraseña de quien resuelve.');
        return false;
      }
      if (!autorizar && !comentario) {
        Swal.showValidationMessage('Indica el motivo del rechazo.');
        return false;
      }
      try {
        return await firstValueFrom(acl.resolver(p.id, { accion, email, password: passInput.value, comentario: comentario || null }));
      } catch (err) {
        passInput.value = '';
        Swal.showValidationMessage(mensajeError(err as HttpErrorResponse, 'No se pudo resolver la solicitud.'));
        return false;
      }
    },
  });
  if (!r.isConfirmed || !r.value) return false;

  const res = r.value;
  await Swal.fire(autorizar
    ? {
        icon: res.app_confirmo ? 'success' : 'warning',
        title: 'Prórroga autorizada',
        text: `Acceso provisional hasta el ${fecha(res.data.hasta)}.` +
          (res.app_confirmo ? ' La app confirmó la reactivación.' : ' La app no confirmó todavía; Kernia reintentará el aviso cada minuto.'),
        confirmButtonColor: COLOR_PRIMARIO,
      }
    : { icon: 'success', title: 'Solicitud rechazada', timer: 1800, showConfirmButton: false });
  return true;
}
