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
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../../../core/services/auth.service';
import { AvatarService } from '../../../../core/services/avatar.service';
import {
  UserManagementService,
  AdminUser,
  UserTypeFilter,
  UserStatusFilter,
  UserRoleFilter,
  SortField,
} from '../../services/user-management.service';
import { exportUsersCsv } from '../../services/csv-export.util';
import { UserDetailDialogComponent } from './user-detail-dialog.component';
import { DeleteUserDialogComponent } from './delete-user-dialog.component';

@Component({
  selector: 'app-user-management',
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
    MatMenuModule,
    TranslateModule,
  ],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss',
})
export class UserManagementComponent implements OnInit {
  private readonly userService = inject(UserManagementService);
  private readonly authService = inject(AuthService);
  private readonly avatarService = inject(AvatarService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  // Data
  allUsers = signal<AdminUser[]>([]);
  loading = signal(true);
  enriching = signal(false);
  actionInProgress = signal<string | null>(null);

  // Current user sub (for self-protection)
  currentUserSub = signal<string | null>(null);

  // Filters
  searchTerm = signal('');
  typeFilter = signal<UserTypeFilter>('all');
  statusFilter = signal<UserStatusFilter>('all');
  roleFilter = signal<UserRoleFilter>('all');
  sortBy = signal<SortField>('sounds');
  sortDirection = signal<'asc' | 'desc'>('desc');

  // Filtered + sorted list
  filteredUsers = computed(() => {
    let users = this.allUsers();

    const type = this.typeFilter();
    if (type === 'imported') {
      users = users.filter((u) => u.email.startsWith('imported_'));
    } else if (type === 'registered') {
      users = users.filter((u) => !u.email.startsWith('imported_'));
    }

    const status = this.statusFilter();
    if (status === 'active') {
      users = users.filter((u) => u.cognitoEnabled !== false);
    } else if (status === 'disabled') {
      users = users.filter((u) => u.cognitoEnabled === false);
    }

    const role = this.roleFilter();
    if (role === 'admin') {
      users = users.filter((u) => (u.cognitoGroups ?? []).includes('ADMIN'));
    } else if (role === 'user') {
      users = users.filter((u) => !(u.cognitoGroups ?? []).includes('ADMIN'));
    }

    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      users = users.filter(
        (u) =>
          u.username.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          (u.firstName ?? '').toLowerCase().includes(term) ||
          (u.lastName ?? '').toLowerCase().includes(term),
      );
    }

    const sort = this.sortBy();
    const dir = this.sortDirection();
    users = [...users].sort((a, b) => {
      let cmp: number;
      if (sort === 'username') {
        cmp = a.username.localeCompare(b.username);
      } else if (sort === 'sounds') {
        cmp = a.soundCount - b.soundCount;
      } else {
        const dateA = a.cognitoCreatedAt ?? '';
        const dateB = b.cognitoCreatedAt ?? '';
        cmp = dateA.localeCompare(dateB);
      }
      return dir === 'asc' ? cmp : -cmp;
    });

    return users;
  });

  // Counters
  totalCount = computed(() => this.allUsers().length);
  importedCount = computed(() => this.allUsers().filter((u) => u.email.startsWith('imported_')).length);
  registeredCount = computed(() => this.allUsers().filter((u) => !u.email.startsWith('imported_')).length);
  activeCount = computed(() => this.allUsers().filter((u) => u.cognitoEnabled !== false).length);
  disabledCount = computed(() => this.allUsers().filter((u) => u.cognitoEnabled === false).length);
  adminCount = computed(() => this.allUsers().filter((u) => (u.cognitoGroups ?? []).includes('ADMIN')).length);

  displayedColumns = ['avatar', 'username', 'email', 'type', 'status', 'role', 'sounds', 'date', 'actions'];

  searchTermValue = '';

  ngOnInit() {
    this.currentUserSub.set(this.authService.user()?.sub ?? null);
    this.loadUsers();
  }

