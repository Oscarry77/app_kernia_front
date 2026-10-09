import type { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import type { ClientesService } from '../../core/services/clientes.service';
import type { EmpresaApp, ListaEmpresas, SolicitudPlan, SuscripcionDetalle } from '../../core/models/panel.model';
import { motivosSalida, selectMotivoHtml } from '../salidas/salidas-ui';
import { COLOR_PRIMARIO, escapar, mensajeError } from '../clientes/panel-ui';

/**
 * (09-oct-2026) Empresas del cliente en una app v2.2 (la lista la entrega la
 * app en vivo): elegir cuáles conserva en una baja de plan y desbloquear las
 * bloqueadas por el plan. Kernia valida cada regla y audita la licencia.
 */

const TENUE = 'color:#6b7280';

export function etiquetaEstadoEmpresa(estado: string): string {
  return ({ activa: 'Activa', inactiva: 'Inactiva', bloqueada_plan: 'Bloqueada por plan', archivada: 'Archivada' } as Record<string, string>)[estado] ?? estado;
}

const conservable = (e: EmpresaApp) => e.estado === 'activa' || e.estado === 'inactiva';

/**
 * Bloque para elegir las empresas que conserva el cliente. `max` es el límite
 * del plan nuevo; `marcadas` las ya elegidas (null = aún no decide).
 */
export function seleccionEmpresasHtml(lista: ListaEmpresas, max: number | null, marcadas: number[] | null): string {
  const opciones = lista.data.filter(conservable);
  const cuentan = lista.cuentan_para_limite;
  if (max === null || cuentan <= max) {
    return `<div style="${TENUE}">Sus ${cuentan} empresa(s) caben en el plan nuevo: no se bloqueará ninguna y el cambio se aplica sin cortar el servicio.</div>`;
  }
  const filas = opciones.map(e => `
    <label style="display:flex;gap:8px;align-items:center;margin:4px 0">
      <input type="checkbox" name="emp-conservar" value="${e.id}" ${marcadas?.includes(e.id) ? 'checked' : ''}>
      <span>${escapar(e.nombre)} <span style="${TENUE}">${escapar(e.rfc ?? '')} · ${escapar(etiquetaEstadoEmpresa(e.estado))}</span></span>
    </label>`).join('');

  return `
    <div style="font-weight:600;margin-bottom:4px">Empresas que conserva el cliente</div>
    <div style="${TENUE};font-size:13px;margin-bottom:6px">Hoy usa <b>${cuentan}</b>; el plan nuevo permite <b>${max}</b>.
      Las que no se elijan quedan <b>bloqueadas por el plan</b> (datos intactos; se recuperan subiendo de plan).</div>
    <label style="display:block;margin:4px 0"><input type="radio" name="emp-modo" value="lista" ${marcadas !== null ? 'checked' : ''}> El cliente ya eligió:</label>
    <div id="emp-lista" style="margin:0 0 6px 22px">${filas}<div id="emp-cuenta" style="${TENUE};font-size:13px"></div></div>
    <label style="display:block;margin:4px 0"><input type="radio" name="emp-modo" value="pendiente" ${marcadas === null ? 'checked' : ''}>
      El cliente aún no decide <span style="${TENUE}">(si llega la fecha sin lista, se bloquean todas hasta que se capture)</span></label>`;
}

/** Conecta el contador del bloque; llamar en didOpen. */
export function activarSeleccion(max: number | null): void {
  const cuenta = document.getElementById('emp-cuenta');
  if (!cuenta || max === null) return;
  const actualizar = () => {
    const n = document.querySelectorAll<HTMLInputElement>('input[name="emp-conservar"]:checked').length;
    cuenta.textContent = `${n} de ${max} elegidas`;
    cuenta.style.color = n > max ? '#b91c1c' : '';
    if (n > 0) document.querySelector<HTMLInputElement>('input[name="emp-modo"][value="lista"]')!.checked = true;
  };
  document.querySelectorAll('input[name="emp-conservar"]').forEach(i => i.addEventListener('change', actualizar));
  actualizar();
}

/**
 * Lee la elección: `undefined` si el bloque no aplica (todas caben), `null` si
 * el cliente aún no decide, o la lista. Devuelve un string con el error si no es válida.
 */
export function leerSeleccion(max: number | null): number[] | null | undefined | string {
  const modo = document.querySelector<HTMLInputElement>('input[name="emp-modo"]:checked')?.value;
  if (!modo) return undefined;
  if (modo === 'pendiente') return null;
  const ids = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="emp-conservar"]:checked')).map(i => Number(i.value));
  if (!ids.length) return 'Elige al menos una empresa, o marca que el cliente aún no decide.';
  if (max !== null && ids.length > max) return `Elegiste ${ids.length} empresas; el plan nuevo permite ${max}.`;
  return ids;
}

