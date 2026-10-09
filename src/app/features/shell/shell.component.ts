import { Component, ChangeDetectionStrategy, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { MenuIconoComponent } from './menu-icono.component';

/** Nodo del menú tal como lo entrega Kernia (GET /api/acl/menu). */
export interface NodoMenu {
  etiqueta: string;
  icono: string;
  ruta?: string;
  hijos?: NodoMenu[];
}

/**
 * (09-oct-2026) Menú lateral en árbol (ESTANDAR_ACL_Y_MENU_APPS_KERNIA.md §2):
 * líneas guía, iconos y acordeón en todos los niveles. El árbol viene de
 * Kernia ya filtrado por los permisos del operador (una sola definición,
 * config/kernia_matriz.php). Lo abierto se recuerda por ruta completa
 * ("Kernia > Seguridad"), nunca por el nombre.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, MenuIconoComponent],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent implements OnInit {
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly admin = this.auth.currentUser;
  menu = signal<NodoMenu[]>([]);
  /** Llaves (ruta completa de etiquetas) de los grupos abiertos. */
  abiertos = signal<Set<string>>(new Set());

  /** (02-oct-2026) Fase 3: al entrar se toma el rol vigente (pudo cambiar desde el último inicio de sesión). */
  ngOnInit(): void {
    this.auth.cargarPerfil().subscribe({ error: () => {} });
    this.http.get<{ data: NodoMenu[] }>(`${environment.apiUrl}/acl/menu`).subscribe({
      next: r => {
        this.menu.set(r.data);
        this.abrirRamaActual();
      },
      error: () => this.menu.set([]),
    });
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.abrirRamaActual());
  }

  llave(padre: string, nodo: NodoMenu): string {
    return padre ? `${padre} > ${nodo.etiqueta}` : nodo.etiqueta;
  }

  estaAbierto(llave: string): boolean {
    return this.abiertos().has(llave);
  }

  /** Acordeón: abrir un grupo cierra a sus hermanos y todo lo que tenían abierto. */
  alternar(padre: string, nodo: NodoMenu): void {
    const llave = this.llave(padre, nodo);
    const abiertos = new Set(this.abiertos());
    if (abiertos.has(llave)) {
      [...abiertos].filter(k => k === llave || k.startsWith(`${llave} > `)).forEach(k => abiertos.delete(k));
    } else {
      const prefijo = padre ? `${padre} > ` : '';
      [...abiertos].filter(k => k.startsWith(prefijo) && !k.startsWith(`${llave} > `)).forEach(k => abiertos.delete(k));
      abiertos.add(llave);
    }
    this.abiertos.set(abiertos);
  }

  /** Abre la rama de la pantalla actual (al cargar y al navegar). */
  private abrirRamaActual(): void {
    const url = this.router.url.split('?')[0];
    const buscar = (nodos: NodoMenu[], padre: string): string[] | null => {
      for (const n of nodos) {
        const llave = this.llave(padre, n);
        if (n.ruta && (url === n.ruta || url.startsWith(`${n.ruta}/`))) return [];
        if (n.hijos) {
          const rama = buscar(n.hijos, llave);
          if (rama) return [llave, ...rama];
        }
      }
      return null;
    };
    const rama = buscar(this.menu(), '');
    if (rama?.length) this.abiertos.set(new Set(rama));
  }

  logout(): void {
    this.auth.logout();
  }
}
