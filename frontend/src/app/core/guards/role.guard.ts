import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Rol } from '../models/auth.model';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const deshabilitada = Boolean(route.data?.['disabled']);
  if (deshabilitada) {
    router.navigate([authService.resolveHomeByRole()]);
    return false;
  }

  const roles = (route.data?.['roles'] as Rol[] | undefined) ?? [];

  if (roles.length === 0 || authService.hasRole(roles)) {
    return true;
  }

  router.navigate([authService.resolveHomeByRole()]);
  return false;
};