/** Captura o corrige la lista de una baja ya solicitada. */
export async function capturarEmpresasPlan(service: ClientesService, s: SuscripcionDetalle, sol: SolicitudPlan, max: number | null): Promise<boolean> {
  let lista: ListaEmpresas;
  try {
    lista = await firstValueFrom(service.empresas(s.id));
  } catch (err) {
    await Swal.fire({ icon: 'error', title: 'No se pudo consultar la app', text: mensajeError(err as HttpErrorResponse, ''), confirmButtonColor: COLOR_PRIMARIO });
    return false;
  }

  const r = await Swal.fire({
    title: `Empresas que conserva: ${escapar(s.producto_nombre)}`,
    width: 620,
    html: `<div style="text-align:left">${seleccionEmpresasHtml(lista, max, sol.empresas_conservar)}</div>`,
    showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar',
    confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true, focusConfirm: false, showLoaderOnConfirm: true,
    didOpen: () => activarSeleccion(max),
    preConfirm: async () => {
      const sel = leerSeleccion(max);
      if (typeof sel === 'string') {
        Swal.showValidationMessage(sel);
        return false;
      }
      try {
        return await firstValueFrom(service.capturarEmpresasPlan(sol.id, sel ?? null));
      } catch (err) {
        Swal.showValidationMessage(mensajeError(err as HttpErrorResponse, 'No se pudo guardar la lista.'));
        return false;
      }
    },
  });
  return r.isConfirmed && !!r.value;
}

/** Desbloqueo de empresas bloqueadas por el plan, con la auditoría de licencia de Kernia. */
export async function desbloquearEmpresas(service: ClientesService, s: SuscripcionDetalle, ids: number[], lista: ListaEmpresas): Promise<ListaEmpresas | null> {
  const nombres = lista.data.filter(e => ids.includes(e.id)).map(e => escapar(e.nombre)).join(', ');
  const r = await Swal.fire({
    title: 'Desbloquear empresas',
    html: `<p style="margin:0 0 8px;text-align:left">Se desbloquean: <b>${nombres}</b>. Kernia verifica antes que no rebasen la licencia
      (hoy usa ${lista.cuentan_para_limite} de ${lista.max_empresas_kernia ?? 'sin límite'}).</p>`,
    input: 'textarea', inputLabel: 'Motivo (queda en la bitácora)', inputPlaceholder: 'Por ejemplo: el cliente subió de plan',
    showCancelButton: true, confirmButtonText: 'Desbloquear', cancelButtonText: 'Cancelar',
    confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true, showLoaderOnConfirm: true,
    inputValidator: v => (!v?.trim() ? 'El motivo es obligatorio.' : null),
    preConfirm: async (motivo: string) => {
      try {
        return await firstValueFrom(service.desbloquearEmpresas(s.id, ids, motivo.trim()));
      } catch (err) {
        Swal.showValidationMessage(mensajeError(err as HttpErrorResponse, 'No se pudo desbloquear.'));
        return false;
      }
    },
  });
  if (!r.isConfirmed || !r.value) return null;
  await Swal.fire({ icon: 'success', title: 'Empresas desbloqueadas', text: 'El cliente ya puede entrar a ellas, con los mismos accesos que tenían sus usuarios.', confirmButtonColor: COLOR_PRIMARIO });
  return r.value;
}

