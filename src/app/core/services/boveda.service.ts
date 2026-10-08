import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

/** (07-oct-2026) Bóveda de Kernia: los secretos se escriben, nunca se leen. */
export interface ResumenCorreo {
  host: string;
  port: number;
  cifrado: 'tls' | 'ssl';
  usuario: string;
  remitente: string;
  nombre_remitente: string;
  actualizado_en: string | null;
  actualizado_por: string | null;
  mailer_activo: boolean;
}

export interface EstadoCorreo {
  configurado: boolean;
  disponible: boolean;
  mailer: string;
  resumen: ResumenCorreo | null;
}

export interface SecretoBoveda {
  id: number;
  clave: string;
  tipo: 'correo_smtp' | 'clave_respaldo' | string;
  descripcion: string | null;
  cliente: string | null;
  cliente_id: number | null;
  vigente: boolean;
  expira_en: string | null;
  purgado_en: string | null;
  actualizado_en: string | null;
  actualizado_por: string | null;
}

export interface AccesoBoveda {
  fecha: string | null;
  accion: string;
  usuario: string | null;
  motivo: string | null;
  ip: string | null;
}

export interface DatosCorreo {
  host: string;
  port: number;
  cifrado: 'tls' | 'ssl';
  usuario: string;
  /** Vacía conserva la guardada. */
  password: string;
  remitente: string;
  nombre_remitente: string;
  password_operador: string;
}

@Injectable({ providedIn: 'root' })
export class BovedaService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  listar(): Observable<{ data: SecretoBoveda[]; correo: EstadoCorreo }> {
    return this.http.get<{ data: SecretoBoveda[]; correo: EstadoCorreo }>(`${this.api}/boveda`);
  }

  accesos(id: number): Observable<{ data: AccesoBoveda[] }> {
    return this.http.get<{ data: AccesoBoveda[] }>(`${this.api}/boveda/${id}/accesos`);
  }

  guardarCorreo(datos: DatosCorreo): Observable<{ correo: EstadoCorreo }> {
    return this.http.put<{ correo: EstadoCorreo }>(`${this.api}/boveda/correo`, datos);
  }

  probarCorreo(destinatario: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/boveda/correo/probar`, { destinatario });
  }
}
