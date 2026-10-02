import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { RecursoApiBase, ApiItem } from './recurso-api.base';
import type { CrearTenantRequest, Tenant, TenantMetricas } from '../models/tenant.model';

@Injectable({ providedIn: 'root' })
export class TenantsService extends RecursoApiBase<Tenant> {
  constructor() {
    super(inject(HttpClient), environment.apiUrl, 'tenants');
  }

  // No se usa el `crear()` genérico de RecursoApiBase: el alta de un tenant es una operación
  // de aprovisionamiento (puede tardar, corre migraciones/seeders) y la respuesta trae además
  // el password de BI generado (solo se muestra una vez) -- una forma distinta a un CRUD plano.
  provisionar(datos: CrearTenantRequest): Observable<ApiItem<Tenant> & { usuario_bi: string | null; password_bi: string | null }> {
    return this.http.post<ApiItem<Tenant> & { usuario_bi: string | null; password_bi: string | null }>(
      `${environment.apiUrl}/tenants`,
      datos,
    );
  }

  // Nombre distinto a `cambiarEstatus` del base (esa firma manda {activo: boolean}; aquí el
  // backend espera {estatus: 'activo'|'suspendido'}).
  actualizarEstatus(id: number, estatus: 'activo' | 'suspendido'): Observable<ApiItem<Tenant>> {
    return this.http.patch<ApiItem<Tenant>>(`${environment.apiUrl}/tenants/${id}/estatus`, { estatus });
  }

  metricas(id: number): Observable<ApiItem<TenantMetricas>> {
    return this.http.get<ApiItem<TenantMetricas>>(`${environment.apiUrl}/tenants/${id}/metricas`);
  }
}
