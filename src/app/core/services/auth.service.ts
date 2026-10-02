import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, throwError } from 'rxjs';
import type { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type {
  LandlordAdmin,
  LandlordAuthResponse,
  LandlordLoginRequest,
} from '../models/tenant.model';

const TOKEN_KEY  = 'kernia_admin_token';
const USER_KEY   = 'kernia_admin_user';
const EXPIRY_KEY = 'kernia_admin_token_expiry';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);

  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private _user  = signal<LandlordAdmin | null>(this.parseStoredUser());

  readonly token       = this._token.asReadonly();
  readonly currentUser = this._user.asReadonly();
  readonly isLoggedIn  = computed(() => !!this._token());

  login(credentials: LandlordLoginRequest): Observable<LandlordAuthResponse> {
    return this.http
      .post<LandlordAuthResponse>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(
        tap(res => this.saveSession(res)),
        catchError(err => throwError(() => err)),
      );
  }

  logout(): void {
    if (this._token()) {
      this.http
        .post(`${environment.apiUrl}/auth/logout`, {})
        .subscribe({ error: () => {} });
    }
    this.clearLocalSession();
    this.router.navigate(['/login']);
  }

  refreshToken(): Observable<{ access_token: string; token_type: string; expires_in: number }> {
    return this.http
      .post<{ access_token: string; token_type: string; expires_in: number }>(
        `${environment.apiUrl}/auth/refresh`, {}
      )
      .pipe(
        tap(res => {
          this._token.set(res.access_token);
          localStorage.setItem(TOKEN_KEY, res.access_token);
          const expiry = Math.floor(Date.now() / 1000) + res.expires_in;
          localStorage.setItem(EXPIRY_KEY, String(expiry));
        }),
      );
  }

  /** (02-oct-2026) "Olvidé mi contraseña": Kernia envía una nueva al correo del operador. */
  solicitarPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/password/solicitar`, { email });
  }

  getToken(): string | null {
    return this._token();
  }

  /**
   * (02-oct-2026) El token guardado ya venció según la fecha que se guarda al
   * iniciar sesión. Antes nadie la consultaba: un token de hace días bastaba
   * para "entrar" sin contraseña.
   */
  tokenVencido(): boolean {
    const expiry = Number(localStorage.getItem(EXPIRY_KEY) ?? 0);
    return !expiry || Math.floor(Date.now() / 1000) >= expiry;
  }

  /** Sesión inválida o vencida sin posibilidad de renovar: limpia y va al login sin llamar al servidor. */
  expirarSesion(): void {
    this.clearLocalSession();
    this.router.navigate(['/login']);
  }

  clearLocalSession(): void {
    this._token.set(null);
    this._user.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  }

  private saveSession(res: LandlordAuthResponse): void {
    this._token.set(res.access_token);
    this._user.set(res.user);
    const expiry = Math.floor(Date.now() / 1000) + res.expires_in;
    localStorage.setItem(TOKEN_KEY, res.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    localStorage.setItem(EXPIRY_KEY, String(expiry));
  }

  private parseStoredUser(): LandlordAdmin | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as LandlordAdmin) : null;
    } catch {
      return null;
    }
  }
}
