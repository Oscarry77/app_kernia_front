import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

/** (07-oct-2026) Centro de correo: registro de lo que Kernia envió y plantillas. */
export interface CorreoEnviado {
  id: number;
  fecha: string | null;
  plantilla: string;
  plantilla_nombre: string;
  destinatario: string;
  asunto: string;
  estado: 'enviado' | 'fallido' | 'omitido';
  error: string | null;
  contiene_secreto: boolean;
  cliente_id: number | null;
  cliente: string | null;
  operador: string | null;
  referencia: string | null;
}

export interface PlantillaCorreo {
  clave: string;
  nombre: string;
  contiene_secreto: boolean;
  asunto_ejemplo: string;
}

@Injectable({ providedIn: 'root' })
export class CorreosService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  enviados(filtros: { estado?: string; plantilla?: string; cliente_id?: number; pagina?: number }): Observable<{ data: CorreoEnviado[]; pagina: number; paginas: number; total: number }> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filtros)) {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    }
    return this.http.get<{ data: CorreoEnviado[]; pagina: number; paginas: number; total: number }>(`${this.api}/correos`, { params });
  }

  plantillas(): Observable<{ data: PlantillaCorreo[] }> {
    return this.http.get<{ data: PlantillaCorreo[] }>(`${this.api}/correos/plantillas`);
  }

  /** HTML con datos ficticios; se muestra en un iframe aislado (srcdoc + sandbox). */
  vistaPrevia(clave: string): Observable<string> {
    return this.http.get(`${this.api}/correos/plantillas/${clave}/vista-previa`, { responseType: 'text' });
  }
}
