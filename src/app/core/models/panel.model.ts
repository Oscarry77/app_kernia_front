// (02-oct-2026) Modelo v2 del panel: clientes (workspaces) y sus suscripciones
// a cada app. Ninguna respuesta trae credenciales de base ni tokens.

export type EstatusSuscripcion = 'en_aprovisionamiento' | 'activo' | 'suspendido' | 'fallido' | 'cancelado';

export interface PlanCatalogo {
  codigo: string;
  nombre: string;
  modulos: string[] | null;
  limites: Record<string, number | null> | null;
  orden?: number;
  activo?: boolean;
  /** Solo en el catálogo completo: clientes que tienen este plan. */
  clientes?: number;
}

export interface ExtraCatalogo {
  codigo: string;
  nombre: string;
  limite: string;
  incremento: number;
  activo?: boolean;
}

export interface ModuloCatalogo {
  clave: string;
  nombre: string;
  requiere: string[] | null;
}

export interface ProductoCatalogo {
  id: number;
  slug: string;
  nombre: string;
  nombre_corto: string | null;
  descripcion: string | null;
  permite_ws_cntpaq: boolean;
  modo_datos: 'dedicada' | 'compartida';
  modulos: ModuloCatalogo[];
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
  fecha_proximo_pago: string | null;
  dias_restantes: number | null;
}

/** (02-oct-2026) Fase 2: vigencia de una suscripción. */
export interface AvisoVigencia {
  nivel: 'info' | 'advertencia' | 'critico';
  dias_restantes: number;
  fecha_proximo_pago: string;
  mensaje: string;
}

export interface Vigencia {
  modalidad_pago: string | null;
  fecha_contratacion: string | null;
  fecha_proximo_pago: string | null;
  dias_restantes: number | null;
  dias_gracia: number;
  suspension_automatica: boolean;
  suspension_motivo: 'vencimiento' | 'manual' | null;
  activa_hasta: string | null;
  aviso: AvisoVigencia | null;
}

export interface FilaVigencia extends Vigencia {
  id: number;
  cliente_id: number;
  cliente: string;
  cliente_slug: string;
  producto: string;
  producto_nombre: string;
  plan_nombre: string | null;
  estatus: EstatusSuscripcion;
  en_prorroga: boolean;
}

export interface Pago {
  id: number;
  fecha_pago: string;
  periodo_desde: string;
  periodo_hasta: string;
  modalidad: string;
  monto: string | null;
  moneda: string;
  referencia: string;
  notas: string | null;
  registrado_por: string | null;
}

export interface SuscripcionDetalle extends SuscripcionResumen, Vigencia {
  estatus_almacenado: EstatusSuscripcion;
  modo_datos: string;
  db_driver: string | null;
  permite_ws_cntpaq: boolean;
  ws_cntpaq_habilitado: boolean;
  ref_externa: string | null;
  admin_email: string | null;
  modulos: string[] | null;
  limites: Record<string, number | null> | null;
  extras: Record<string, number>;
  provisionada_en: string | null;
  aviso_intentos: number;
  aviso_error: string | null;
}

export type TipoPersona = 'moral' | 'fisica';

/** (02-oct-2026) Datos según la Constancia de Situación Fiscal. */
export interface DatosFiscales {
  tipo_persona: TipoPersona | null;
  rfc: string | null;
  razon_social: string | null;
  regimen_capital: string | null;
  nombre_comercial: string | null;
  curp: string | null;
  nombres: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  fecha_inicio_operaciones: string | null;
  estatus_padron: 'activo' | 'suspendido' | null;
  regimen_fiscal: string | null;
  regimen_fiscal_nombre?: string | null;
  codigo_postal: string | null;
  tipo_vialidad: string | null;
  nombre_vialidad: string | null;
  numero_exterior: string | null;
  numero_interior: string | null;
  colonia: string | null;
  localidad: string | null;
  municipio: string | null;
  entidad_federativa: string | null;
  entre_calle: string | null;
  y_calle: string | null;
  correo: string | null;
  telefono_lada: string | null;
  telefono_numero: string | null;
}

export interface CatalogoFiscal {
  regimenes_fiscales: { clave: string; nombre: string; aplica: ('F' | 'M')[] }[];
  regimenes_capital: { clave: string; nombre: string }[];
  tipos_vialidad: string[];
  entidades_federativas: string[];
}

export interface Cliente<S = SuscripcionResumen> {
  id: number;
  slug: string;
  nombre: string;
  tipo_persona: TipoPersona | null;
  rfc: string | null;
  nombre_comercial: string | null;
  estatus: 'activo' | 'suspendido' | 'baja';
  datos_fiscales_completos: boolean;
  creado: string | null;
  suscripciones: S[];
  notas?: string | null;
  fiscal?: DatosFiscales;
}

export interface ConPasswordTemporal<T> {
  data: T;
  password_temporal: string;
}
