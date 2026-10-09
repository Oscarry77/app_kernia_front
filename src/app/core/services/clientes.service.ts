import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, type HttpResponse } from '@angular/common/http';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type {
  CatalogoFiscal,
  Cliente,
  DatosFiscales,
  FilaMotivoSalida,
  FilaVigencia,
  ListaEmpresas,
  SolicitudRespaldoPendiente,
  SolicitudRespaldoResumen,
  TipoSolicitudRespaldo,
  MotivoSalida,
  Pago,
  ResumenMotivosSalida,
  ConPasswordTemporal,
  ProductoCatalogo,
  ResumenPagos,
  SolicitudPlan,
  SolicitudSalida,
  SuscripcionDetalle,
  TipoSalida,
  TipoCliente,
  VistaPreviaPlan,
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

  crear(datos: Partial<DatosFiscales> & { slug: string; tipo?: TipoCliente; notas?: string | null }): Observable<{ data: Cliente<SuscripcionDetalle> }> {
    return this.http.post<{ data: Cliente<SuscripcionDetalle> }>(`${this.api}/clientes`, datos);
  }

  actualizar(id: number, datos: Partial<DatosFiscales> & { tipo?: TipoCliente; notas?: string | null }): Observable<{ data: Cliente<SuscripcionDetalle> }> {
    return this.http.put<{ data: Cliente<SuscripcionDetalle> }>(`${this.api}/clientes/${id}`, datos);
  }

  suscribir(clienteId: number, datos: { producto: string; plan: string | null; admin_nombre: string; admin_email: string }): Observable<ConPasswordTemporal<SuscripcionDetalle>> {
    return this.http.post<ConPasswordTemporal<SuscripcionDetalle>>(`${this.api}/clientes/${clienteId}/suscripciones`, datos);
  }

  // ── Cambio de plan (05-oct-2026): solicitud + autorización del escalafón ──
  vistaPreviaPlan(id: number, plan: string): Observable<{ data: VistaPreviaPlan }> {
    return this.http.get<{ data: VistaPreviaPlan }>(`${this.api}/suscripciones/${id}/plan/vista-previa`, { params: new HttpParams().set('plan', plan) });
  }

  solicitarCambioPlan(id: number, datos: { plan: string; aplicacion: 'inmediata' | 'renovacion'; motivo: string; motivo_salida?: string; empresas_conservar?: number[] | null }): Observable<{ data: SolicitudPlan }> {
    return this.http.post<{ data: SolicitudPlan }>(`${this.api}/suscripciones/${id}/cambios-plan`, datos);
  }

  cambiosPlan(id: number): Observable<{ data: SolicitudPlan[] }> {
    return this.http.get<{ data: SolicitudPlan[] }>(`${this.api}/suscripciones/${id}/cambios-plan`);
  }

  cambiosPlanPendientes(): Observable<{ data: SolicitudPlan[] }> {
    return this.http.get<{ data: SolicitudPlan[] }>(`${this.api}/cambios-plan/pendientes`);
  }

  /** Autorizar o rechazar: exige el correo y la contraseña de quien autoriza. */
  resolverCambioPlan(id: number, datos: { accion: 'autorizar' | 'rechazar'; email: string; password: string; comentario: string | null }): Observable<{ data: SolicitudPlan; suscripcion: SuscripcionDetalle; aplicada: boolean; pagos: ResumenPagos | null }> {
    return this.http.post<{ data: SolicitudPlan; suscripcion: SuscripcionDetalle; aplicada: boolean; pagos: ResumenPagos | null }>(`${this.api}/cambios-plan/${id}/resolver`, datos);
  }

  cancelarCambioPlan(id: number, motivo: string): Observable<{ data: SolicitudPlan }> {
    return this.http.post<{ data: SolicitudPlan }>(`${this.api}/cambios-plan/${id}/cancelar`, { motivo });
  }

  // ── Salida (08-oct-2026): retirar, reactivar o finiquitar, con autorización del escalafón ──
  solicitarSalida(id: number, datos: { tipo: TipoSalida; motivo: string; motivo_salida?: string; conformidad_tipo?: 'correo' | 'documento'; conformidad_referencia?: string; confirmacion_slug?: string }): Observable<{ data: SolicitudSalida }> {
    return this.http.post<{ data: SolicitudSalida }>(`${this.api}/suscripciones/${id}/salidas`, datos);
  }

  salidas(id: number): Observable<{ data: SolicitudSalida[] }> {
    return this.http.get<{ data: SolicitudSalida[] }>(`${this.api}/suscripciones/${id}/salidas`);
  }

  salidasPendientes(): Observable<{ data: SolicitudSalida[] }> {
    return this.http.get<{ data: SolicitudSalida[] }>(`${this.api}/salidas/pendientes`);
  }

  /** Autorizar o rechazar: exige el correo y la contraseña de quien autoriza. */
  resolverSalida(id: number, datos: { accion: 'autorizar' | 'rechazar'; email: string; password: string; comentario: string | null }): Observable<{ data: SolicitudSalida; suscripcion: SuscripcionDetalle; aplicada: boolean }> {
    return this.http.post<{ data: SolicitudSalida; suscripcion: SuscripcionDetalle; aplicada: boolean }>(`${this.api}/salidas/${id}/resolver`, datos);
  }

  cancelarSalida(id: number, motivo: string): Observable<{ data: SolicitudSalida }> {
    return this.http.post<{ data: SolicitudSalida }>(`${this.api}/salidas/${id}/cancelar`, { motivo });
  }

  // ── Formulario de salida (08-oct-2026) ──
  motivosSalida(): Observable<{ data: MotivoSalida[] }> {
    return this.http.get<{ data: MotivoSalida[] }>(`${this.api}/catalogo/motivos-salida`);
  }

  /** Enlace de un solo uso para el cliente; la URL solo existe en esta respuesta. */
  enlaceFormularioSalida(id: number): Observable<{ data: { url: string; expira_en: string } }> {
    return this.http.post<{ data: { url: string; expira_en: string } }>(`${this.api}/suscripciones/${id}/formulario-salida/enlace`, {});
  }

  motivosSalidaDireccion(filtros: Record<string, string>): Observable<{ data: FilaMotivoSalida[]; resumen: ResumenMotivosSalida }> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filtros)) if (v) params = params.set(k, v);
    return this.http.get<{ data: FilaMotivoSalida[]; resumen: ResumenMotivosSalida }>(`${this.api}/motivos-salida`, { params });
  }

  // ── Empresas del cliente en una app v2.2 (09-oct-2026) ──
  empresas(id: number): Observable<ListaEmpresas> {
    return this.http.get<ListaEmpresas>(`${this.api}/suscripciones/${id}/empresas`);
  }

  desbloquearEmpresas(id: number, empresas: number[], motivo: string): Observable<ListaEmpresas> {
    return this.http.post<ListaEmpresas>(`${this.api}/suscripciones/${id}/empresas/desbloquear`, { empresas, motivo });
  }

  /** null = el cliente aún no decide. */
  capturarEmpresasPlan(solicitudId: number, empresas: number[] | null): Observable<{ data: SolicitudPlan }> {
    return this.http.put<{ data: SolicitudPlan }>(`${this.api}/cambios-plan/${solicitudId}/empresas`, { empresas_conservar: empresas });
  }

  // ── Soporte sobre un respaldo (09-oct-2026): autoriza el escalafón ──
  solicitarRespaldo(exportacionId: number, tipo: TipoSolicitudRespaldo, motivo: string): Observable<{ data: SolicitudRespaldoResumen }> {
    return this.http.post<{ data: SolicitudRespaldoResumen }>(`${this.api}/exportaciones/${exportacionId}/solicitudes`, { tipo, motivo });
  }

  respaldosPendientes(): Observable<{ data: SolicitudRespaldoPendiente[] }> {
    return this.http.get<{ data: SolicitudRespaldoPendiente[] }>(`${this.api}/respaldos/pendientes`);
  }

  resolverRespaldo(id: number, datos: { accion: 'autorizar' | 'rechazar'; email: string; password: string; comentario: string | null }): Observable<{ data: SolicitudRespaldoResumen }> {
    return this.http.post<{ data: SolicitudRespaldoResumen }>(`${this.api}/respaldos/${id}/resolver`, datos);
  }

  cancelarRespaldo(id: number, motivo: string): Observable<{ data: SolicitudRespaldoResumen }> {
    return this.http.post<{ data: SolicitudRespaldoResumen }>(`${this.api}/respaldos/${id}/cancelar`, { motivo });
  }

  reintentarRespaldo(id: number): Observable<{ data: SolicitudRespaldoResumen }> {
    return this.http.post<{ data: SolicitudRespaldoResumen }>(`${this.api}/respaldos/${id}/reintentar`, {});
  }

  /** El 7z cifrado (con el JWT del operador); el navegador lo guarda. */
  descargarRespaldo(id: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.api}/respaldos/${id}/archivo`, { responseType: 'blob', observe: 'response' });
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
