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

export const escapar = (s: string) =>
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

/** (08-oct-2026) Muestra UNA vez el enlace de la encuesta de salida, con botón para copiarlo. */
export async function mostrarEnlaceUnaVez(url: string, expiraEn: string): Promise<void> {
  const vence = new Date(expiraEn).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
  await Swal.fire({
    icon: 'success',
    title: 'Enlace generado',
    html: `
      <p style="margin:0 0 8px">Se muestra <b>una sola vez</b>. Envíalo al administrador del cliente; sirve una vez y vence el <b>${escapar(vence)}</b>.</p>
      <code style="display:block;margin-top:6px;padding:10px;border-radius:8px;background:#0d0f13;color:#edeff3;font-size:13px;word-break:break-all;user-select:all">${escapar(url)}</code>`,
    showDenyButton: true,
    denyButtonText: 'Copiar',
    denyButtonColor: '#4b5563',
    confirmButtonText: 'Listo',
    confirmButtonColor: COLOR_PRIMARIO,
    allowOutsideClick: false,
    preDeny: async () => {
      await navigator.clipboard.writeText(url);
      Swal.showValidationMessage('Copiado al portapapeles.');
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
    retirado: 'Retirado',
    en_finiquito: 'En finiquito',
    finiquitado: 'Finiquitado',
    eliminado: 'Eliminado',
  } as Record<string, string>)[estatus] ?? estatus;
}

export function etiquetaLimite(clave: string): string {
  return ({
    max_empresas: 'Empresas',
    max_empleados: 'Empleados',
    max_usuarios: 'Usuarios',
  } as Record<string, string>)[clave] ?? clave;
}

/** (02-oct-2026) Fase 2: texto de los días restantes de una vigencia. */
export function etiquetaDias(dias: number | null): string {
  if (dias === null) return 'Sin definir';
  if (dias < 0) return `Vencida hace ${-dias} día${dias === -1 ? '' : 's'}`;
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `${dias} días`;
}

/** (05-oct-2026) Tipo de cliente. Solo los no comerciales llevan etiqueta visible. */
export const TIPOS_CLIENTE: { clave: 'comercial' | 'demo' | 'capacitacion' | 'prueba'; nombre: string; prefijo: string | null; ayuda: string }[] = [
  { clave: 'comercial', nombre: 'Comercial', prefijo: null, ayuda: 'Cliente que paga: vigencias, avisos y suspensión automática.' },
  { clave: 'demo', nombre: 'Demo', prefijo: 'demo-', ayuda: 'Para demostraciones a prospectos. Sin cobro ni vigencia; lo ven todos los vendedores.' },
  { clave: 'capacitacion', nombre: 'Capacitación', prefijo: 'cap-', ayuda: 'Para que los operadores practiquen. Sin cobro ni vigencia; lo ven todos los vendedores.' },
  { clave: 'prueba', nombre: 'Prueba', prefijo: null, ayuda: 'Datos técnicos de pruebas e interno. Solo lo ve el superadministrador.' },
];

export function etiquetaTipoCliente(tipo: string | null | undefined): string {
  return TIPOS_CLIENTE.find(t => t.clave === tipo)?.nombre ?? 'Comercial';
}
