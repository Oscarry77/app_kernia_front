// (02-oct-2026) Modelo v2 del panel: clientes (workspaces) y sus suscripciones
// a cada app. Ninguna respuesta trae credenciales de base ni tokens.

export type EstatusSuscripcion = 'en_aprovisionamiento' | 'activo' | 'suspendido' | 'fallido' | 'cancelado'
  // (08-oct-2026) Estados de salida, estándar v2.3 §4.1.
  | 'retirado' | 'en_finiquito' | 'finiquitado' | 'eliminado'
  // (09-oct-2026) Baja de plan v2.2 en curso.
  | 'en_mantenimiento';

export interface PlanCatalogo {
  codigo: string;
  nombre: string;
  /** (05-oct-2026) Descripción comercial para la ficha de planes. */
  descripcion?: string | null;
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
  /** (08-oct-2026) La app ya reconoce los estados de salida (v2.3 §4.1). */
  estatus_salida: boolean;
  /** (09-oct-2026) La app cumple v2.2: entrega sus empresas y ejecuta bajas con bloqueo. */
  empresas_v22: boolean;
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
  /** (09-oct-2026) Último aviso de vencimiento entregado por correo en el ciclo actual. */
  ultimo_aviso_correo?: { hito: string; enviado_en: string } | null;
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
  /** (05-oct-2026) Cambio de plan pendiente de autorizar o programado. */
  cambio_plan: SolicitudPlan | null;
  /** (08-oct-2026) En `en_finiquito`: último día para descargar el respaldo. */
  descarga_hasta: string | null;
  /** (08-oct-2026) Solicitud de salida pendiente de autorizar o programada. */
  salida: SolicitudSalida | null;
  /** Qué salidas admite hoy la suscripción; `razon` explica por qué no, si no. */
  salidas_posibles: Partial<Record<TipoSalida, { permitido: boolean; razon: string | null }>>;
  /** (09-oct-2026) Exportación v2.3 más reciente (solo metadatos). */
  exportacion: ExportacionResumen | null;
}

