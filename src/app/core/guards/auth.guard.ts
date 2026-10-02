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

/**
 * (02-oct-2026) Fase 3: la ruta exige un permiso del rol. Si el perfil
 * guardado no trae permisos, se consulta a Kernia antes de decidir. Sin
 * permiso → Clientes. Kernia vuelve a validar cada petición (403).
 */
export function permisoGuard(permiso: string): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const decidir = () => (auth.puede(permiso) ? true : router.createUrlTree(['/clientes']));

    if (auth.perfilCargado()) {
      return decidir();
    }
    return auth.cargarPerfil().pipe(
      map(decidir),
      catchError(() => of(router.createUrlTree(['/clientes']))),
    );
  };
}
