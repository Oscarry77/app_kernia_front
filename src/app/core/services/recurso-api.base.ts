import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiCollection<T> {
  data: T[];
  meta?: { current_page: number; last_page: number; total: number };
}

export interface ApiItem<T> {
  data: T;
}

export abstract class RecursoApiBase<T extends { id?: number }> {
  protected constructor(
    protected http: HttpClient,
    protected baseUrl: string,
    protected recurso: string,
  ) {}

  private get url(): string {
    return `${this.baseUrl}/${this.recurso}`;
  }

  listar(params: Record<string, string | number | boolean | undefined> = {}): Observable<ApiCollection<T>> {
    let httpParams = new HttpParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        httpParams = httpParams.set(k, String(v));
      }
    }
    return this.http.get<ApiCollection<T>>(this.url, { params: httpParams });
  }

  obtener(id: number): Observable<ApiItem<T>> {
    return this.http.get<ApiItem<T>>(`${this.url}/${id}`);
  }

  crear(datos: Partial<T>): Observable<ApiItem<T>> {
    return this.http.post<ApiItem<T>>(this.url, datos);
  }

  actualizar(id: number, datos: Partial<T>): Observable<ApiItem<T>> {
    return this.http.put<ApiItem<T>>(`${this.url}/${id}`, datos);
  }

  cambiarEstatus(id: number, activo: boolean): Observable<ApiItem<T>> {
    return this.http.patch<ApiItem<T>>(`${this.url}/${id}/estatus`, { activo });
  }
}
