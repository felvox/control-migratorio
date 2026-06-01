import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SessionIdleService } from '../services/session-idle.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const sessionIdleService = inject(SessionIdleService);
  const token = authService.token;
  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        authService.isAuthenticated() &&
        !req.url.includes('/auth/login')
      ) {
        sessionIdleService.expirarSesionPorBackend();
      }

      return throwError(() => error);
    }),
  );
};
