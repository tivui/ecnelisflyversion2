import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AmplifyService } from '../../../../core/services/amplify.service';
import { ReassignDialogComponent } from './reassign-dialog.component';

export type UserType = 'imported' | 'registered';

export interface SoundUser {
  id: string;
  username: string;
  email: string;
  country?: string;
  soundCount: number;
  type: UserType;
}

@Component({
    selector: 'app-sound-attribution',
    imports: [
        CommonModule,
        FormsModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatChipsModule,
        MatFormFieldModule,
        MatInputModule,
        TranslateModule,
    ],
    templateUrl: './sound-attribution.component.html',
    styleUrl: './sound-attribution.component.scss'
})
export class SoundAttributionComponent implements OnInit {
  private readonly amplifyService = inject(AmplifyService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  // Data
  allUsers = signal<SoundUser[]>([]);
  loading = signal(true);
  reassigning = signal<string | null>(null);

  // Filters
  searchTerm = signal('');
  typeFilter = signal<'all' | 'imported' | 'registered'>('all');
  sortBy = signal<'username' | 'sounds'>('sounds');
  sortDirection = signal<'asc' | 'desc'>('desc');

  // Computed filtered/sorted list
  filteredUsers = computed(() => {
    let users = this.allUsers();

    // Type filter
    const type = this.typeFilter();
    if (type !== 'all') {
      users = users.filter((u) => u.type === type);
    }

    // Search filter
    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      users = users.filter(
        (u) =>
          u.username.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term),
      );
    }

    // Sort
    const sort = this.sortBy();
    const dir = this.sortDirection();
    users = [...users].sort((a, b) => {
      let cmp: number;
      if (sort === 'username') {
        cmp = a.username.localeCompare(b.username);
      } else {
        cmp = a.soundCount - b.soundCount;
      }
      return dir === 'asc' ? cmp : -cmp;
    });

    return users;
  });

  // Counters for filter chips
  importedCount = computed(
    () => this.allUsers().filter((u) => u.type === 'imported').length,
  );
  registeredCount = computed(
    () => this.allUsers().filter((u) => u.type === 'registered').length,
  );

  displayedColumns = ['username', 'email', 'type', 'sounds', 'actions'];

  searchTermValue = '';

  ngOnInit() {
    this.loadAllUsers();
  }

  async loadAllUsers() {
    this.loading.set(true);
    try {
      // Fetch ALL users (paginated)
      const rawUsers: any[] = [];
      let nextToken: string | null | undefined = undefined;

      do {
        const page: any = await this.amplifyService.client.models.User.list({
          limit: 500,
          nextToken: nextToken ?? undefined,
          selectionSet: ['id', 'username', 'email', 'country'],
        });

        rawUsers.push(...(page.data ?? []));
        nextToken = page.nextToken ?? null;
      } while (nextToken);

      // Filter out neutralized/merged users
      const activeUsers = rawUsers.filter(
        (u) => u && !u.email?.startsWith('merged_'),
      );

      // Count sounds for each user
      const usersWithSounds: SoundUser[] = [];

      for (const user of activeUsers) {
        let soundCount = 0;
        let soundToken: string | null | undefined = undefined;

        do {
          const soundPage: any =
            await this.amplifyService.client.models.Sound.listSoundsByUserAndStatus(
              { userId: user.id },
              {
                limit: 500,
                nextToken: soundToken ?? undefined,
                selectionSet: ['id'],
              },
            );

          soundCount += (soundPage.data ?? []).length;
          soundToken = soundPage.nextToken ?? null;
        } while (soundToken);

        if (soundCount > 0) {
          const isImported = user.email?.startsWith('imported_') ?? false;
          usersWithSounds.push({
            id: user.id,
            username: user.username,
            email: user.email,
            country: user.country ?? undefined,
            soundCount,
            type: isImported ? 'imported' : 'registered',
          });
        }
      }

      this.allUsers.set(usersWithSounds);
    } catch (error) {
      console.error('Error loading users:', error);
      this.snackBar.open(
        this.translate.instant('admin.soundAttribution.loadError'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.loading.set(false);
    }
  }

  onSearchInput() {
    this.searchTerm.set(this.searchTermValue);
  }

  setTypeFilter(type: 'all' | 'imported' | 'registered') {
    this.typeFilter.set(type);
  }

  toggleSort(column: 'username' | 'sounds') {
    if (this.sortBy() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDirection.set(column === 'username' ? 'asc' : 'desc');
    }
  }

  openReassignDialog(user: SoundUser) {
    const dialogRef = this.dialog.open(ReassignDialogComponent, {
      width: '90vw',
      maxWidth: '550px',
      maxHeight: '90vh',
      data: { sourceUser: user },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result?.targetUserId) {
        await this.reassignSounds(
          user,
          result.targetUserId,
          result.targetUsername,
        );
      }
    });
  }

  private async reassignSounds(
    sourceUser: SoundUser,
    targetUserId: string,
    targetUsername: string,
  ) {
    this.reassigning.set(sourceUser.id);
    try {
      // Step 1: Collect ALL sound IDs first (full pagination)
      // Important: do NOT update during pagination — updating userId moves
      // items out of the GSI partition, causing nextToken to skip entries.
      const allSoundIds: string[] = [];
      let nextToken: string | null | undefined = undefined;

      do {
        const page: any =
          await this.amplifyService.client.models.Sound.listSoundsByUserAndStatus(
            { userId: sourceUser.id },
            {
              limit: 500,
              nextToken: nextToken ?? undefined,
              selectionSet: ['id'],
            },
          );

        for (const sound of page.data ?? []) {
          if (sound?.id) allSoundIds.push(sound.id);
        }
        nextToken = page.nextToken ?? null;
      } while (nextToken);

      // Step 2: Transfer all collected sounds
      let transferred = 0;
      for (const soundId of allSoundIds) {
        try {
          await this.amplifyService.client.models.Sound.update({
            id: soundId,
            userId: targetUserId,
          });
          transferred++;
        } catch {
          // Skip failed transfer
        }
      }

      // Neutralize only imported users (not real accounts)
      if (sourceUser.type === 'imported') {
        try {
          await this.amplifyService.client.models.User.update({
            id: sourceUser.id,
            email: `merged_${sourceUser.id}@deleted`,
            cognitoSub: `merged_${sourceUser.id}`,
          });
        } catch {
          // Neutralize failed — sounds are already transferred
        }
      }

      this.snackBar.open(
        this.translate.instant('admin.soundAttribution.success', {
          count: transferred,
          username: targetUsername,
        }),
        '',
        { duration: 4000 },
      );

      await this.loadAllUsers();
    } catch (error) {
      console.error('Error reassigning sounds:', error);
      this.snackBar.open(
        this.translate.instant('admin.soundAttribution.error'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.reassigning.set(null);
    }
  }

  getFlagPath(country?: string): string | null {
    if (!country) return null;
    const code = country.trim();
    if (code.length < 2 || code.length > 3) return null;
    return `/img/flags/${code.toUpperCase()}.png`;
  }
}
