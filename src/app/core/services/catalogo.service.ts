import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ExtraCatalogo, PlanCatalogo, ProductoCatalogo } from '../models/panel.model';

interface RespuestaCatalogo {
  data: ProductoCatalogo[];
  limites_disponibles: string[];
}

/** (02-oct-2026) Catálogo de productos (apps), planes y extras. */
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/catalogo/productos`;

  /** Catálogo completo: incluye planes y extras inactivos y cuántos clientes usan cada plan. */
  completo(): Observable<RespuestaCatalogo> {
    return this.http.get<RespuestaCatalogo>(`${this.api}?completo=1`);
  }

  actualizarProducto(slug: string, datos: Pick<ProductoCatalogo, 'nombre' | 'nombre_corto' | 'descripcion' | 'permite_ws_cntpaq'>): Observable<{ data: ProductoCatalogo }> {
    return this.http.put<{ data: ProductoCatalogo }>(`${this.api}/${slug}`, datos);
  }

  guardarPlan(slug: string, plan: Partial<PlanCatalogo>, esNuevo: boolean): Observable<{ data: ProductoCatalogo; clientes_afectados: number }> {
    return esNuevo
      ? this.http.post<{ data: ProductoCatalogo; clientes_afectados: number }>(`${this.api}/${slug}/planes`, plan)
      : this.http.put<{ data: ProductoCatalogo; clientes_afectados: number }>(`${this.api}/${slug}/planes/${plan.codigo}`, plan);
  }

  guardarExtra(slug: string, extra: Partial<ExtraCatalogo>, esNuevo: boolean): Observable<{ data: ProductoCatalogo }> {
    return esNuevo
      ? this.http.post<{ data: ProductoCatalogo }>(`${this.api}/${slug}/extras`, extra)
      : this.http.put<{ data: ProductoCatalogo }>(`${this.api}/${slug}/extras/${extra.codigo}`, extra);
  }
}
