import type { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import type { ClientesService } from '../../core/services/clientes.service';
import type { SolicitudRespaldoResumen, TipoSolicitudRespaldo } from '../../core/models/panel.model';
import { COLOR_PRIMARIO, escapar, mensajeError } from '../clientes/panel-ui';

/**
 * (09-oct-2026) Soporte sobre un respaldo, con autorización del escalafón
 * (estándar v2.3 §4.3 y §7): reenviar la contraseña al administrador del
 * cliente o entregar el 7z cifrado a soporte. Kernia valida cada regla.
 */

const TENUE = 'color:#6b7280';

export function etiquetaTipoRespaldo(tipo: TipoSolicitudRespaldo): string {
  return tipo === 'reenvio_clave' ? 'Reenvío de la contraseña' : 'Entrega del respaldo a soporte';
}

const EXPLICACION: Record<TipoSolicitudRespaldo, string> = {
  reenvio_clave: 'Al autorizarse, Kernia envía la contraseña del respaldo <b>al correo del administrador del cliente</b>. Nadie la ve en pantalla.',
  entrega_soporte: 'Al autorizarse, <b>solo tú</b> podrás descargar el archivo cifrado, <b>una vez y dentro de 24 horas</b>. Soporte no puede abrirlo: la contraseña solo la tiene el cliente.',
};

export async function solicitarRespaldo(service: ClientesService, exportacionId: number, tipo: TipoSolicitudRespaldo): Promise<boolean> {
  const r = await Swal.fire({
    title: etiquetaTipoRespaldo(tipo),
    html: `<p style="margin:0 0 8px;text-align:left">${EXPLICACION[tipo]} La autoriza una persona del escalafón.</p>`,
    input: 'textarea', inputLabel: 'Motivo (queda en la bitácora)',
    inputPlaceholder: tipo === 'reenvio_clave' ? 'Por ejemplo: el cliente borró el correo con la contraseña' : 'Por ejemplo: el cliente perdió su archivo',
    showCancelButton: true, confirmButtonText: 'Solicitar', cancelButtonText: 'Cancelar',
    confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true, showLoaderOnConfirm: true,
    inputValidator: v => (!v?.trim() ? 'El motivo es obligatorio.' : null),
    preConfirm: async (motivo: string) => {
      try {
        return await firstValueFrom(service.solicitarRespaldo(exportacionId, tipo, motivo.trim()));
      } catch (err) {
        Swal.showValidationMessage(mensajeError(err as HttpErrorResponse, 'No se pudo registrar la solicitud.'));
        return false;
      }
    },
  });
  if (!r.isConfirmed || !r.value) return false;
  await Swal.fire({ icon: 'success', title: 'Solicitud registrada', text: 'Queda pendiente de autorización en «Autorizaciones».', confirmButtonColor: COLOR_PRIMARIO });
  return true;
}

/** Autorizar o rechazar: quien autoriza teclea SU correo y contraseña. */
export async function resolverRespaldo(service: ClientesService, sol: SolicitudRespaldoResumen, accion: 'autorizar' | 'rechazar', contexto: string): Promise<boolean> {
  const autorizar = accion === 'autorizar';
  const r = await Swal.fire({
    title: `${autorizar ? 'Autorizar' : 'Rechazar'}: ${etiquetaTipoRespaldo(sol.tipo).toLowerCase()}`,
    html: `
      <div style="text-align:left;margin:0 0 12px">
        <div>${escapar(contexto)}</div>
        <div>${escapar(sol.motivo)}</div>
        <div style="${TENUE}">Solicitó: ${escapar(sol.solicitada_por ?? '—')}</div>
      </div>
      <p style="margin:0 0 8px;text-align:left">Quien ${autorizar ? 'autoriza' : 'rechaza'} escribe su usuario y contraseña de Kernia.</p>
      <input id="rs-email" class="swal2-input" type="email" autocomplete="off" placeholder="Correo" style="margin:6px 0;width:100%">
      <input id="rs-pass" class="swal2-input" type="password" autocomplete="new-password" placeholder="Contraseña" style="margin:6px 0;width:100%">
      <textarea id="rs-com" class="swal2-textarea" style="margin:6px 0 0;width:100%"
        placeholder="${autorizar ? 'Comentario (opcional)' : 'Motivo del rechazo (obligatorio)'}"></textarea>`,
    icon: autorizar ? 'question' : 'warning',
    showCancelButton: true, confirmButtonText: autorizar ? 'Autorizar' : 'Rechazar', cancelButtonText: 'Cancelar',
    confirmButtonColor: autorizar ? COLOR_PRIMARIO : '#b91c1c', reverseButtons: true, focusConfirm: false,
    allowOutsideClick: false, showLoaderOnConfirm: true,
    preConfirm: async () => {
      const email = (document.getElementById('rs-email') as HTMLInputElement).value.trim();
      const pass = document.getElementById('rs-pass') as HTMLInputElement;
      const comentario = (document.getElementById('rs-com') as HTMLTextAreaElement).value.trim();
      if (!email || !pass.value) {
        Swal.showValidationMessage('Escribe el correo y la contraseña de quien resuelve.');
        return false;
      }
      if (!autorizar && !comentario) {
        Swal.showValidationMessage('Indica el motivo del rechazo.');
        return false;
      }
      try {
        return await firstValueFrom(service.resolverRespaldo(sol.id, { accion, email, password: pass.value, comentario: comentario || null }));
      } catch (err) {
        pass.value = '';
        Swal.showValidationMessage(mensajeError(err as HttpErrorResponse, 'No se pudo resolver la solicitud.'));
        return false;
      }
    },
  });
  if (!r.isConfirmed || !r.value) return false;

  const estado = r.value.data.estado;
  await Swal.fire({
    icon: 'success',
    title: !autorizar ? 'Solicitud rechazada' : estado === 'aplicada' ? 'Contraseña reenviada' : 'Entrega autorizada',
    text: !autorizar ? '' : estado === 'aplicada'
      ? 'El administrador del cliente la recibe en su correo.'
      : `${sol.solicitada_por ?? 'Quien lo pidió'} puede descargar el archivo una vez, en las próximas 24 horas, desde la tarjeta del cliente.`,
    confirmButtonColor: COLOR_PRIMARIO,
  });
  return true;
}

/** Descarga del 7z (solo quien lo pidió, una vez). El navegador lo guarda; Kernia no lo conserva. */
export async function descargarRespaldo(service: ClientesService, sol: SolicitudRespaldoResumen): Promise<boolean> {
  const r = await Swal.fire({
    icon: 'warning',
    title: 'Descargar respaldo cifrado',
    text: 'Solo se puede descargar una vez. Guárdalo y entrégalo al cliente; él tiene la contraseña.',
    showCancelButton: true, confirmButtonText: 'Descargar', cancelButtonText: 'Cancelar',
    confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true,
  });
  if (!r.isConfirmed) return false;

  try {
    const res = await firstValueFrom(service.descargarRespaldo(sol.id));
    const nombre = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'respaldo.7z';
    const huella = res.headers.get('X-Huella-SHA256');
    const url = URL.createObjectURL(res.body!);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
    await Swal.fire({
      icon: 'success', title: 'Descarga iniciada', confirmButtonColor: COLOR_PRIMARIO,
      html: huella ? `<p style="margin:0">Huella SHA-256 para comprobar el archivo:</p><code style="word-break:break-all">${escapar(huella)}</code>` : '',
    });
    return true;
  } catch (err) {
    // Con responseType blob, el mensaje de error de Kernia viene como Blob.
    const e = err as HttpErrorResponse;
    let mensaje = 'No se pudo descargar.';
    if (e.error instanceof Blob) {
      try { mensaje = JSON.parse(await e.error.text()).message ?? mensaje; } catch { /* sin cuerpo legible */ }
    }
    await Swal.fire({ icon: 'error', title: 'No se pudo descargar', text: mensaje, confirmButtonColor: COLOR_PRIMARIO });
    return false;
  }
}