export interface ExportacionResumen {
  id: number;
  motivo: 'finiquito' | 'copia' | 'archivo';
  estado: 'pendiente' | 'processing' | 'ready' | 'failed';
  intento: number;
  tamano_bytes: number | null;
  sha256: string | null;
  disponible_hasta: string | null;
  descargada_en: string | null;
  retencion_hasta: string | null;
  carta_enviada_en: string | null;
  clave_enviada_en: string | null;
  recordatorios: number[];
  error: string | null;
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

/** (05-oct-2026) Demo y capacitación quedan fuera de cobro y vigencias; prueba solo la ve el superadmin. */
export type TipoCliente = 'comercial' | 'demo' | 'capacitacion' | 'prueba';

export interface Cliente<S = SuscripcionResumen> {
  id: number;
  slug: string;
  nombre: string;
  tipo: TipoCliente;
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

// ── Fase 3 (02-oct-2026): operadores, escalafón, prórrogas y bitácora ──

export interface Operador {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  rol_nombre: string;
  puesto: string | null;
  activo: boolean;
  ultimo_acceso: string | null;
  cartera: boolean;
  clientes_en_cartera: number | null;
  nivel_autorizacion: number | null;
}

export interface RolCatalogo {
  clave: string;
  nombre: string;
}

export interface NivelEscalafon {
  id: number;
  nivel: number;
  puesto: string;
  usuario_id: number;
  usuario: string | null;
  email: string | null;
  dias_max: number;
  activo: boolean;
}

export type EstadoProrroga = 'solicitada' | 'autorizada' | 'rechazada' | 'vencida' | 'cerrada_por_pago' | 'cancelada';

export interface Prorroga {
  id: number;
  suscripcion_id: number;
  fecha_vencimiento: string | null;
  dias: number;
  motivo: string;
  motivo_nombre: string;
  detalle: string | null;
  estado: EstadoProrroga;
  desde: string | null;
  hasta: string | null;
  solicitada_por: string | null;
  resuelta_por: string | null;
  nivel_autorizacion: number | null;
  comentario_resolucion: string | null;
  solicitada_en: string | null;
  resuelta_en: string | null;
  // Solo en /prorrogas/pendientes
  cliente_id?: number;
  cliente?: string;
  producto?: string;
  producto_nombre?: string;
}

export interface MotivoProrroga {
  clave: string;
  nombre: string;
}

export interface RegistroAuditoria {
  id: number;
  fecha: string | null;
  usuario: string | null;
  accion: string;
  cliente_id: number | null;
  suscripcion_id: number | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  ip: string | null;
}

// ── Cambio de plan con autorización del escalafón (05-oct-2026) ──

export type EstadoSolicitudPlan = 'solicitada' | 'programada' | 'en_ejecucion' | 'aplicada' | 'rechazada' | 'cancelada' | 'fallida';

export interface ResumenPagos {
  modalidad_pago: string | null;
  fecha_proximo_pago: string | null;
  dias_restantes: number | null;
  pagos_registrados: number;
  ultimo_pago: { fecha: string | null; periodo_hasta: string | null; referencia: string } | null;
}

export interface SolicitudPlan {
  id: number;
  suscripcion_id: number;
  plan_actual: string | null;
  plan_actual_nombre: string | null;
  plan_nuevo: string;
  plan_nuevo_nombre: string | null;
  direccion: 'subida' | 'bajada';
  aplicacion: 'inmediata' | 'renovacion';
  fecha_efectiva: string | null;
  motivo: string;
  estado: EstadoSolicitudPlan;
  solicitada_por: string | null;
  resuelta_por: string | null;
  nivel_autorizacion: number | null;
  comentario_resolucion: string | null;
  error: string | null;
  solicitada_en: string | null;
  resuelta_en: string | null;
  aplicada_en: string | null;
  // (09-oct-2026) Baja v2.2: empresas que conserva (null = aún no decide), fase en ejecución y resultado.
  empresas_conservar: number[] | null;
  fase: 'aviso' | 'mantenimiento' | 'ajustando' | null;
  fase_desde: string | null;
  respaldo_id: string | null;
  empresas_bloqueadas: number[] | null;
  /** Límite de empresas con el plan nuevo (plan + extras), calculado por Kernia. */
  max_empresas_nuevo: number | null;
  // Solo en /cambios-plan/pendientes
  cliente_id?: number;
  cliente?: string;
  producto?: string;
  producto_nombre?: string;
  pagos?: ResumenPagos;
}

export interface VistaPreviaPlan {
  plan_actual: string | null;
  plan_actual_nombre: string | null;
  plan_nuevo: string;
  plan_nuevo_nombre: string;
  direccion: 'subida' | 'bajada';
  modulos_gana: string[];
  modulos_pierde: string[];
  limites_antes: Record<string, number | null>;
  limites_despues: Record<string, number | null>;
  limites_reducidos: string[];
  fecha_proximo_pago: string | null;
  usa_v22: boolean;
}

/** (08-oct-2026) Salida de una suscripción: retirar la app, reactivarla o finiquitar. */
export type TipoSalida = 'retiro' | 'reactivacion' | 'finiquito';

export interface SolicitudSalida {
  id: number;
  suscripcion_id: number;
  tipo: TipoSalida;
  estatus_anterior: EstatusSuscripcion | null;
  motivo: string;
  conformidad_tipo: 'correo' | 'documento' | null;
  conformidad_referencia: string | null;
  estado: EstadoSolicitudPlan;
  fecha_efectiva: string | null;
  solicitada_por: string | null;
  resuelta_por: string | null;
  nivel_autorizacion: number | null;
  comentario_resolucion: string | null;
  error: string | null;
  solicitada_en: string | null;
  resuelta_en: string | null;
  aplicada_en: string | null;
  // Solo en /salidas/pendientes
  cliente_id?: number;
  cliente?: string;
  cliente_slug?: string;
  producto?: string;
  producto_nombre?: string;
}

/** (08-oct-2026) Formulario de salida. */
export interface MotivoSalida {
  clave: string;
  nombre: string;
}

export interface FilaMotivoSalida {
  id: number;
  fecha: string;
  cliente_id: number;
  cliente: string | null;
  producto: string | null;
  origen: 'asesor' | 'cliente';
  evento: 'retiro' | 'finiquito' | 'baja_plan' | 'archivo';
  motivo: string;
  motivo_nombre: string;
  detalle: string | null;
  calificacion: number | null;
  mejora: string | null;
  recomendaria: boolean | null;
  registrado_por: string | null;
  estado_solicitud: EstadoSolicitudPlan | null;
}

export interface ResumenMotivosSalida {
  total: number;
  por_motivo: { motivo: string; nombre: string; asesor: number; cliente: number }[];
  respuestas_cliente: number;
  calificacion_promedio: number | null;
  recomendaria_pct: number | null;
}

/** (09-oct-2026) Empresa del cliente según la app (estándar v2.2 §3.1). */
export interface EmpresaApp {
  id: number;
  rfc: string | null;
  nombre: string;
  estado: 'activa' | 'inactiva' | 'bloqueada_plan' | 'archivada';
  creada_en: string | null;
}

export interface ListaEmpresas {
  data: EmpresaApp[];
  cuentan_para_limite: number;
  /** El límite que aplica la app. */
  max_empresas: number | null;
  /** El límite contratado según Kernia (plan + extras). */
  max_empresas_kernia?: number | null;
}
