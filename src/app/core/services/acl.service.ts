import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type {
  MotivoProrroga,
  NivelEscalafon,
  Operador,
  Prorroga,
  RegistroAuditoria,
  RolCatalogo,
  SuscripcionDetalle,
} from '../models/panel.model';

/** (02-oct-2026) Fase 3: operadores y su cartera, escalafón, prórrogas y bitácora. */
@Injectable({ providedIn: 'root' })
export class AclService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  // ── Operadores ──
  operadores(): Observable<{ data: Operador[]; roles: RolCatalogo[]; asignables: string[] }> {
    return this.http.get<{ data: Operador[]; roles: RolCatalogo[]; asignables: string[] }>(`${this.api}/operadores`);
  }

  crearOperador(datos: { nombre: string; email: string; rol: string; puesto: string | null }): Observable<{ data: Operador; password_enviada: boolean; password_temporal: string | null }> {
    return this.http.post<{ data: Operador; password_enviada: boolean; password_temporal: string | null }>(`${this.api}/operadores`, datos);
  }

  actualizarOperador(id: number, datos: { nombre: string; rol: string; puesto: string | null; activo: boolean }): Observable<{ data: Operador }> {
    return this.http.put<{ data: Operador }>(`${this.api}/operadores/${id}`, datos);
  }

  cartera(id: number): Observable<{ data: { id: number; nombre: string; slug: string }[] }> {
    return this.http.get<{ data: { id: number; nombre: string; slug: string }[] }>(`${this.api}/operadores/${id}/cartera`);
  }

  guardarCartera(id: number, clientes: number[]): Observable<{ data: { id: number; nombre: string; slug: string }[] }> {
    return this.http.put<{ data: { id: number; nombre: string; slug: string }[] }>(`${this.api}/operadores/${id}/cartera`, { clientes });
  }

  // ── Escalafón ──
  escalafon(): Observable<{ data: NivelEscalafon[]; max_dias: number }> {
    return this.http.get<{ data: NivelEscalafon[]; max_dias: number }>(`${this.api}/escalafon`);
  }

  guardarNivel(id: number | null, datos: { nivel: number; puesto: string; usuario_id: number; dias_max: number; activo: boolean }): Observable<{ data: NivelEscalafon }> {
    return id
      ? this.http.put<{ data: NivelEscalafon }>(`${this.api}/escalafon/${id}`, datos)
      : this.http.post<{ data: NivelEscalafon }>(`${this.api}/escalafon`, datos);
  }

  // ── Prórrogas ──
  motivos(): Observable<{ data: MotivoProrroga[]; max_dias: number }> {
    return this.http.get<{ data: MotivoProrroga[]; max_dias: number }>(`${this.api}/prorrogas/motivos`);
  }

  prorrogas(suscripcionId: number): Observable<{ data: Prorroga[] }> {
    return this.http.get<{ data: Prorroga[] }>(`${this.api}/suscripciones/${suscripcionId}/prorrogas`);
  }

  pendientes(): Observable<{ data: Prorroga[] }> {
    return this.http.get<{ data: Prorroga[] }>(`${this.api}/prorrogas/pendientes`);
  }

  solicitar(suscripcionId: number, datos: { dias: number; motivo: string; detalle: string | null }): Observable<{ data: Prorroga }> {
    return this.http.post<{ data: Prorroga }>(`${this.api}/suscripciones/${suscripcionId}/prorrogas`, datos);
  }

  /** Autorizar o rechazar: exige el correo y la contraseña de quien autoriza. */
  resolver(id: number, datos: { accion: 'autorizar' | 'rechazar'; email: string; password: string; comentario: string | null }): Observable<{ data: Prorroga; suscripcion: SuscripcionDetalle; app_confirmo: boolean | null }> {
    return this.http.post<{ data: Prorroga; suscripcion: SuscripcionDetalle; app_confirmo: boolean | null }>(`${this.api}/prorrogas/${id}/resolver`, datos);
  }

  // ── Bitácora ──
  auditoria(filtros: { cliente_id?: number; accion?: string; pagina?: number }): Observable<{ data: RegistroAuditoria[]; pagina: number; paginas: number; total: number }> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filtros)) {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    }
    return this.http.get<{ data: RegistroAuditoria[]; pagina: number; paginas: number; total: number }>(`${this.api}/auditoria`, { params });
  }
}
