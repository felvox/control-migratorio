import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  MasterCandidate,
  Rol,
  TransferMasterRequest,
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
  private readonly storage =
    typeof window !== 'undefined' ? window.sessionStorage : null;

  readonly user$ = this.userSubject.asObservable();

  constructor(private readonly http: HttpClient) {
    this.initialize();
  }

  initialize(): void {
    this.clearLegacyLocalAuth();

    const token = this.getItem(TOKEN_KEY);
    const rawUser = this.getItem(USER_KEY);

    if (token && rawUser) {
      try {
        const userRaw = JSON.parse(rawUser) as Partial<UsuarioSesion>;
        const user: UsuarioSesion = {
          id: userRaw.id ?? '',
          run: userRaw.run ?? '',
          nombreCompleto: userRaw.nombreCompleto ?? '',
          rol: (userRaw.rol as UsuarioSesion['rol']) ?? 'CONSULTA',
          esMaster: Boolean(userRaw.esMaster),
          jaf: userRaw.jaf ?? null,
        };
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
          this.setItem(TOKEN_KEY, response.accessToken);
          this.setItem(USER_KEY, JSON.stringify(response.user));
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
        this.setItem(USER_KEY, JSON.stringify(user));
      }),
      map((user) => user ?? null),
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
    );
  }

  changePassword(payload: ChangePasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/change-password`, payload);
  }

  listMasterCandidates(): Observable<MasterCandidate[]> {
    return this.http.get<MasterCandidate[]>(`${this.apiUrl}/auth/master-candidates`);
  }

  transferMaster(payload: TransferMasterRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/transfer-master`, payload);
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

    if (rol === 'AUDITOR') {
      return '/casos';
    }

    return '/casos';
  }

  private clearSession(): void {
    this.removeItem(TOKEN_KEY);
    this.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.tokenSubject.next(null);
    this.userSubject.next(null);
  }

  private clearLegacyLocalAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  private getItem(key: string): string | null {
    if (!this.storage) {
      return null;
    }

    return this.storage.getItem(key);
  }

  private setItem(key: string, value: string): void {
    if (!this.storage) {
      return;
    }

    this.storage.setItem(key, value);
  }

  private removeItem(key: string): void {
    if (!this.storage) {
      return;
    }

    this.storage.removeItem(key);
  }
}
