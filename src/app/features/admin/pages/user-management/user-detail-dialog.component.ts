import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import { AdminUser } from '../../services/user-management.service';

@Component({
  selector: 'app-user-detail-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'admin.users.detail.title' | translate }}</h2>

    <mat-dialog-content>
      <div class="user-header">
        <img class="avatar" [src]="data.avatarUri" alt="" />
        <div class="user-name">
          <strong>{{ user.username }}</strong>
          @if (user.firstName || user.lastName) {
            <span class="real-name">{{ user.firstName }} {{ user.lastName }}</span>
          }
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Email</span>
          <span class="detail-value monospace">{{ user.email }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">{{ 'admin.users.detail.country' | translate }}</span>
          <span class="detail-value">{{ user.country || '—' }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">{{ 'admin.users.detail.sounds' | translate }}</span>
          <span class="detail-value">{{ user.soundCount }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">{{ 'admin.users.detail.likedSounds' | translate }}</span>
          <span class="detail-value">{{ likedCount }}</span>
        </div>

        <div class="detail-item full">
          <span class="detail-label">{{ 'admin.users.detail.provider' | translate }}</span>
          <span class="detail-value">{{ user.cognitoProvider || '—' }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">{{ 'admin.users.detail.cognitoStatus' | translate }}</span>
          <span class="detail-value">{{ user.cognitoStatus || '—' }}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">{{ 'admin.users.detail.enabled' | translate }}</span>
          <span class="detail-value">
            @if (user.cognitoEnabled === true) {
              <mat-icon class="status-icon active">check_circle</mat-icon>
            } @else if (user.cognitoEnabled === false) {
              <mat-icon class="status-icon disabled">block</mat-icon>
            } @else {
              —
            }
          </span>
        </div>

        <div class="detail-item full">
          <span class="detail-label">{{ 'admin.users.detail.groups' | translate }}</span>
          <span class="detail-value">
            @if ((user.cognitoGroups ?? []).length > 0) {
              {{ user.cognitoGroups!.join(', ') }}
            } @else {
              —
            }
          </span>
        </div>

        <div class="detail-item full">
          <span class="detail-label">{{ 'admin.users.detail.registrationDate' | translate }}</span>
          <span class="detail-value">{{ user.cognitoCreatedAt ? (user.cognitoCreatedAt | date:'medium') : '—' }}</span>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'admin.users.detail.close' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .user-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }

    .avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      object-fit: cover;
    }

    .user-name {
      display: flex;
      flex-direction: column;

      strong { font-size: 1.1rem; }

      .real-name {
        font-size: 0.85rem;
        color: #888;
      }
    }

    :host-context(body.dark-theme) {
      .user-name .real-name { color: #777; }
    }

    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.02);
      border-radius: 10px;
      border: 1px solid rgba(0, 0, 0, 0.05);
    }

    :host-context(body.dark-theme) .detail-grid {
      background: rgba(255, 255, 255, 0.03);
      border-color: rgba(255, 255, 255, 0.06);
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 2px;

      &.full { grid-column: 1 / -1; }
    }

    .detail-label {
      font-size: 0.7rem;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    :host-context(body.dark-theme) .detail-label { color: #7a7f9e; }

    .detail-value {
      font-size: 0.88rem;
      color: #333;

      &.monospace {
        font-family: monospace;
        font-size: 0.82rem;
      }
    }

    :host-context(body.dark-theme) .detail-value { color: #c5cae9; }

    .status-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;

      &.active { color: #4caf50; }
      &.disabled { color: #c62828; }
    }

    :host-context(body.dark-theme) .status-icon {
      &.active { color: #81c784; }
      &.disabled { color: #ef5350; }
    }
  `],
})
export class UserDetailDialogComponent {
  data = inject<{ user: AdminUser; avatarUri: string }>(MAT_DIALOG_DATA);

  get user(): AdminUser {
    return this.data.user;
  }

  get likedCount(): number {
    if (!this.user.likedSoundIds) return 0;
    try {
      const arr = JSON.parse(this.user.likedSoundIds);
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  }
}
