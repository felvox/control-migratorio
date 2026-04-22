import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home-redirect',
  standalone: true,
  template: '',
})
export class HomeRedirectComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  constructor() {
    this.router.navigate([this.authService.resolveHomeByRole()]);
  }
}
