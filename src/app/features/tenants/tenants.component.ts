import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';

import { TenantsService } from '../../core/services/tenants.service';
import type { Tenant, TenantMetricas } from '../../core/models/tenant.model';

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './tenants.component.html',
  styleUrls: ['../shared/crud-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantsComponent {
  private fb = inject(FormBuilder);
  private service = inject(TenantsService);

  tenants = signal<Tenant[]>([]);
  cargando = signal(false);

  mostrarForm = signal(false);
  editandoId = signal<number | null>(null);
  guardando = signal(false);
  error = signal<string | null>(null);

  // Métricas cargadas on-demand por tenant (no se piden todas al abrir el listado).
  metricasPorTenant = signal<Record<number, TenantMetricas | 'cargando'>>({});

  form = this.fb.group({
    slug:             ['', [Validators.required, Validators.maxLength(63), Validators.pattern(/^[a-z0-9-]+$/)]],
    nombre:           ['', [Validators.required, Validators.maxLength(255)]],
    db_host:          ['', [Validators.required, Validators.maxLength(255)]],
    puerto:           [1433, [Validators.required]],
    driver:           ['sqlsrv' as 'sqlsrv' | 'mysql', [Validators.required]],
    db_database:      ['', [Validators.required, Validators.maxLength(255)]],
    auto_provisionar: [true],
    con_bi:           [false],
    db_username:      [''],
    db_password:      [''],
  });

  formEdicion = this.fb.group({
    nombre_cliente: ['', [Validators.required, Validators.maxLength(255)]],
    plan:           [''],
    notas:          [''],
  });

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.service.listar().subscribe({
      next: res => { this.tenants.set(res.data); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  nuevo(): void {
    this.editandoId.set(null);
    this.form.reset({ puerto: 1433, driver: 'sqlsrv', auto_provisionar: true, con_bi: false });
    this.error.set(null);
    this.mostrarForm.set(true);
  }

  editar(t: Tenant): void {
    this.editandoId.set(t.id);
    this.formEdicion.reset({
      nombre_cliente: t.nombre_cliente,
      plan: t.plan ?? '',
      notas: t.notas ?? '',
    });
    this.error.set(null);
    this.mostrarForm.set(true);
  }

  cerrarForm(): void {
    this.mostrarForm.set(false);
  }

  get formActivo() {
    return this.editandoId() !== null ? this.formEdicion : this.form;
  }

  guardar(): void {
    if (this.editandoId() !== null) {
      this.guardarEdicion();
    } else {
      this.guardarAlta();
    }
  }

  private guardarAlta(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.guardando.set(true);
    this.error.set(null);

    const datos = this.form.getRawValue();

    this.service.provisionar({
      slug: datos.slug!,
      nombre: datos.nombre!,
      db_host: datos.db_host!,
      db_database: datos.db_database!,
      db_username: datos.auto_provisionar ? undefined : (datos.db_username || undefined),
      db_password: datos.auto_provisionar ? undefined : (datos.db_password || undefined),
      puerto: datos.puerto!,
      driver: datos.driver!,
      auto_provisionar: !!datos.auto_provisionar,
      con_bi: !!datos.con_bi,
    }).subscribe({
      next: res => {
        this.guardando.set(false);
        this.mostrarForm.set(false);
        this.cargar();

        if (res.usuario_bi && res.password_bi) {
          Swal.fire({
            icon: 'success',
            title: 'Tenant creado — usuario de BI generado',
            html: `Esta es la <strong>única vez</strong> que se muestra el password en claro, guárdalo ahora:<br><br>
                   usuario: <code>${res.usuario_bi}</code><br>
                   password: <code>${res.password_bi}</code>`,
          });
        } else {
          Swal.fire({ icon: 'success', title: 'Tenant creado', timer: 1800, showConfirmButton: false });
        }
      },
      error: err => {
        this.guardando.set(false);
        this.error.set(this.mensajeError(err, 'No se pudo crear el tenant.'));
      },
    });
  }

  private guardarEdicion(): void {
    if (this.formEdicion.invalid) { this.formEdicion.markAllAsTouched(); return; }

    const id = this.editandoId();
    if (!id) return;

    this.guardando.set(true);
    this.error.set(null);

    const datos = this.formEdicion.getRawValue();
    this.service.actualizar(id, {
      nombre_cliente: datos.nombre_cliente ?? undefined,
      plan: datos.plan ?? undefined,
      notas: datos.notas ?? undefined,
    }).subscribe({
      next: () => { this.guardando.set(false); this.mostrarForm.set(false); this.cargar(); },
      error: err => {
        this.guardando.set(false);
        this.error.set(this.mensajeError(err, 'No se pudo actualizar el tenant.'));
      },
    });
  }

  cambiarEstatus(t: Tenant, event: Event): void {
    event.stopPropagation();

    const nuevoEstatus = t.estatus === 'activo' ? 'suspendido' : 'activo';
    const accion = nuevoEstatus === 'suspendido' ? 'suspender' : 'activar';

    Swal.fire({
      icon: 'warning',
      title: `¿${accion === 'suspender' ? 'Suspender' : 'Activar'} a ${t.nombre_cliente}?`,
      text: accion === 'suspender'
        ? 'Los usuarios de este cliente no podrán iniciar sesión mientras esté suspendido.'
        : 'Los usuarios de este cliente podrán volver a iniciar sesión.',
      showCancelButton: true,
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    }).then(resultado => {
      if (!resultado.isConfirmed) return;

      this.service.actualizarEstatus(t.id, nuevoEstatus).subscribe({
        next: () => this.cargar(),
        error: err => Swal.fire({ icon: 'error', title: 'No se pudo cambiar el estatus', text: this.mensajeError(err, '') }),
      });
    });
  }

  verMetricas(t: Tenant, event: Event): void {
    event.stopPropagation();

    const actuales = this.metricasPorTenant();
    if (actuales[t.id] && actuales[t.id] !== 'cargando') {
      // Ya cargadas -- el toggle de visibilidad lo maneja el template con @if.
      const copia = { ...actuales };
      delete copia[t.id];
      this.metricasPorTenant.set(copia);
      return;
    }

    this.metricasPorTenant.set({ ...actuales, [t.id]: 'cargando' });

    this.service.metricas(t.id).subscribe({
      next: res => this.metricasPorTenant.set({ ...this.metricasPorTenant(), [t.id]: res.data }),
      error: () => this.metricasPorTenant.set({
        ...this.metricasPorTenant(),
        [t.id]: { ok: false, error: 'No se pudieron obtener las métricas.' },
      }),
    });
  }

  metricasDe(t: Tenant): TenantMetricas | 'cargando' | null {
    return this.metricasPorTenant()[t.id] ?? null;
  }

  private mensajeError(err: any, fallback: string): string {
    if (err?.error?.errors) {
      const primerError = Object.values(err.error.errors)[0];
      if (Array.isArray(primerError)) return primerError[0] as string;
    }
    return err?.error?.message ?? fallback;
  }
}
