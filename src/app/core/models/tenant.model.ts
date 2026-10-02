export interface Tenant {
  id: number;
  nombre_cliente: string;
  slug: string;
  db_host: string;
  db_port: string;
  db_driver: 'sqlsrv' | 'mysql';
  db_database: string;
  db_username: string;
  db_bi_username: string | null;
  estatus: 'activo' | 'suspendido' | 'en_aprovisionamiento';
  plan: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantMetricas {
  ok: boolean;
  error?: string;
  usuarios_total?: number;
  usuarios_activos?: number;
  clientes_total?: number;
  productos_total?: number;
  documentos_total?: number;
  documentos_ultimos_30_dias?: number;
  ultimo_acceso?: string | null;
}

export interface CrearTenantRequest {
  slug: string;
  nombre: string;
  db_host: string;
  db_database: string;
  db_username?: string;
  db_password?: string;
  puerto?: number;
  driver: 'sqlsrv' | 'mysql';
  auto_provisionar?: boolean;
  con_bi?: boolean;
}

export interface LandlordAdmin {
  id: number;
  nombre: string;
  email: string;
  ultimo_acceso: string | null;
}

export interface LandlordLoginRequest {
  email: string;
  password: string;
}

export interface LandlordAuthResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: LandlordAdmin;
}
