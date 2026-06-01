import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-alert-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-modal.component.html',
  styleUrl: './alert-modal.component.css',
})
export class AlertModalComponent {
  @Input() open = false;
  @Input() title = 'Notificación';
  @Input() message = '';
  @Input() buttonText = 'Aceptar';
  @Input() variant: 'success' | 'warning' = 'success';

  @Output() accepted = new EventEmitter<void>();
}

