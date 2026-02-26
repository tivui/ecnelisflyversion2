import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';

const SESSION_KEY = 'ecnelis_headphone_shown';

/**
 * Shows a one-time-per-session snackbar reminding users to wear headphones
 * for the best listening experience.
 */
@Injectable({ providedIn: 'root' })
export class HeadphoneReminderService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  showIfNeeded(): void {
    if (typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    sessionStorage.setItem(SESSION_KEY, '1');

    const msg = this.translate.instant('player.headphoneReminder');
    const action = this.translate.instant('player.headphoneReminderAction');

    this.snackBar.open(msg, action, {
      duration: 6000,
      panelClass: ['headphone-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
