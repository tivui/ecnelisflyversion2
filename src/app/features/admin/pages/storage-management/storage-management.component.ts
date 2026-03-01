import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { NgClass, DatePipe, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Color, NgxChartsModule } from '@swimlane/ngx-charts';
import { ScaleType } from '@swimlane/ngx-charts';

import {
  StorageManagementService,
  StorageFileEntry,
  BrokenReference,
  StorageStats,
} from '../../services/storage-management.service';
import { StorageService } from '../../../../core/services/storage.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

type FormatFilter = 'all' | 'mp3' | 'wav' | 'ogg' | 'flac' | 'aac' | 'm4a' | 'webm' | 'opus';
type StatusFilter = 'all' | 'linked' | 'orphan';
type SizeFilter = 'all' | 'small' | 'medium' | 'large';
type SortField = 'name' | 'size' | 'date';

@Component({
  selector: 'app-storage-management',
  imports: [
    NgClass,
    DatePipe,
    KeyValuePipe,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
    TranslateModule,
    NgxChartsModule,
  ],
  templateUrl: './storage-management.component.html',
  styleUrl: './storage-management.component.scss',
})
export class StorageManagementComponent implements OnInit {
  private readonly storageManagement = inject(StorageManagementService);
  private readonly storageService = inject(StorageService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  // Data
  files = signal<StorageFileEntry[]>([]);
  brokenRefs = signal<BrokenReference[]>([]);
  stats = signal<StorageStats | null>(null);
  loading = signal(true);
  actionInProgress = signal<string | null>(null);

  // Audio player
  playingFile = signal<string | null>(null);
  audioUrl = signal<string | null>(null);

  // Filters
  searchTerm = signal('');
  formatFilter = signal<FormatFilter>('all');
  statusFilter = signal<StatusFilter>('all');
  sizeFilter = signal<SizeFilter>('all');
  sortBy = signal<SortField>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');

  // Search binding
  searchTermValue = '';

  // Table columns
  displayedColumns = ['filename', 'format', 'size', 'date', 'linkedSound', 'actions'];

  // Computed
  filteredFiles = computed(() => {
    let result = this.files();
    const fmt = this.formatFilter();
    const status = this.statusFilter();
    const size = this.sizeFilter();
    const term = this.searchTerm().toLowerCase();
    const sort = this.sortBy();
    const dir = this.sortDirection();

    if (fmt !== 'all') {
      result = result.filter((f) => f.format === fmt);
    }

    if (status === 'linked') {
      result = result.filter((f) => !!f.linkedSound);
    } else if (status === 'orphan') {
      result = result.filter((f) => !f.linkedSound);
    }

    if (size === 'small') {
      result = result.filter((f) => f.size < 1e6);
    } else if (size === 'medium') {
      result = result.filter((f) => f.size >= 1e6 && f.size < 10e6);
    } else if (size === 'large') {
      result = result.filter((f) => f.size >= 10e6);
    }

    if (term) {
      result = result.filter(
        (f) =>
          f.filename.toLowerCase().includes(term) ||
          (f.linkedSound?.title?.toLowerCase().includes(term) ?? false) ||
          (f.linkedSound?.username?.toLowerCase().includes(term) ?? false),
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sort === 'name') cmp = a.filename.localeCompare(b.filename);
      else if (sort === 'size') cmp = a.size - b.size;
      else cmp = a.lastModified.getTime() - b.lastModified.getTime();
      return dir === 'asc' ? cmp : -cmp;
    });

    return result;
  });

  orphanFiles = computed(() => this.files().filter((f) => !f.linkedSound));

  formatCounts = computed(() => {
    const map = new Map<string, number>();
    for (const f of this.files()) {
      const fmt = f.format || 'other';
      map.set(fmt, (map.get(fmt) ?? 0) + 1);
    }
    return map;
  });

  linkedCount = computed(() => this.files().filter((f) => !!f.linkedSound).length);
  orphanCount = computed(() => this.files().filter((f) => !f.linkedSound).length);

  // Chart color schemes
  formatColorScheme: Color = {
    name: 'formatColors',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#1976d2', '#7e57c2', '#4caf50', '#ff9800', '#00897b', '#5c6bc0', '#9e9e9e'],
  };

  sizeColorScheme: Color = {
    name: 'sizeColors',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#f44336'],
  };

  categoryColorScheme: Color = {
    name: 'categoryColors',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: [
      '#5BBF8A', '#D97BD5', '#D4A05C', '#D4A3CC', '#8C8C8C',
      '#C04040', '#5A9FD4', '#B06B35', '#C8B840', '#9e9e9e',
    ],
  };

