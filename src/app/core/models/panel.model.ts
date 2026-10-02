// (02-oct-2026) Modelo v2 del panel: clientes (workspaces) y sus suscripciones
// a cada app. Ninguna respuesta trae credenciales de base ni tokens.

export type EstatusSuscripcion = 'en_aprovisionamiento' | 'activo' | 'suspendido' | 'fallido' | 'cancelado';

export interface PlanCatalogo {
  codigo: string;
  nombre: string;
  modulos: string[] | null;
  limites: Record<string, number | null> | null;
}

export interface ExtraCatalogo {
  codigo: string;
  nombre: string;
  limite: string;
  incremento: number;
}

export interface ProductoCatalogo {
  id: number;
  slug: string;
  nombre: string;
  modo_datos: 'dedicada' | 'compartida';
  modulos: { clave: string; nombre: string }[];
  planes: PlanCatalogo[];
  extras: ExtraCatalogo[];
}

export interface SuscripcionResumen {
  id: number;
  producto: string;
  producto_nombre: string;
  estatus: EstatusSuscripcion;
  plan: string | null;
  plan_nombre: string | null;
  aviso_pendiente: string | null;
}

export interface SuscripcionDetalle extends SuscripcionResumen {
  estatus_almacenado: EstatusSuscripcion;
  modo_datos: string;
  ref_externa: string | null;
  admin_email: string | null;
  modulos: string[] | null;
  limites: Record<string, number | null> | null;
  extras: Record<string, number>;
  fecha_contratacion: string | null;
  fecha_proximo_pago: string | null;
  provisionada_en: string | null;
  aviso_intentos: number;
  aviso_error: string | null;
}

export interface Cliente<S = SuscripcionResumen> {
  id: number;
  slug: string;
  nombre: string;
  rfc: string | null;
  estatus: 'activo' | 'suspendido' | 'baja';
  notas: string | null;
  creado: string | null;
  suscripciones: S[];
}

export interface ConPasswordTemporal<T> {
  data: T;
  password_temporal: string;
}
