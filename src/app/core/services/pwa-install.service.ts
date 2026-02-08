import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private deferredPrompt: any = null;

  /** true when the browser offers an install prompt */
  readonly canInstall = signal(false);

  /** true after the user dismissed the banner */
  readonly dismissed = signal(false);

  /** true if the app is already running in standalone mode */
  readonly isStandalone = signal(false);

  private readonly DISMISS_KEY = 'pwa-install-dismissed';
  private readonly DISMISS_DAYS = 14;

  constructor() {
    // Check if already in standalone mode (installed)
    this.isStandalone.set(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );

    // Check if previously dismissed (within cooldown)
    const dismissedAt = localStorage.getItem(this.DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < this.DISMISS_DAYS * 24 * 60 * 60 * 1000) {
        this.dismissed.set(true);
      } else {
        localStorage.removeItem(this.DISMISS_KEY);
      }
    }

    // Listen for the install prompt event
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.canInstall.set(true);
    });

    // Detect when app gets installed
    window.addEventListener('appinstalled', () => {
      this.canInstall.set(false);
      this.deferredPrompt = null;
    });
  }

  /** Trigger the native install prompt */
  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) return false;

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall.set(false);

    return outcome === 'accepted';
  }

  /** Dismiss the banner for DISMISS_DAYS */
  dismiss(): void {
    this.dismissed.set(true);
    localStorage.setItem(this.DISMISS_KEY, Date.now().toString());
  }
}
