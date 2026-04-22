import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LoginRequest,
  LoginResponse,
  Rol,
  UsuarioSesion,
} from '../models/auth.model';

const TOKEN_KEY = 'cm_token';
const USER_KEY = 'cm_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly userSubject = new BehaviorSubject<UsuarioSesion | null>(null);
  private readonly tokenSubject = new BehaviorSubject<string | null>(null);

  readonly user$ = this.userSubject.asObservable();

  constructor(private readonly http: HttpClient) {
    this.initialize();
  }

  initialize(): void {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);

    if (token && rawUser) {
      try {
        const user = JSON.parse(rawUser) as UsuarioSesion;
        this.userSubject.next(user);
        this.tokenSubject.next(token);
      } catch (_error) {
        this.clearSession();
      }
    }
  }

  login(payload: LoginRequest): Observable<UsuarioSesion> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/auth/login`, payload)
      .pipe(
        tap((response) => {
          this.tokenSubject.next(response.accessToken);
          this.userSubject.next(response.user);
          localStorage.setItem(TOKEN_KEY, response.accessToken);
          localStorage.setItem(USER_KEY, JSON.stringify(response.user));
        }),
        map((response) => response.user),
      );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/auth/logout`, {}).pipe(
      catchError(() => of(void 0)),
      tap(() => this.clearSession()),
    );
  }

  me(): Observable<UsuarioSesion | null> {
    return this.http.get<UsuarioSesion>(`${this.apiUrl}/auth/me`).pipe(
      tap((user) => {
        this.userSubject.next(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }),
      map((user) => user ?? null),
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
    );
  }

  get token(): string | null {
    return this.tokenSubject.value;
  }

  get currentUser(): UsuarioSesion | null {
    return this.userSubject.value;
  }

  isAuthenticated(): boolean {
    return Boolean(this.tokenSubject.value);
  }

  hasRole(roles: Rol[]): boolean {
    const rol = this.userSubject.value?.rol;
    return rol ? roles.includes(rol) : false;
  }

  resolveHomeByRole(): string {
    const rol = this.userSubject.value?.rol;

    if (rol === 'ADMINISTRADOR') {
      return '/dashboard';
    }

    if (rol === 'CONSULTA') {
      return '/consulta';
    }

    return '/casos';
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.tokenSubject.next(null);
    this.userSubject.next(null);
  }
}
