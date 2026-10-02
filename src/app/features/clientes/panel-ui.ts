import type { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';

export const COLOR_PRIMARIO = '#C2661D';

/** Mensaje legible de un error de la API (validación 422, regla de negocio, sin red). */
export function mensajeError(err: HttpErrorResponse, porDefecto: string): string {
  const errores = err?.error?.errors as Record<string, string[]> | undefined;
  if (errores) {
    return Object.values(errores).flat().join(' ');
  }
  if (err?.status === 0) {
    return 'No hay conexión con Kernia.';
  }
  return err?.error?.message ?? porDefecto;
}

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * Muestra UNA sola vez una contraseña temporal, con botón para copiarla.
 * Kernia no la guarda: si el operador cierra sin copiarla, habrá que restablecer.
 */
export async function mostrarPasswordUnaVez(titulo: string, usuario: string | null, password: string): Promise<void> {
  await Swal.fire({
    icon: 'success',
    title: titulo,
    html: `
      <p style="margin:0 0 8px">Se muestra <b>una sola vez</b>. Entrégala al cliente por un canal privado;
      la app le pedirá cambiarla en su primer ingreso.</p>
      ${usuario ? `<p style="margin:0 0 4px">Usuario: <b>${escapar(usuario)}</b></p>` : ''}
      <p style="margin:0">Contraseña temporal:</p>
      <code style="display:block;margin-top:6px;padding:10px;border-radius:8px;background:#0d0f13;color:#edeff3;font-size:16px;letter-spacing:1px;user-select:all">${escapar(password)}</code>`,
    showDenyButton: true,
    denyButtonText: 'Copiar',
    denyButtonColor: '#4b5563',
    confirmButtonText: 'Ya la guardé',
    confirmButtonColor: COLOR_PRIMARIO,
    allowOutsideClick: false,
    preDeny: async () => {
      await navigator.clipboard.writeText(password);
      Swal.showValidationMessage('Copiada al portapapeles.');
      return false;
    },
  });
}

export function etiquetaEstatus(estatus: string): string {
  return ({
    activo: 'Activo',
    suspendido: 'Suspendido',
    en_aprovisionamiento: 'En aprovisionamiento',
    fallido: 'Fallido',
    cancelado: 'Cancelado',
    baja: 'Baja',
  } as Record<string, string>)[estatus] ?? estatus;
}

export function etiquetaLimite(clave: string): string {
  return ({
    max_empresas: 'Empresas',
    max_empleados: 'Empleados',
    max_usuarios: 'Usuarios',
  } as Record<string, string>)[clave] ?? clave;
}
