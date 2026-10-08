import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthService } from '../../core/services/auth.service';
import { BovedaService, type AccesoBoveda, type DatosCorreo, type EstadoCorreo, type SecretoBoveda } from '../../core/services/boveda.service';
import { COLOR_PRIMARIO, mensajeError } from '../clientes/panel-ui';

/**
 * (07-oct-2026) Bóveda de Kernia, solo para el superadministrador. Las
 * credenciales del buzón se capturan o reemplazan, nunca se muestran; guardar
 * pide de nuevo la contraseña de quien tiene la sesión.
 */
@Component({
  selector: 'app-boveda',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './boveda.component.html',
  styleUrls: ['../shared/crud-page.scss', '../clientes/clientes.component.scss', '../shared/acl-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BovedaComponent implements OnInit {
  private service = inject(BovedaService);
  private auth = inject(AuthService);

  secretos = signal<SecretoBoveda[]>([]);
  correo = signal<EstadoCorreo | null>(null);
  cargando = signal(true);
  errorCarga = signal<string | null>(null);

  edicion = signal<DatosCorreo | null>(null);
  guardando = signal(false);
  error = signal<string | null>(null);

  accesos = signal<Record<number, AccesoBoveda[] | 'cargando'>>({});

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.service.listar().subscribe({
      next: r => { this.secretos.set(r.data); this.correo.set(r.correo); this.cargando.set(false); },
      error: (err: HttpErrorResponse) => { this.cargando.set(false); this.errorCarga.set(mensajeError(err, 'No se pudo cargar la bóveda.')); },
    });
  }

  editarCorreo(): void {
    const r = this.correo()?.resumen;
    this.error.set(null);
    this.edicion.set({
      host: r?.host ?? 'smtp.gmail.com', port: r?.port ?? 587, cifrado: r?.cifrado ?? 'tls',
      usuario: r?.usuario ?? '', password: '', remitente: r?.remitente ?? '', nombre_remitente: r?.nombre_remitente ?? 'Kernia',
      password_operador: '',
    });
  }

  /** 587 va con TLS (STARTTLS) y 465 con SSL: se ajusta solo al elegir el puerto. */
  cambiarPuerto(e: DatosCorreo): void {
    if (Number(e.port) === 465) e.cifrado = 'ssl';
    if (Number(e.port) === 587) e.cifrado = 'tls';
  }

  guardarCorreo(): void {
    const e = this.edicion();
    if (!e || this.guardando()) return;
    if (!e.password_operador) { this.error.set('Escribe tu contraseña de Kernia para confirmar.'); return; }

    this.guardando.set(true);
    this.error.set(null);
    this.service.guardarCorreo({ ...e, port: Number(e.port) }).subscribe({
      next: r => {
        this.guardando.set(false);
        this.edicion.set(null);
        this.correo.set(r.correo);
        this.cargar();
        Swal.fire({ icon: 'success', title: 'Credenciales guardadas en la bóveda', text: 'Envía un correo de prueba para confirmar que funcionan.', confirmButtonColor: COLOR_PRIMARIO });
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        e.password_operador = '';
        this.error.set(mensajeError(err, 'No se pudieron guardar las credenciales.'));
      },
    });
  }

  async probar(): Promise<void> {
    const r = await Swal.fire({
      title: 'Enviar correo de prueba',
      input: 'email',
      inputLabel: 'Destinatario',
      inputValue: this.auth.currentUser()?.email ?? '',
      showCancelButton: true, confirmButtonText: 'Enviar', cancelButtonText: 'Cancelar',
      confirmButtonColor: COLOR_PRIMARIO, reverseButtons: true, showLoaderOnConfirm: true,
      preConfirm: async (destinatario: string) => {
        try {
          return await firstValueFrom(this.service.probarCorreo(destinatario));
        } catch (err) {
          Swal.showValidationMessage(mensajeError(err as HttpErrorResponse, 'No se pudo enviar.'));
          return false;
        }
      },
    });
    if (r.isConfirmed && r.value) {
      await Swal.fire({ icon: 'success', title: 'Correo enviado', text: r.value.message, confirmButtonColor: COLOR_PRIMARIO });
      this.recargarAccesos();
    }
  }

  verAccesos(s: SecretoBoveda): void {
    const actuales = { ...this.accesos() };
    if (actuales[s.id]) {
      delete actuales[s.id];
      this.accesos.set(actuales);
      return;
    }
    this.cargarAccesos(s.id);
  }

  accesosDe(id: number): AccesoBoveda[] | 'cargando' | undefined {
    return this.accesos()[id];
  }

  etiquetaTipo(tipo: string): string {
    return ({ correo_smtp: 'Buzón de Kernia', clave_respaldo: 'Contraseña de respaldo' } as Record<string, string>)[tipo] ?? tipo;
  }

  etiquetaAccion(accion: string): string {
    return ({
      guardado: 'Guardado', reemplazado: 'Reemplazado', usado: 'Usado por el sistema', prueba: 'Correo de prueba',
      purgado: 'Purgado por retención', denegado: 'Acceso denegado',
    } as Record<string, string>)[accion] ?? accion;
  }

  private cargarAccesos(id: number): void {
    this.accesos.set({ ...this.accesos(), [id]: 'cargando' });
    this.service.accesos(id).subscribe({
      next: r => this.accesos.set({ ...this.accesos(), [id]: r.data }),
      error: () => this.accesos.set({ ...this.accesos(), [id]: [] }),
    });
  }

  /** Refresca las bitácoras abiertas (p. ej., tras un correo de prueba). */
  private recargarAccesos(): void {
    Object.keys(this.accesos()).forEach(id => this.cargarAccesos(Number(id)));
  }
}
