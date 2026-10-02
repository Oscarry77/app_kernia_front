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
