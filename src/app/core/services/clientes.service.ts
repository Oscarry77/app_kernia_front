import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type {
  CatalogoFiscal,
  Cliente,
  DatosFiscales,
  FilaVigencia,
  Pago,
  ConPasswordTemporal,
  ProductoCatalogo,
  SuscripcionDetalle,
} from '../models/panel.model';

/** (02-oct-2026) API del panel para clientes y sus apps (modelo v2). */
@Injectable({ providedIn: 'root' })
export class ClientesService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  catalogo(): Observable<{ data: ProductoCatalogo[] }> {
    return this.http.get<{ data: ProductoCatalogo[] }>(`${this.api}/catalogo/productos`);
  }

  listar(q = ''): Observable<{ data: Cliente[] }> {
    const params = q ? new HttpParams().set('q', q) : undefined;
    return this.http.get<{ data: Cliente[] }>(`${this.api}/clientes`, { params });
  }

  obtener(id: number): Observable<{ data: Cliente<SuscripcionDetalle> }> {
    return this.http.get<{ data: Cliente<SuscripcionDetalle> }>(`${this.api}/clientes/${id}`);
  }

  catalogoFiscal(): Observable<{ data: CatalogoFiscal }> {
    return this.http.get<{ data: CatalogoFiscal }>(`${this.api}/catalogo/fiscal`);
  }

  crear(datos: Partial<DatosFiscales> & { slug: string; notas?: string | null }): Observable<{ data: Cliente<SuscripcionDetalle> }> {
    return this.http.post<{ data: Cliente<SuscripcionDetalle> }>(`${this.api}/clientes`, datos);
  }

  actualizar(id: number, datos: Partial<DatosFiscales> & { notas?: string | null }): Observable<{ data: Cliente<SuscripcionDetalle> }> {
    return this.http.put<{ data: Cliente<SuscripcionDetalle> }>(`${this.api}/clientes/${id}`, datos);
  }

  suscribir(clienteId: number, datos: { producto: string; plan: string | null; admin_nombre: string; admin_email: string }): Observable<ConPasswordTemporal<SuscripcionDetalle>> {
    return this.http.post<ConPasswordTemporal<SuscripcionDetalle>>(`${this.api}/clientes/${clienteId}/suscripciones`, datos);
  }

  cambiarPlan(id: number, plan: string): Observable<{ data: SuscripcionDetalle }> {
    return this.http.patch<{ data: SuscripcionDetalle }>(`${this.api}/suscripciones/${id}/plan`, { plan });
  }

  agregarExtra(id: number, extra: string, cantidad: number, motivo: string): Observable<{ data: SuscripcionDetalle }> {
    return this.http.post<{ data: SuscripcionDetalle }>(`${this.api}/suscripciones/${id}/extras`, { extra, cantidad, motivo });
  }

  cambiarEstatus(id: number, estatus: 'activo' | 'suspendido', motivo: string): Observable<{ data: SuscripcionDetalle; app_confirmo: boolean }> {
    return this.http.patch<{ data: SuscripcionDetalle; app_confirmo: boolean }>(`${this.api}/suscripciones/${id}/estatus`, { estatus, motivo });
  }

  restablecerAdmin(id: number, email?: string): Observable<{ email: string; password_temporal: string }> {
    return this.http.post<{ email: string; password_temporal: string }>(`${this.api}/suscripciones/${id}/restablecer-admin`, email ? { email } : {});
  }

  reintentar(id: number, adminNombre: string): Observable<ConPasswordTemporal<SuscripcionDetalle>> {
    return this.http.post<ConPasswordTemporal<SuscripcionDetalle>>(`${this.api}/suscripciones/${id}/reintentar`, { admin_nombre: adminNombre });
  }

  wsCntpaq(id: number, habilitado: boolean): Observable<{ data: SuscripcionDetalle }> {
    return this.http.patch<{ data: SuscripcionDetalle }>(`${this.api}/suscripciones/${id}/ws-cntpaq`, { habilitado });
  }

  // ── Vigencias (fase 2) ──
  vigencias(filtro: string, dias = 30): Observable<{ data: FilaVigencia[]; hoy: string; modalidades: string[] }> {
    return this.http.get<{ data: FilaVigencia[]; hoy: string; modalidades: string[] }>(`${this.api}/vigencias`, {
      params: new HttpParams().set('filtro', filtro).set('dias', dias),
    });
  }

  actualizarVigencia(id: number, datos: { modalidad_pago: string; fecha_contratacion?: string | null; fecha_proximo_pago: string; dias_gracia: number; suspension_automatica: boolean }): Observable<{ data: SuscripcionDetalle }> {
    return this.http.put<{ data: SuscripcionDetalle }>(`${this.api}/suscripciones/${id}/vigencia`, datos);
  }

  pagos(id: number): Observable<{ data: Pago[] }> {
    return this.http.get<{ data: Pago[] }>(`${this.api}/suscripciones/${id}/pagos`);
  }

  registrarPago(id: number, datos: { referencia: string; fecha_pago?: string | null; monto?: number | null; moneda?: string; notas?: string | null }): Observable<{ data: SuscripcionDetalle; reactivada: boolean; app_confirmo: boolean | null }> {
    return this.http.post<{ data: SuscripcionDetalle; reactivada: boolean; app_confirmo: boolean | null }>(`${this.api}/suscripciones/${id}/pagos`, datos);
  }

  metricas(id: number): Observable<{ data: Record<string, unknown> }> {
    return this.http.get<{ data: Record<string, unknown> }>(`${this.api}/suscripciones/${id}/metricas`);
  }
}
