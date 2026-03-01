import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TranslateModule } from '@ngx-translate/core';

import { AdminUser } from '../../services/user-management.service';

@Component({
  selector: 'app-delete-user-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title class="delete-title">
      <mat-icon>warning</mat-icon>
      {{ 'admin.users.deleteDialog.title' | translate }}
    </h2>

    <mat-dialog-content>
      <p class="delete-message">
        {{ 'admin.users.deleteDialog.message' | translate:{ username: user.username } }}
      </p>

      @if (user.soundCount > 0) {
        <mat-checkbox
          [checked]="deleteSounds()"
          (change)="deleteSounds.set($event.checked)"
        >
          {{ 'admin.users.deleteDialog.deleteSounds' | translate:{ count: user.soundCount } }}
        </mat-checkbox>
      }

      <p class="delete-warning">
        {{ 'admin.users.deleteDialog.warning' | translate }}
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>
        {{ 'admin.users.deleteDialog.cancel' | translate }}
      </button>
      <button mat-flat-button color="warn" (click)="confirm()">
        {{ 'admin.users.deleteDialog.confirm' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .delete-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #c62828;

      mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
    }

    :host-context(body.dark-theme) .delete-title {
      color: #ef5350;
    }

    .delete-message {
      font-size: 0.92rem;
      color: #333;
      margin-bottom: 16px;
    }

    :host-context(body.dark-theme) .delete-message {
      color: #c5cae9;
    }

    .delete-warning {
      margin-top: 16px;
      font-size: 0.82rem;
      color: #c62828;
      font-weight: 500;
    }

    :host-context(body.dark-theme) .delete-warning {
      color: #ef5350;
    }

    mat-checkbox {
      display: block;
      margin: 8px 0;
    }
  `],
})
export class DeleteUserDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DeleteUserDialogComponent>);
  private readonly dialogData = inject<{ user: AdminUser }>(MAT_DIALOG_DATA);

  deleteSounds = signal(false);

  get user(): AdminUser {
    return this.dialogData.user;
  }

  confirm() {
    this.dialogRef.close({
      confirmed: true,
      deleteSounds: this.deleteSounds(),
    });
  }
}