  timelineColorScheme: Color = {
    name: 'timelineColors',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#1976d2'],
  };

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const result = await this.storageManagement.loadAll();
      this.files.set(result.files);
      this.brokenRefs.set(result.brokenRefs);
      this.stats.set(result.stats);
    } catch (e) {
      console.error('[StorageManagement] Load failed:', e);
      this.snackBar.open(
        this.translate.instant('admin.storage.loadError'),
        undefined,
        { duration: 3000 },
      );
    } finally {
      this.loading.set(false);
    }
  }

  // Filter methods
  onSearchInput() {
    this.searchTerm.set(this.searchTermValue);
  }

  setFormatFilter(fmt: FormatFilter) {
    this.formatFilter.set(this.formatFilter() === fmt ? 'all' : fmt);
  }

  setStatusFilter(status: StatusFilter) {
    this.statusFilter.set(this.statusFilter() === status ? 'all' : status);
  }

  setSizeFilter(size: SizeFilter) {
    this.sizeFilter.set(this.sizeFilter() === size ? 'all' : size);
  }

  toggleSort(field: SortField) {
    if (this.sortBy() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(field);
      this.sortDirection.set(field === 'name' ? 'asc' : 'desc');
    }
  }

  // Actions
  async playFile(file: StorageFileEntry) {
    if (this.playingFile() === file.filename) {
      this.playingFile.set(null);
      this.audioUrl.set(null);
      return;
    }
    try {
      const url = await this.storageService.getSoundUrl(file.filename);
      this.audioUrl.set(url);
      this.playingFile.set(file.filename);
    } catch {
      this.snackBar.open('Error loading audio', undefined, { duration: 2000 });
    }
  }

  async deleteOrphan(file: StorageFileEntry) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.storage.actions.deleteTitle'),
        message: this.translate.instant('admin.storage.actions.deleteMessage', {
          filename: file.filename,
          size: this.formatBytes(file.size),
        }),
        confirmText: this.translate.instant('admin.storage.actions.delete'),
      } as ConfirmDialogData,
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      this.actionInProgress.set(file.filename);
      try {
        await this.storageManagement.deleteOrphan(file.filename);
        this.snackBar.open(
          this.translate.instant('admin.storage.deleteSuccess'),
          undefined,
          { duration: 3000 },
        );
        await this.loadData();
      } catch {
        this.snackBar.open('Error', undefined, { duration: 3000 });
      } finally {
        this.actionInProgress.set(null);
      }
    });
  }

  async deleteAllOrphans() {
    const orphans = this.orphanFiles();
    if (orphans.length === 0) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.storage.integrity.orphans.cleanAllTitle'),
        message: this.translate.instant('admin.storage.integrity.orphans.cleanAllMessage', {
          count: orphans.length,
          size: this.formatBytes(this.stats()?.orphanSize ?? 0),
        }),
        confirmText: this.translate.instant('admin.storage.integrity.orphans.cleanAll'),
        confirmColor: 'warn',
      } as ConfirmDialogData,
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      this.actionInProgress.set('bulk-delete');
      let deleted = 0;
      for (const file of orphans) {
        try {
          await this.storageManagement.deleteOrphan(file.filename);
          deleted++;
        } catch {
          console.warn(`Failed to delete orphan: ${file.filename}`);
        }
      }
      this.snackBar.open(
        this.translate.instant('admin.storage.cleanAllSuccess', { count: deleted }),
        undefined,
        { duration: 3000 },
      );
      this.actionInProgress.set(null);
      await this.loadData();
    });
  }

  async deleteBrokenRef(ref: BrokenReference) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.storage.actions.deleteRefTitle'),
        message: this.translate.instant('admin.storage.actions.deleteRefMessage', {
          title: ref.title,
        }),
        confirmText: this.translate.instant('admin.storage.actions.delete'),
      } as ConfirmDialogData,
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      this.actionInProgress.set(ref.soundId);
      try {
        await this.storageManagement.deleteBrokenRef(ref.soundId);
        this.snackBar.open(
          this.translate.instant('admin.storage.deleteRefSuccess'),
          undefined,
          { duration: 3000 },
        );
        await this.loadData();
      } catch {
        this.snackBar.open('Error', undefined, { duration: 3000 });
      } finally {
        this.actionInProgress.set(null);
      }
    });
  }

  // Utilities
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'Ko', 'Mo', 'Go', 'To'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  formatCost(cost: number): string {
    return cost < 0.01 ? '< $0.01' : `$${cost.toFixed(2)}`;
  }

  getFormatBadgeClass(format: string): string {
    const map: Record<string, string> = {
      mp3: 'fmt-mp3',
      wav: 'fmt-wav',
      ogg: 'fmt-ogg',
      flac: 'fmt-flac',
      aac: 'fmt-aac',
      m4a: 'fmt-aac',
      webm: 'fmt-web',
      opus: 'fmt-web',
    };
    return map[format] ?? 'fmt-other';
  }

  exportCsv() {
    const files = this.filteredFiles();
    const headers = ['Filename', 'Format', 'Size (bytes)', 'Size', 'Date', 'Linked Sound', 'Status', 'Category'];
    const rows = files.map((f) => [
      f.filename,
      f.format.toUpperCase(),
      f.size,
      this.formatBytes(f.size),
      f.lastModified.toISOString(),
      f.linkedSound?.title ?? 'Orphan',
      f.linkedSound?.status ?? '',
      f.linkedSound?.category ?? '',
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecnelisfly-storage-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
