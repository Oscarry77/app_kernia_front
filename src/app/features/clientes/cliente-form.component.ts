import {
  Component, ChangeDetectionStrategy, EventEmitter, Input, OnInit, Output, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { HttpErrorResponse } from '@angular/common/http';

import { ClientesService } from '../../core/services/clientes.service';
import type { CatalogoFiscal, Cliente, SuscripcionDetalle, TipoPersona } from '../../core/models/panel.model';

/**
 * (02-oct-2026) Alta y edición de un cliente con los datos de la Constancia de
 * Situación Fiscal. El tipo de persona muestra solo los campos que le aplican
 * y filtra el régimen fiscal. En edición, el slug no se puede cambiar.
 */
@Component({
  selector: 'app-cliente-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cliente-form.component.html',
  styleUrls: ['../shared/crud-page.scss', './clientes.component.scss', './cliente-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClienteFormComponent implements OnInit {
  /** Cliente a editar; sin él, es un alta. */
  @Input() cliente: Cliente<SuscripcionDetalle> | null = null;
  @Output() guardado = new EventEmitter<Cliente<SuscripcionDetalle>>();
  @Output() cerrado = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private service = inject(ClientesService);

  catalogo = signal<CatalogoFiscal | null>(null);
  guardando = signal(false);
  error = signal<string | null>(null);
  erroresCampo = signal<Record<string, string>>({});
  tipo = signal<TipoPersona>('moral');

  regimenes = computed(() => {
    const aplica = this.tipo() === 'moral' ? 'M' : 'F';
    return (this.catalogo()?.regimenes_fiscales ?? []).filter(r => r.aplica.includes(aplica));
  });

  readonly hoy = new Date().toISOString().slice(0, 10);

  form = this.fb.group({
    slug: ['', [Validators.pattern(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/)]],
    tipo_persona: ['moral' as TipoPersona, Validators.required],
    rfc: ['', Validators.required],
    razon_social: [''],
    regimen_capital: [''],
    nombre_comercial: [''],
    curp: [''],
    nombres: [''],
    primer_apellido: [''],
    segundo_apellido: [''],
    fecha_inicio_operaciones: [''],
    estatus_padron: ['activo'],
    regimen_fiscal: ['', Validators.required],
    codigo_postal: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    tipo_vialidad: [''],
    nombre_vialidad: [''],
    numero_exterior: [''],
    numero_interior: [''],
    colonia: [''],
    localidad: [''],
    municipio: [''],
    entidad_federativa: ['', Validators.required],
    entre_calle: [''],
    y_calle: [''],
    correo: ['', [Validators.required, Validators.email]],
    telefono_lada: [''],
    telefono_numero: [''],
    notas: [''],
  });

  get esAlta(): boolean {
    return this.cliente === null;
  }

  ngOnInit(): void {
    this.service.catalogoFiscal().subscribe({ next: r => this.catalogo.set(r.data) });

    if (this.esAlta) {
      this.form.controls.slug.addValidators(Validators.required);
    } else if (this.cliente) {
      const f = this.cliente.fiscal;
      this.form.patchValue({
        ...Object.fromEntries(Object.entries(f ?? {}).map(([k, v]) => [k, v ?? ''])),
        tipo_persona: f?.tipo_persona ?? 'moral',
        estatus_padron: f?.estatus_padron ?? 'activo',
        notas: this.cliente.notas ?? '',
      });
      this.form.controls.slug.disable();
    }

    this.tipo.set(this.form.controls.tipo_persona.value ?? 'moral');
    this.form.controls.tipo_persona.valueChanges.subscribe(t => {
      this.tipo.set(t ?? 'moral');
      // El régimen fiscal elegido puede no aplicar al nuevo tipo.
      const actual = this.form.controls.regimen_fiscal.value;
      if (actual && !this.regimenes().some(r => r.clave === actual)) {
        this.form.controls.regimen_fiscal.setValue('');
      }
    });
  }

  /** Sugiere el slug con el nombre mientras el operador no lo haya escrito. */
  sugerirSlug(): void {
    const slug = this.form.controls.slug;
    if (!this.esAlta || slug.dirty) return;
    const base = this.tipo() === 'moral'
      ? this.form.controls.nombre_comercial.value || this.form.controls.razon_social.value
      : `${this.form.controls.nombres.value ?? ''} ${this.form.controls.primer_apellido.value ?? ''}`;
    slug.setValue(
      (base ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63),
    );
  }

  errorDe(campo: string): string | null {
    return this.erroresCampo()[campo] ?? null;
  }

  guardar(): void {
    if (this.guardando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    this.erroresCampo.set({});

    // Vacíos como null; los campos del otro tipo de persona no se envían.
    const crudo = this.form.getRawValue() as Record<string, string | null>;
    const delOtroTipo = this.tipo() === 'moral'
      ? ['curp', 'nombres', 'primer_apellido', 'segundo_apellido']
      : ['razon_social', 'regimen_capital'];
    const datos: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(crudo)) {
      if (delOtroTipo.includes(k) || (k === 'slug' && !this.esAlta)) continue;
      datos[k] = typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
    }

    const peticion = this.esAlta
      ? this.service.crear(datos as never)
      : this.service.actualizar(this.cliente!.id, datos as never);

    peticion.subscribe({
      next: r => { this.guardando.set(false); this.guardado.emit(r.data); },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        const errores = err.error?.errors as Record<string, string[]> | undefined;
        if (errores) {
          this.erroresCampo.set(Object.fromEntries(Object.entries(errores).map(([k, v]) => [k, v[0]])));
          this.error.set('Revisa los campos marcados.');
        } else {
          this.error.set(err.error?.message ?? 'No se pudo guardar el cliente.');
        }
      },
    });
  }

  cerrar(): void {
    if (!this.guardando()) this.cerrado.emit();
  }
}
