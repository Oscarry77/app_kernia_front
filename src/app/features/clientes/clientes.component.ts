import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { ClientesService } from '../../core/services/clientes.service';
import type { Cliente } from '../../core/models/panel.model';
import { etiquetaEstatus, mensajeError } from './panel-ui';

/** (02-oct-2026) Lista de clientes del modelo v2, con sus apps, y alta de cliente. */
@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './clientes.component.html',
  styleUrls: ['../shared/crud-page.scss', './clientes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(ClientesService);
  private router = inject(Router);

  clientes = signal<Cliente[]>([]);
  cargando = signal(false);
  errorCarga = signal<string | null>(null);
  busqueda = signal('');

  mostrarForm = signal(false);
  guardando = signal(false);
  error = signal<string | null>(null);

  readonly etiqueta = etiquetaEstatus;

  form = this.fb.group({
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/)]],
    nombre: ['', [Validators.required, Validators.maxLength(255)]],
    rfc: ['', [Validators.maxLength(20)]],
    notas: [''],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.service.listar(this.busqueda()).subscribe({
      next: res => { this.clientes.set(res.data); this.cargando.set(false); },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.errorCarga.set(mensajeError(err, 'No se pudo cargar la lista de clientes.'));
      },
    });
  }

  buscar(valor: string): void {
    this.busqueda.set(valor.trim());
    this.cargar();
  }

  abrir(c: Cliente): void {
    this.router.navigate(['/clientes', c.id]);
  }

  nuevo(): void {
    this.form.reset({ slug: '', nombre: '', rfc: '', notas: '' });
    this.error.set(null);
    this.mostrarForm.set(true);
  }

  cerrarForm(): void {
    if (!this.guardando()) this.mostrarForm.set(false);
  }

  /** Sugiere el slug a partir del nombre mientras el operador no lo haya escrito. */
  sugerirSlug(): void {
    const slugCtrl = this.form.controls.slug;
    if (slugCtrl.dirty) return;
    const sugerido = (this.form.controls.nombre.value ?? '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\b(s\.?a\.?|de|c\.?v\.?|s\.?c\.?)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 63);
    slugCtrl.setValue(sugerido);
  }

  guardar(): void {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();

    this.service.crear({ slug: v.slug!, nombre: v.nombre!, rfc: v.rfc || null, notas: v.notas || null }).subscribe({
      next: res => {
        this.guardando.set(false);
        this.mostrarForm.set(false);
        this.router.navigate(['/clientes', res.data.id]);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(mensajeError(err, 'No se pudo crear el cliente.'));
      },
    });
  }
}
