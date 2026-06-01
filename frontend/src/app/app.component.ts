import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionIdleService } from './core/services/session-idle.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent {
  constructor(_sessionIdleService: SessionIdleService) {}
}
