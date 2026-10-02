import { Component, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private fb     = inject(FormBuilder);
  private auth   = inject(AuthService);
  private router = inject(Router);

  loading      = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/tenants']);
    }
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;

    this.errorMessage.set(null);
    this.loading.set(true);

    const { email, password } = this.form.getRawValue();

    this.auth.login({ email: email!, password: password! }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/tenants']);
      },
      error: (err) => {
        this.loading.set(false);
        const msg =
          err?.error?.message ??
          'No se pudo iniciar sesión. Verifica tus datos.';
        this.errorMessage.set(msg);
      },
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  /**
   * (02-oct-2026) "Solicitar cambio de contraseña":
   *  1. Advertencia con Aceptar / Cancelar (y el correo, prellenado si ya se escribió).
   *  2. Aceptar → Kernia genera una contraseña segura de 18 caracteres y la
   *     envía al correo del operador.
   *  3. Confirmación de que llegará al correo.
   * La respuesta es la misma exista o no la cuenta (no se revela qué correos son de operadores).
   */
  async solicitarCambioPassword(): Promise<void> {
    const emailActual = (this.emailCtrl.value ?? '').trim();

    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: 'Solicitar cambio de contraseña',
      html:
        'Se generará una <b>nueva contraseña</b> y se enviará por correo electrónico.<br>' +
        'La contraseña actual dejará de funcionar.',
      input: 'email',
      inputLabel: 'Correo de tu cuenta de Kernia',
      inputValue: emailActual,
      inputPlaceholder: 'admin@kernia.mx',
      validationMessage: 'Escribe un correo válido.',
      showCancelButton: true,
      confirmButtonText: 'Aceptar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#C2661D',
      reverseButtons: true,
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: (email: string) =>
        firstValueFrom(this.auth.solicitarPassword(email)).catch((err: HttpErrorResponse) => {
          const msg =
            err.status === 429
              ? 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
              : err.error?.message ?? 'No se pudo procesar la solicitud. Intenta más tarde.';
          Swal.showValidationMessage(msg);
          return false;
        }),
    });

    if (!confirmacion.isConfirmed || !confirmacion.value) {
      return; // Cancelar: solo se cierra.
    }

    await Swal.fire({
      icon: 'success',
      title: 'Solicitud enviada',
      text: confirmacion.value.message,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#C2661D',
    });
  }

  get emailCtrl()    { return this.form.get('email')!; }
  get passwordCtrl() { return this.form.get('password')!; }

  get emailError(): string | null {
    if (!this.emailCtrl.touched) return null;
    if (this.emailCtrl.hasError('required')) return 'El email es requerido.';
    if (this.emailCtrl.hasError('email'))    return 'Email inválido.';
    return null;
  }

  get passwordError(): string | null {
    if (!this.passwordCtrl.touched) return null;
    if (this.passwordCtrl.hasError('required'))  return 'La contraseña es requerida.';
    if (this.passwordCtrl.hasError('minlength')) return 'Mínimo 6 caracteres.';
    return null;
  }
}