  async loadUsers() {
    this.loading.set(true);
    try {
      const users = await this.userService.loadAllUsers();
      this.allUsers.set(users);

      // Enrich with Cognito data
      this.enriching.set(true);
      try {
        await this.userService.enrichWithCognitoData(users);
        this.allUsers.set([...users]); // trigger reactivity
      } catch {
        this.snackBar.open(
          this.translate.instant('admin.users.enrichError'),
          '',
          { duration: 3000 },
        );
      } finally {
        this.enriching.set(false);
      }
    } catch {
      this.snackBar.open(
        this.translate.instant('admin.users.loadError'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.loading.set(false);
    }
  }

  // Self-protection
  isSelf(user: AdminUser): boolean {
    return !!this.currentUserSub() && user.cognitoSub === this.currentUserSub();
  }

  isImported(user: AdminUser): boolean {
    return user.email.startsWith('imported_');
  }

  isAdmin(user: AdminUser): boolean {
    return (user.cognitoGroups ?? []).includes('ADMIN');
  }

  // Avatar
  getAvatarUri(user: AdminUser): string {
    let opts: Record<string, string> | null = null;
    if (user.avatarOptions && user.avatarOptions !== '{}') {
      try {
        opts = JSON.parse(user.avatarOptions);
      } catch {
        // ignore
      }
    }
    return this.avatarService.generateAvatarUri(
      user.avatarStyle,
      user.avatarSeed,
      user.username,
      user.avatarBgColor,
      opts,
    );
  }

  getFlagPath(country?: string): string | null {
    if (!country) return null;
    const code = country.trim();
    // Only standard ISO 2-3 letter codes have flag PNGs
    if (code.length < 2 || code.length > 3) return null;
    return `/img/flags/${code.toUpperCase()}.png`;
  }

  // Search
  onSearchInput() {
    this.searchTerm.set(this.searchTermValue);
  }

  // Filters
  setTypeFilter(type: UserTypeFilter) {
    this.typeFilter.set(type);
  }

  setStatusFilter(status: UserStatusFilter) {
    this.statusFilter.set(status);
  }

  setRoleFilter(role: UserRoleFilter) {
    this.roleFilter.set(role);
  }

  // Sort
  toggleSort(column: SortField) {
    if (this.sortBy() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDirection.set(column === 'username' ? 'asc' : 'desc');
    }
  }

  // CSV export
  exportCsv() {
    const date = new Date().toISOString().slice(0, 10);
    exportUsersCsv(this.filteredUsers(), `ecnelisfly-users-${date}.csv`);
  }

  // Actions
  viewDetails(user: AdminUser) {
    this.dialog.open(UserDetailDialogComponent, {
      width: '90vw',
      maxWidth: '550px',
      maxHeight: '90vh',
      data: { user, avatarUri: this.getAvatarUri(user) },
    });
  }

  private getCognitoUsername(user: AdminUser): string | null {
    if (user.cognitoUsername) return user.cognitoUsername;
    // Cognito data not enriched yet
    this.snackBar.open(
      this.translate.instant('admin.users.enrichError'),
      '',
      { duration: 3000 },
    );
    return null;
  }

  async disableUser(user: AdminUser) {
    if (this.isSelf(user)) return;
    const cognitoUsername = this.getCognitoUsername(user);
    if (!cognitoUsername) return;
    const confirmed = confirm(
      this.translate.instant('admin.users.disableConfirm', { username: user.username }),
    );
    if (!confirmed) return;

    this.actionInProgress.set(user.id);
    try {
      await this.userService.disableUser(cognitoUsername);
      user.cognitoEnabled = false;
      this.allUsers.set([...this.allUsers()]);
      this.snackBar.open(
        this.translate.instant('admin.users.disableSuccess'),
        '',
        { duration: 3000 },
      );
    } catch {
      this.snackBar.open(
        this.translate.instant('admin.users.actionError'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.actionInProgress.set(null);
    }
  }

  async enableUser(user: AdminUser) {
    if (this.isSelf(user)) return;
    const cognitoUsername = this.getCognitoUsername(user);
    if (!cognitoUsername) return;

    this.actionInProgress.set(user.id);
    try {
      await this.userService.enableUser(cognitoUsername);
      user.cognitoEnabled = true;
      this.allUsers.set([...this.allUsers()]);
      this.snackBar.open(
        this.translate.instant('admin.users.enableSuccess'),
        '',
        { duration: 3000 },
      );
    } catch {
      this.snackBar.open(
        this.translate.instant('admin.users.actionError'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.actionInProgress.set(null);
    }
  }

  async promoteAdmin(user: AdminUser) {
    if (this.isSelf(user)) return;
    const cognitoUsername = this.getCognitoUsername(user);
    if (!cognitoUsername) return;
    const confirmed = confirm(
      this.translate.instant('admin.users.promoteConfirm', { username: user.username }),
    );
    if (!confirmed) return;

    this.actionInProgress.set(user.id);
    try {
      await this.userService.addToAdminGroup(cognitoUsername);
      user.cognitoGroups = [...(user.cognitoGroups ?? []), 'ADMIN'];
      this.allUsers.set([...this.allUsers()]);
      this.snackBar.open(
        this.translate.instant('admin.users.promoteSuccess'),
        '',
        { duration: 3000 },
      );
    } catch {
      this.snackBar.open(
        this.translate.instant('admin.users.actionError'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.actionInProgress.set(null);
    }
  }

  async demoteAdmin(user: AdminUser) {
    if (this.isSelf(user)) return;
    const cognitoUsername = this.getCognitoUsername(user);
    if (!cognitoUsername) return;
    const confirmed = confirm(
      this.translate.instant('admin.users.demoteConfirm', { username: user.username }),
    );
    if (!confirmed) return;

    this.actionInProgress.set(user.id);
    try {
      await this.userService.removeFromAdminGroup(cognitoUsername);
      user.cognitoGroups = (user.cognitoGroups ?? []).filter((g) => g !== 'ADMIN');
      this.allUsers.set([...this.allUsers()]);
      this.snackBar.open(
        this.translate.instant('admin.users.demoteSuccess'),
        '',
        { duration: 3000 },
      );
    } catch {
      this.snackBar.open(
        this.translate.instant('admin.users.actionError'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.actionInProgress.set(null);
    }
  }

  deleteUser(user: AdminUser) {
    if (this.isSelf(user)) return;

    const dialogRef = this.dialog.open(DeleteUserDialogComponent, {
      width: '90vw',
      maxWidth: '480px',
      data: { user },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result?.confirmed) return;

      this.actionInProgress.set(user.id);
      try {
        // Delete sounds if requested
        if (result.deleteSounds && user.soundCount > 0) {
          await this.userService.deleteUserSounds(user.id);
        }

        // Delete Cognito account (if not imported)
        if (user.cognitoUsername && !this.isImported(user)) {
          await this.userService.deleteCognitoUser(user.cognitoUsername);
        }

        // Delete DynamoDB record
        await this.userService.deleteDynamoUser(user.id);

        this.snackBar.open(
          this.translate.instant('admin.users.deleteSuccess'),
          '',
          { duration: 3000 },
        );

        await this.loadUsers();
      } catch {
        this.snackBar.open(
          this.translate.instant('admin.users.actionError'),
          '',
          { duration: 3000 },
        );
      } finally {
        this.actionInProgress.set(null);
      }
    });
  }
}