/**
 * (09-oct-2026) Archivar UNA empresa (v2.3 caso A): conformidad del cliente,
 * motivo de salida y confirmación con el RFC. Lo autoriza el escalafón y se
 * ejecuta a las 00:00: Kernia la exporta, se la entrega al cliente y, cuando la
 * descarga o vence el plazo, la app la retira y libera su lugar en el plan.
 */
export async function solicitarArchivoEmpresa(service: ClientesService, s: SuscripcionDetalle, e: EmpresaApp): Promise<boolean> {
  let motivos;
  try {
    motivos = await motivosSalida(service);
  } catch {
    await Swal.fire({ icon: 'error', title: 'No se pudo cargar la lista de motivos', confirmButtonColor: COLOR_PRIMARIO });
    return false;
  }
  const confirmacion = e.rfc || e.nombre;
  const r = await Swal.fire({
    title: `Archivar ${escapar(e.nombre)}`,
    width: 620,
    icon: 'warning',
    html: `
      <div style="text-align:left">
        <p style="margin:0 0 12px">A las 00:00 siguientes a la autorización, Kernia <b>exporta esta empresa</b> y se la entrega al cliente
          (correo con el aviso y, aparte, la contraseña). Cuando la descargue, o a los 15 días, la app la <b>retira</b>: sus datos salen de la base
          y se libera su lugar en el plan. El respaldo se conserva 90 días. <b>No se puede deshacer.</b> Las demás empresas siguen igual.</p>
        ${selectMotivoHtml(motivos, 'ar-motivo-salida')}
        <label for="ar-motivo" style="display:block;font-weight:600">Detalle (queda en la bitácora)</label>
        <textarea id="ar-motivo" class="swal2-textarea" style="margin:6px 0 12px;width:100%"></textarea>
        <fieldset style="border:0;padding:0;margin:0 0 12px">
          <legend style="font-weight:600;padding:0">Conformidad del cliente (obligatoria)</legend>
          <label style="margin:6px 12px 6px 0"><input type="radio" name="ar-conf" value="correo" checked> Correo del cliente</label>
          <label style="margin:6px 0"><input type="radio" name="ar-conf" value="documento"> Documento firmado</label>
          <input id="ar-ref" class="swal2-input" style="margin:6px 0 0;width:100%" maxlength="500" placeholder="Referencia: fecha, remitente y asunto, o folio">
        </fieldset>
        <label for="ar-rfc" style="display:block;font-weight:600">Para confirmar, escribe el RFC de la empresa: <code>${escapar(confirmacion)}</code></label>
        <input id="ar-rfc" class="swal2-input" autocomplete="off" style="margin:6px 0 0;width:100%">
      </div>`,
    showCancelButton: true, confirmButtonText: 'Solicitar', cancelButtonText: 'Cancelar',
    confirmButtonColor: '#b91c1c', reverseButtons: true, focusConfirm: false, showLoaderOnConfirm: true,
    preConfirm: async () => {
      const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value.trim();
      const motivoSalida = (document.getElementById('ar-motivo-salida') as HTMLSelectElement).value;
      if (!motivoSalida || !val('ar-motivo')) {
        Swal.showValidationMessage('Elige el motivo y escribe el detalle.');
        return false;
      }
      if (!val('ar-ref')) {
        Swal.showValidationMessage('Indica la referencia de la conformidad del cliente.');
        return false;
      }
      if (val('ar-rfc').toLowerCase() !== confirmacion.toLowerCase()) {
        Swal.showValidationMessage(`Escribe exactamente «${confirmacion}» para confirmar.`);
        return false;
      }
      try {
        return await firstValueFrom(service.solicitarSalida(s.id, {
          tipo: 'archivo', empresa_id: e.id, motivo: val('ar-motivo'), motivo_salida: motivoSalida,
          conformidad_tipo: (document.querySelector('input[name="ar-conf"]:checked') as HTMLInputElement | null)?.value === 'documento' ? 'documento' : 'correo',
          conformidad_referencia: val('ar-ref'), confirmacion_slug: val('ar-rfc'),
        }));
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
