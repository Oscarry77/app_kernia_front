import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';

import { AclService } from '../../core/services/acl.service';
import { AuthService } from '../../core/services/auth.service';
import { ClientesService } from '../../core/services/clientes.service';
import type { Operador, RolCatalogo } from '../../core/models/panel.model';
import { COLOR_PRIMARIO, mensajeError, mostrarPasswordUnaVez } from '../clientes/panel-ui';

interface EdicionOperador {
  id: number | null;
  nombre: string;
  email: string;
  rol: string;
  puesto: string;
  activo: boolean;
}

interface EdicionCartera {
  operador: Operador;
  seleccion: Set<number>;
  filtro: string;
}

/**
 * (02-oct-2026) Fase 3: operadores de Kernia, su rol y la cartera de los
 * vendedores. Nadie asigna un rol por encima del suyo (lo valida Kernia).
 */
@Component({
  selector: 'app-operadores',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './operadores.component.html',
  styleUrls: ['../shared/crud-page.scss', '../clientes/clientes.component.scss', '../shared/acl-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperadoresComponent implements OnInit {
  private acl = inject(AclService);
  private auth = inject(AuthService);
  private clientesService = inject(ClientesService);

  operadores = signal<Operador[]>([]);
  roles = signal<RolCatalogo[]>([]);
  asignables = signal<string[]>([]);
  clientes = signal<{ id: number; nombre: string; slug: string }[]>([]);
  cargando = signal(true);
  errorCarga = signal<string | null>(null);

  edicion = signal<EdicionOperador | null>(null);
  cartera = signal<EdicionCartera | null>(null);
  guardando = signal(false);
  error = signal<string | null>(null);

  readonly yo = computed(() => this.auth.currentUser()?.id);
  readonly rolesAsignables = computed(() => this.roles().filter(r => this.asignables().includes(r.clave)));

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.errorCarga.set(null);
    this.acl.operadores().subscribe({
      next: r => {
        this.operadores.set(r.data);
        this.roles.set(r.roles);
        this.asignables.set(r.asignables);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => { this.cargando.set(false); this.errorCarga.set(mensajeError(err, 'No se pudieron cargar los operadores.')); },
    });
  }

  /** Solo se edita a quien tiene un rol que el operador en sesión puede asignar. */
  editable(o: Operador): boolean {
    return this.asignables().includes(o.rol);
  }

  nuevo(): void {
    this.error.set(null);
    this.edicion.set({ id: null, nombre: '', email: '', rol: 'vendedor', puesto: '', activo: true });
  }

  editar(o: Operador): void {
    this.error.set(null);
    this.edicion.set({ id: o.id, nombre: o.nombre, email: o.email, rol: o.rol, puesto: o.puesto ?? '', activo: o.activo });
  }

  guardar(): void {
    const e = this.edicion();
    if (!e || this.guardando()) return;
    if (!e.nombre.trim() || (!e.id && !e.email.trim())) { this.error.set('Nombre y correo son obligatorios.'); return; }

    this.guardando.set(true);
    this.error.set(null);
    const puesto = e.puesto.trim() || null;

    if (e.id) {
      this.acl.actualizarOperador(e.id, { nombre: e.nombre.trim(), rol: e.rol, puesto, activo: e.activo }).subscribe({
        next: () => {
          this.guardando.set(false);
          this.edicion.set(null);
          this.cargar();
          Swal.fire({ icon: 'success', title: 'Operador actualizado', timer: 1500, showConfirmButton: false });
        },
        error: (err: HttpErrorResponse) => { this.guardando.set(false); this.error.set(mensajeError(err, 'No se pudo guardar.')); },
      });
      return;
    }

    this.acl.crearOperador({ nombre: e.nombre.trim(), email: e.email.trim().toLowerCase(), rol: e.rol, puesto }).subscribe({
      next: async r => {
        this.guardando.set(false);
        this.edicion.set(null);
        this.cargar();
        if (r.password_temporal) {
          await mostrarPasswordUnaVez('Operador creado', r.data.email, r.password_temporal);
        } else {
          await Swal.fire({ icon: 'success', title: 'Operador creado', text: `Su contraseña se envió a ${r.data.email}.`, confirmButtonColor: COLOR_PRIMARIO });
        }
      },
      error: (err: HttpErrorResponse) => { this.guardando.set(false); this.error.set(mensajeError(err, 'No se pudo crear el operador.')); },
    });
  }

  // ── Cartera ──

  abrirCartera(o: Operador): void {
    this.error.set(null);
    if (this.clientes().length === 0) {
      this.clientesService.listar().subscribe({ next: r => this.clientes.set(r.data.map(c => ({ id: c.id, nombre: c.nombre, slug: c.slug }))) });
    }
    this.acl.cartera(o.id).subscribe({
      next: r => this.cartera.set({ operador: o, seleccion: new Set(r.data.map(c => c.id)), filtro: '' }),
      error: (err: HttpErrorResponse) => Swal.fire({ icon: 'error', title: 'No se pudo cargar la cartera', text: mensajeError(err, ''), confirmButtonColor: COLOR_PRIMARIO }),
    });
  }

  clientesFiltrados(c: EdicionCartera) {
    const f = c.filtro.trim().toLowerCase();
    return f ? this.clientes().filter(x => x.nombre.toLowerCase().includes(f) || x.slug.includes(f)) : this.clientes();
  }

  alternar(c: EdicionCartera, id: number): void {
    const seleccion = new Set(c.seleccion);
    if (seleccion.has(id)) { seleccion.delete(id); } else { seleccion.add(id); }
    this.cartera.set({ ...c, seleccion });
  }

  guardarCartera(): void {
    const c = this.cartera();
    if (!c || this.guardando()) return;
    this.guardando.set(true);
    this.acl.guardarCartera(c.operador.id, [...c.seleccion]).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cartera.set(null);
        this.cargar();
        Swal.fire({ icon: 'success', title: 'Cartera actualizada', timer: 1500, showConfirmButton: false });
      },
      error: (err: HttpErrorResponse) => { this.guardando.set(false); this.error.set(mensajeError(err, 'No se pudo guardar la cartera.')); },
    });
  }
}
