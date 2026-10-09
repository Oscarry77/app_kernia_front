import { Component, ChangeDetectionStrategy, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, type HttpErrorResponse } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { mensajeError } from '../clientes/panel-ui';
import { MenuIconoComponent } from '../shell/menu-icono.component';

interface Especial { etiqueta: string; roles: Record<string, boolean> }
interface NodoMatriz {
  etiqueta: string;
  icono: string;
  ruta?: string | null;
  nota?: string | null;
  hijos?: NodoMatriz[];
  columnas?: Record<string, Record<string, boolean> | null>;
  especiales?: Especial[];
}
interface Matriz {
  columnas: Record<string, string>;
  roles: { clave: string; nombre: string }[];
  modulos: NodoMatriz[];
}
/** Una fila de la tabla: el nodo y su nivel (para la sangría del árbol). */
interface Fila { nodo: NodoMatriz; nivel: number }

/**
 * (09-oct-2026) "Roles y accesos" de Kernia — CONSULTA (decisión del dueño del
 * 09-oct: los roles de Kernia son fijos). Misma forma que en las APPs
 * (ESTANDAR_ACL_Y_MENU_APPS_KERNIA.md §1.1): una pestaña por módulo, el árbol del
 * menú y las columnas Acceso, Crear, Editar y Cancelar, más los especiales.
 */
@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, MenuIconoComponent],
  templateUrl: './roles.component.html',
  styleUrls: ['../shared/crud-page.scss', '../clientes/clientes.component.scss', './roles.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesComponent implements OnInit {
  private http = inject(HttpClient);

  matriz = signal<Matriz | null>(null);
  error = signal<string | null>(null);
  rol = signal('vendedor');
  modulo = signal(0);

  columnas = computed(() => Object.entries(this.matriz()?.columnas ?? {}).map(([clave, nombre]) => ({ clave, nombre })));

  filas = computed<Fila[]>(() => {
    const m = this.matriz()?.modulos[this.modulo()];
    if (!m) return [];
    const salida: Fila[] = [];
    const recorrer = (nodos: NodoMatriz[], nivel: number) => nodos.forEach(n => {
      salida.push({ nodo: n, nivel });
      if (n.hijos) recorrer(n.hijos, nivel + 1);
    });
    recorrer(m.hijos ?? [], 0);
    return salida;
  });

  ngOnInit(): void {
    this.http.get<Matriz>(`${environment.apiUrl}/acl/matriz`).subscribe({
      next: m => this.matriz.set(m),
      error: (err: HttpErrorResponse) => this.error.set(mensajeError(err, 'No se pudo cargar la matriz.')),
    });
  }

  /** true, false o null (la columna no aplica a esa opción). */
  valor(n: NodoMatriz, columna: string): boolean | null {
    const c = n.columnas?.[columna];
    return c ? !!c[this.rol()] : null;
  }
}
