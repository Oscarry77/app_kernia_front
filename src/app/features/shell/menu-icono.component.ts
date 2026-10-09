import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';

/**
 * (09-oct-2026) Iconos del menú: catálogo común de las APPs de Kernia
 * (ESTANDAR_ACL_Y_MENU_APPS_KERNIA.md §2.4). Línea, 24×24, grosor 1.8, sin
 * fuentes ni librerías externas. Los trazos son los mismos que en Comercializa.
 */
const TRAZOS: Record<string, string> = {
  kernia: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  engrane: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  tablero: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  libro: 'M4 4h6a2 2 0 012 2v14a2 2 0 00-2-2H4zM20 4h-6a2 2 0 00-2 2v14a2 2 0 012-2h6z',
  documento: 'M6 2h8l5 5v15H6zM14 2v5h5M9 13h7M9 17h7',
  caja: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  grafica: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  escudo: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  flechas: 'M7 7h13l-4-4M17 17H4l4 4',
  personas: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a7 7 0 0114 0v1M16 3.5a4 4 0 010 7.5M19 21v-1a6 6 0 00-3-5.2',
  persona: 'M12 11a4 4 0 100-8 4 4 0 000 8zM4 21v-1a8 8 0 0116 0v1',
  calendario: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4',
  verificado: 'M8 4h8v3H8zM6 5H4v17h16V5h-2M8.5 14l2.5 2.5 5-5',
  historial: 'M3 12a9 9 0 103-6.7L3 8M3 3v5h5M12 7v5l3 3',
  correo: 'M3 5h18v14H3zM3 6l9 7 9-7',
  capas: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  llave: 'M15 7a4 4 0 11-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0115 7zM16 10h.01',
  descarga: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  edificio: 'M4 21V3h11v18M15 9h5v12M8 7h3M8 11h3M8 15h3M2 21h20',
  portapapeles: 'M8 4h8v3H8zM6 5H4v17h16V5h-2M8 12h8M8 16h5',
  punto: 'M12 13a1 1 0 100-2 1 1 0 000 2z',
};

@Component({
  selector: 'app-menu-icono',
  standalone: true,
  template: `<svg [attr.width]="tam()" [attr.height]="tam()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="trazo()" /></svg>`,
  styles: [':host { display: inline-flex; flex: none; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuIconoComponent {
  nombre = input.required<string>();
  tam = input(16);
  trazo = computed(() => TRAZOS[this.nombre()] ?? TRAZOS['punto']);
}
