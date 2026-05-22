import { Directive, ElementRef, HostListener, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

@Directive({
  selector: 'input[appProgressivePasswordMask]',
  standalone: true,
})
export class ProgressivePasswordMaskDirective implements OnChanges, OnDestroy {
  @Input('appProgressivePasswordMask') maskEnabled = true;
  @Input() appProgressivePasswordMaskDelay = 800;

  private maskTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly elementRef: ElementRef<HTMLInputElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['maskEnabled']) {
      this.applyMode();
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  @HostListener('input')
  onInput(): void {
    if (!this.maskEnabled) {
      return;
    }

    this.revealTemporarily();
  }

  @HostListener('blur')
  onBlur(): void {
    if (!this.maskEnabled) {
      return;
    }

    this.clearTimer();
    this.setType('password');
  }

  private applyMode(): void {
    this.clearTimer();
    this.setType(this.maskEnabled ? 'password' : 'text');
  }

  private revealTemporarily(): void {
    this.clearTimer();
    this.setType('text');

    this.maskTimer = setTimeout(() => {
      if (this.maskEnabled) {
        this.setType('password');
      }
    }, Math.max(300, this.appProgressivePasswordMaskDelay));
  }

  private setType(type: 'text' | 'password'): void {
    const input = this.elementRef.nativeElement;
    if (input.type !== type) {
      input.type = type;
    }
  }

  private clearTimer(): void {
    if (this.maskTimer) {
      clearTimeout(this.maskTimer);
      this.maskTimer = null;
    }
  }
}
