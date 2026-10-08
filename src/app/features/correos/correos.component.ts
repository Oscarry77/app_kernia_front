import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

import { CorreosService, type CorreoEnviado, type PlantillaCorreo } from '../../core/services/correos.service';
import { mensajeError } from '../clientes/panel-ui';

/**
 * (07-oct-2026) Centro de correo: qué envió Kernia, a quién y con qué
 * resultado (el cuerpo no se guarda), y la vista previa de cada plantilla con
 * datos ficticios para revisar los textos.
 */
@Component({
  selector: 'app-correos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './correos.component.html',
  styleUrls: ['../shared/crud-page.scss', '../clientes/clientes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorreosComponent implements OnInit {
  private service = inject(CorreosService);
  private sanitizer = inject(DomSanitizer);

  vista = signal<'enviados' | 'plantillas'>('enviados');

  filas = signal<CorreoEnviado[]>([]);
  pagina = signal(1);
  paginas = signal(1);
  total = signal(0);
  cargando = signal(true);
  error = signal<string | null>(null);
  filtroEstado = '';
  filtroPlantilla = '';

  plantillas = signal<PlantillaCorreo[]>([]);
  seleccionada = signal<PlantillaCorreo | null>(null);
  html = signal<SafeHtml | null>(null);

  ngOnInit(): void {
    this.service.plantillas().subscribe({ next: r => this.plantillas.set(r.data) });
    this.cargar(1);
  }

  cargar(pagina: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.enviados({ estado: this.filtroEstado, plantilla: this.filtroPlantilla, pagina }).subscribe({
      next: r => { this.filas.set(r.data); this.pagina.set(r.pagina); this.paginas.set(r.paginas); this.total.set(r.total); this.cargando.set(false); },
      error: (err: HttpErrorResponse) => { this.cargando.set(false); this.error.set(mensajeError(err, 'No se pudo cargar el registro de correos.')); },
    });
  }

  verPlantilla(p: PlantillaCorreo): void {
    this.seleccionada.set(p);
    this.html.set(null);
    this.service.vistaPrevia(p.clave).subscribe({
      // El HTML viene de la API de Kernia (plantillas propias con datos ficticios) y se muestra en un
      // iframe con sandbox="" (sin scripts ni navegación); sin esto Angular quitaría los estilos del correo.
      next: html => this.html.set(this.sanitizer.bypassSecurityTrustHtml(html)),
      error: () => this.html.set(this.sanitizer.bypassSecurityTrustHtml('<p style="font-family:sans-serif">No se pudo cargar la vista previa.</p>')),
    });
  }

  etiquetaEstado(estado: string): string {
    return ({ enviado: 'Enviado', fallido: 'Falló', omitido: 'No enviado' } as Record<string, string>)[estado] ?? estado;
  }
}
