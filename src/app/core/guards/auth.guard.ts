import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * (02-oct-2026) Antes bastaba con que existiera un token en localStorage,
 * aunque estuviera vencido desde hacía días: se "entraba" sin contraseña y la
 * pantalla se quedaba cargando. Ahora:
 *  - sin token → login;
 *  - token vigente → pasa;
 *  - token vencido → se intenta renovar UNA vez; si no se puede → login.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  if (!auth.tokenVencido()) {
    return true;
  }

  return auth.refreshToken().pipe(
    map(() => true),
    catchError(() => {
      auth.clearLocalSession();
      return of(router.createUrlTree(['/login']));
    }),
  );
};
