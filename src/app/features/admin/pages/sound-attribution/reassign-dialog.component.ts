import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AmplifyService } from '../../../../core/services/amplify.service';
import type { SoundUser } from './sound-attribution.component';

interface UserResult {
  id: string;
  username: string;
  email: string;
  country?: string;
}

@Component({
    selector: 'app-reassign-dialog',
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        TranslateModule,
    ],
    template: `
    <h2 mat-dialog-title>
      {{ 'admin.soundAttribution.dialog.title' | translate: { username: data.sourceUser.username } }}
    </h2>

    <mat-dialog-content>
      <div class="sound-count-badge">
        <mat-icon>library_music</mat-icon>
        {{ 'admin.soundAttribution.dialog.soundCount' | translate: { count: data.sourceUser.soundCount } }}
      </div>

      <div class="search-row">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>{{ 'admin.soundAttribution.dialog.searchPlaceholder' | translate }}</mat-label>
          <input
            matInput
            [(ngModel)]="searchTermValue"
            (keydown.enter)="search()"
          />
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>
        <button
          mat-raised-button
          color="primary"
          (click)="search()"
          [disabled]="searching() || !searchTermValue.trim()"
        >
          @if (searching()) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            {{ 'admin.soundAttribution.dialog.search' | translate }}
          }
        </button>
      </div>

      @if (hasSearched() && searchResults().length === 0 && !searching()) {
        <div class="no-results">
          <mat-icon>person_off</mat-icon>
          <span>{{ 'admin.soundAttribution.dialog.noResults' | translate }}</span>
        </div>
      }

      @if (searchResults().length > 0) {
        <div class="results-list">
          @for (user of searchResults(); track user.id) {
            <div
              class="user-result"
              [class.selected]="selectedUserId() === user.id"
              (click)="selectUser(user)"
            >
              <div class="user-info">
                @if (user.country) {
                  <img
                    class="flag"
                    [src]="'/img/flags/' + user.country.toUpperCase() + '.png'"
                    [alt]="user.country"
                    (error)="$any($event.target).style.display='none'"
                  />
                }
                <span class="user-name">{{ user.username }}</span>
                <span class="user-email">{{ user.email }}</span>
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
        {{ 'admin.soundAttribution.dialog.cancel' | translate }}
      </button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="!selectedUserId()"
        (click)="confirm()"
      >
        <mat-icon>swap_horiz</mat-icon>
        {{ 'admin.soundAttribution.dialog.confirm' | translate }}
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
      background: rgba(25, 118, 210, 0.08);
      color: #1976d2;
      margin-bottom: 16px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      :host-context(body.dark-theme) & {
        background: rgba(144, 202, 249, 0.12);
        color: #90caf9;
      }
    }

    .search-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 8px;

      .search-field {
        flex: 1;
      }

      button {
        margin-top: 4px;
        min-width: 110px;
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
        background: rgba(25, 118, 210, 0.06);
      }

      :host-context(body.dark-theme) & {
        &:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        &.selected {
          background: rgba(144, 202, 249, 0.08);
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

      .user-email {
        font-size: 0.8rem;
        color: #999;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        :host-context(body.dark-theme) & {
          color: #777;
        }
      }
    }

    .check-icon {
      color: #4caf50;
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
export class ReassignDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ReassignDialogComponent>);
  private readonly amplifyService = inject(AmplifyService);
  readonly data: { sourceUser: SoundUser } = inject(MAT_DIALOG_DATA);

  searchTermValue = '';
  searching = signal(false);
  hasSearched = signal(false);
  searchResults = signal<UserResult[]>([]);
  selectedUserId = signal<string | null>(null);

  private selectedUsername = '';

  async search() {
    const term = this.searchTermValue.trim();
    if (!term) return;

    this.searching.set(true);
    this.hasSearched.set(true);
    this.selectedUserId.set(null);

    try {
      const result: any = await this.amplifyService.client.models.User.list({
        filter: { username: { contains: term } },
        limit: 50,
        selectionSet: ['id', 'username', 'email', 'country'],
      });

      const users: UserResult[] = (result.data ?? [])
        .filter((u: any) => {
          if (!u) return false;
          // Exclude imported and merged users
          if (u.email?.startsWith('imported_')) return false;
          if (u.email?.startsWith('merged_')) return false;
          return true;
        })
        .map((u: any) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          country: u.country ?? undefined,
        }));

      this.searchResults.set(users);
    } catch (error) {
      console.error('Error searching users:', error);
      this.searchResults.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  selectUser(user: UserResult) {
    this.selectedUserId.set(user.id);
    this.selectedUsername = user.username;
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
