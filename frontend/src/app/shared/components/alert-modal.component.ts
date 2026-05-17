import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-alert-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="alert-backdrop" *ngIf="open">
      <section class="alert-card" role="alertdialog" aria-modal="true" [attr.aria-label]="title || 'Notificación'">
        <div class="alert-icon" [class.alert-icon-warning]="variant === 'warning'" aria-hidden="true">
          {{ variant === 'warning' ? '!' : '✓' }}
        </div>
        <div class="alert-content">
          <h4>{{ title }}</h4>
          <p>{{ message }}</p>
        </div>
        <div class="alert-actions">
          <button type="button" class="btn-primary" (click)="accepted.emit()">
            {{ buttonText }}
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .alert-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(10, 21, 34, 0.45);
        display: grid;
        place-items: center;
        padding: 1rem;
        z-index: 1300;
      }

      .alert-card {
        width: min(420px, 100%);
        background: #ffffff;
        border: 1px solid #d7e0ea;
        border-radius: 12px;
        box-shadow: 0 18px 48px rgba(10, 29, 54, 0.24);
        padding: 1rem;
        display: grid;
        gap: 0.75rem;
      }

      .alert-icon {
        width: 36px;
        height: 36px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: #e8f6ee;
        color: #1c7a4a;
        font-weight: 700;
      }

      .alert-icon-warning {
        background: #fff4e2;
        color: #9a5c00;
      }

      .alert-content h4 {
        margin: 0;
        font-size: 1.03rem;
        color: #1f3146;
      }

      .alert-content p {
        margin: 0.3rem 0 0;
        color: #4c6178;
      }

      .alert-actions {
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class AlertModalComponent {
  @Input() open = false;
  @Input() title = 'Notificación';
  @Input() message = '';
  @Input() buttonText = 'Aceptar';
  @Input() variant: 'success' | 'warning' = 'success';

  @Output() accepted = new EventEmitter<void>();
}

