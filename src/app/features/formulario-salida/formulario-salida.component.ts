import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, type HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

import { environment } from '../../../environments/environment';
import type { MotivoSalida } from '../../core/models/panel.model';
import { mensajeError } from '../clientes/panel-ui';

type Estado = 'cargando' | 'formulario' | 'enviado' | 'cerrado';

/**
 * (08-oct-2026) Encuesta de salida que contesta el CLIENTE desde su enlace de
 * un solo uso (30 días). Pública: no usa sesión ni muestra nada de Kernia más
 * allá del nombre del cliente y la app. Todo es opcional salvo el motivo.
 */
@Component({
  selector: 'app-formulario-salida',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './formulario-salida.component.html',
  styleUrls: ['./formulario-salida.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioSalidaComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private url = `${environment.apiUrl}/publico/salida/${encodeURIComponent(this.route.snapshot.paramMap.get('token') ?? '')}`;

  estado = signal<Estado>('cargando');
  mensaje = signal('');
  error = signal<string | null>(null);
  enviando = signal(false);
  cliente = signal('');
  app = signal('');
  motivos = signal<MotivoSalida[]>([]);

  respuesta: { motivo: string; detalle: string; calificacion: number | null; mejora: string; recomendaria: boolean | null } =
    { motivo: '', detalle: '', calificacion: null, mejora: '', recomendaria: null };

  readonly escala = [1, 2, 3, 4, 5];

  ngOnInit(): void {
    this.http.get<{ data: { cliente: string; app: string; motivos: MotivoSalida[] } }>(this.url).subscribe({
      next: r => {
        this.cliente.set(r.data.cliente);
        this.app.set(r.data.app);
        this.motivos.set(r.data.motivos);
        this.estado.set('formulario');
      },
      error: (err: HttpErrorResponse) => this.cerrar(err),
    });
  }

  enviar(): void {
    this.error.set(null);
    if (!this.respuesta.motivo) {
      this.error.set('Elige el motivo principal.');
      return;
    }
    if (this.respuesta.motivo === 'otro' && !this.respuesta.detalle.trim()) {
      this.error.set('Cuéntanos brevemente el motivo.');
      return;
    }
    this.enviando.set(true);
    this.http.post(this.url, this.respuesta).subscribe({
      next: () => { this.enviando.set(false); this.estado.set('enviado'); },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        if (err.status === 410 || err.status === 404) {
          this.cerrar(err);
        } else {
          this.error.set(mensajeError(err, 'No pudimos guardar tus respuestas. Intenta de nuevo.'));
        }
      },
    });
  }

  private cerrar(err: HttpErrorResponse): void {
    this.mensaje.set(err.status === 410 || err.status === 404
      ? err.error?.message ?? 'Este enlace ya no está disponible.'
      : 'No pudimos abrir la encuesta. Intenta más tarde.');
    this.estado.set('cerrado');
  }
}
