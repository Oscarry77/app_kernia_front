import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * (02-oct-2026) Un 401 de las rutas de autenticación NO dispara otro refresh:
 * antes, con un token vencido y un refresh también rechazado, el refresh se
 * reintentaba a sí mismo sin fin (cientos de /auth/refresh por segundo) y la
 * pantalla se quedaba en "Cargando…". Si el refresh falla, se limpia la
 * sesión local y se va al login.
 */
const RUTAS_AUTH = ['/auth/login', '/auth/refresh', '/auth/logout'];

export const jwtInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const esRutaAuth = RUTAS_AUTH.some(ruta => req.url.includes(ruta));

  const authReq = token ? addToken(req, token) : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || !token || esRutaAuth) {
        return throwError(() => err);
      }

      return authService.refreshToken().pipe(
        switchMap(res => next(addToken(req, res.access_token))),
        catchError(refreshErr => {
          authService.expirarSesion();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}
