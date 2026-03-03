import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';

import type { AdminUser } from '../../services/user-management.service';

@Component({
    selector: 'app-merge-imported-dialog',
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        TranslateModule,
    ],
    template: `
    <h2 mat-dialog-title>
      {{ 'admin.users.merge.title' | translate: { username: data.sourceUser.username } }}
    </h2>

    <mat-dialog-content>
      <div class="sound-count-badge">
        <mat-icon>library_music</mat-icon>
        {{ 'admin.users.merge.soundCount' | translate: { count: data.sourceUser.soundCount } }}
      </div>

      <p class="merge-hint">
        {{ 'admin.users.merge.hint' | translate }}
      </p>

      <!-- Search field -->
      <mat-form-field appearance="outline" class="search-field">
        <mat-label>{{ 'admin.users.merge.searchPlaceholder' | translate }}</mat-label>
        <input
          matInput
          [(ngModel)]="searchTermValue"
          (input)="filterUsers()"
        />
        <mat-icon matPrefix>search</mat-icon>
        @if (searchTermValue) {
          <button matSuffix mat-icon-button (click)="searchTermValue = ''; filterUsers()">
            <mat-icon>close</mat-icon>
          </button>
        }
      </mat-form-field>

      @if (filteredUsers().length === 0) {
        <div class="no-results">
          <mat-icon>person_off</mat-icon>
          <span>{{ 'admin.users.merge.noResults' | translate }}</span>
        </div>
      }

      @if (filteredUsers().length > 0) {
        <div class="results-list">
          @for (user of filteredUsers(); track user.id) {
            <div
              class="user-result"
              [class.selected]="selectedUserId() === user.id"
              (click)="selectUser(user)"
            >
              <div class="user-info">
                @if (getFlagPath(user.country); as flagPath) {
                  <img
                    class="flag"
                    [src]="flagPath"
                    [alt]="user.country"
                    (error)="$any($event.target).style.display='none'"
                  />
                }
                <span class="user-name">{{ user.username }}</span>
                <span class="user-sounds">{{ user.soundCount }} {{ 'admin.users.table.sounds' | translate }}</span>
              </div>
              <mat-icon class="check-icon" [class.visible]="selectedUserId() === user.id">
                check_circle
              </mat-icon>
            </div>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">
        {{ 'admin.users.merge.cancel' | translate }}
      </button>
      <button
        mat-raised-button
        color="warn"
        [disabled]="!selectedUserId()"
        (click)="confirm()"
      >
        <mat-icon>merge_type</mat-icon>
        {{ 'admin.users.merge.confirm' | translate }}
      </button>
    </mat-dialog-actions>
  `,
    styles: [`
    mat-dialog-content {
      min-height: 200px;
    }

    .sound-count-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
      background: rgba(255, 152, 0, 0.08);
      color: #e65100;
      margin-bottom: 12px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      :host-context(body.dark-theme) & {
        background: rgba(255, 152, 0, 0.15);
        color: #ffb74d;
      }
    }

    .merge-hint {
      font-size: 0.82rem;
      color: #888;
      margin: 0 0 16px;
      line-height: 1.4;

      :host-context(body.dark-theme) & {
        color: #777;
      }
    }

    .search-field {
      width: 100%;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }

    .no-results {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 24px;
      color: #999;

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
      }

      :host-context(body.dark-theme) & {
        color: #666;
      }
    }

    .results-list {
      max-height: 250px;
      overflow-y: auto;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;

      :host-context(body.dark-theme) & {
        border-color: rgba(255, 255, 255, 0.08);
      }
    }

    .user-result {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      &.selected {
        background: rgba(255, 152, 0, 0.06);
      }

      :host-context(body.dark-theme) & {
        &:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        &.selected {
          background: rgba(255, 152, 0, 0.10);
        }
      }

      & + .user-result {
        border-top: 1px solid rgba(0, 0, 0, 0.05);

        :host-context(body.dark-theme) & {
          border-top-color: rgba(255, 255, 255, 0.05);
        }
      }
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;

      .flag {
        width: 20px;
        height: 14px;
        object-fit: cover;
        border-radius: 2px;
        flex-shrink: 0;
      }

      .user-name {
        font-weight: 600;
        color: #333;
        white-space: nowrap;

        :host-context(body.dark-theme) & {
          color: #e8e8f0;
        }
      }

      .user-sounds {
        font-size: 0.78rem;
        color: #999;
        white-space: nowrap;

        :host-context(body.dark-theme) & {
          color: #777;
        }
      }
    }

    .check-icon {
      color: #ff9800;
      opacity: 0;
      transition: opacity 0.15s;

      &.visible {
        opacity: 1;
      }
    }

    mat-dialog-actions button mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 4px;
    }
  `]
})
export class MergeImportedDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<MergeImportedDialogComponent>);
  readonly data: { sourceUser: AdminUser; importedUsers: AdminUser[] } = inject(MAT_DIALOG_DATA);

  searchTermValue = '';
  selectedUserId = signal<string | null>(null);

  private selectedUsername = '';

  /** All imported users except the source user */
  private readonly availableUsers = computed(() =>
    this.data.importedUsers.filter(u => u.id !== this.data.sourceUser.id)
  );

  filteredUsers = signal<AdminUser[]>([]);

  constructor() {
    setTimeout(() => this.filteredUsers.set(this.availableUsers()));
  }

  filterUsers() {
    const term = this.searchTermValue.trim().toLowerCase();
    if (!term) {
      this.filteredUsers.set(this.availableUsers());
    } else {
      this.filteredUsers.set(
        this.availableUsers().filter(u =>
          u.username.toLowerCase().includes(term)
        )
      );
    }
  }

  selectUser(user: AdminUser) {
    this.selectedUserId.set(user.id);
    this.selectedUsername = user.username;
  }

  getFlagPath(country?: string): string | null {
    if (!country) return null;
    const code = country.trim();
    if (code.length < 2 || code.length > 3) return null;
    return `/img/flags/${code.toUpperCase()}.png`;
  }

  confirm() {
    if (this.selectedUserId()) {
      this.dialogRef.close({
        targetUserId: this.selectedUserId(),
        targetUsername: this.selectedUsername,
      });
    }
  }

  cancel() {
    this.dialogRef.close(null);
  }
}
