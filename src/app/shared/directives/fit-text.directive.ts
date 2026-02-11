import { Directive, ElementRef, AfterViewInit, OnDestroy, input } from '@angular/core';

@Directive({
  selector: '[appFitText]',
  standalone: true,
})
export class FitTextDirective implements AfterViewInit, OnDestroy {
  maxFontSize = input(32, { alias: 'fitTextMax' });
  minFontSize = input(14, { alias: 'fitTextMin' });

  private resizeObserver!: ResizeObserver;
  private mutationObserver!: MutationObserver;
  private el: HTMLElement;

  constructor(elRef: ElementRef<HTMLElement>) {
    this.el = elRef.nativeElement;
  }

  ngAfterViewInit(): void {
    this.el.style.whiteSpace = 'nowrap';
    this.el.style.overflow = 'hidden';

    this.fit();

    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.resizeObserver.observe(this.el.parentElement!);

    this.mutationObserver = new MutationObserver(() => this.fit());
    this.mutationObserver.observe(this.el, { childList: true, characterData: true, subtree: true });
  }

  private fit(): void {
    const parent = this.el.parentElement;
    if (!parent) return;

    const maxWidth = parent.clientWidth - parseFloat(getComputedStyle(parent).paddingLeft) - parseFloat(getComputedStyle(parent).paddingRight);
    if (maxWidth <= 0) return;

    let lo = this.minFontSize();
    let hi = this.maxFontSize();

    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2;
      this.el.style.fontSize = `${mid}px`;
      if (this.el.scrollWidth > maxWidth) {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    this.el.style.fontSize = `${lo}px`;
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
  }
}
