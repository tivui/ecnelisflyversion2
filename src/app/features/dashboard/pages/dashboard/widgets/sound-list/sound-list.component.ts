import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  OnDestroy,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

import { Sound, SoundStatus } from '../../../../../../core/models/sound.model';
import { DashboardService } from '../../../../services/dashboard.service';
import { SoundCardComponent } from '../sound-card/sound-card.component';
import { DeleteConfirmDialogComponent } from '../delete-confirm-dialog/delete-confirm-dialog.component';
import { SoundEditDialogComponent } from '../sound-edit-dialog/sound-edit-dialog.component';
import { MAP_QUERY_KEYS } from '../../../../../../core/models/map.model';
import { LikeButtonComponent } from '../../../../../../shared/components/like-button/like-button.component';

@Component({
  selector: 'app-sound-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatChipsModule,
    MatTooltipModule,
    TranslateModule,
    SoundCardComponent,
    LikeButtonComponent,
  ],
  templateUrl: './sound-list.component.html',
  styleUrl: './sound-list.component.scss',
})
export class SoundListComponent implements OnInit, OnDestroy, OnChanges {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly dashboardService = inject(DashboardService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  @Input() sounds: Sound[] = [];
  @Input() isAdmin = false;
  @Input() showUserColumn = false;

  @Output() soundUpdated = new EventEmitter<Sound>();
  @Output() soundDeleted = new EventEmitter<Sound>();

  // Signals
  isMobile = signal(false);
  playingSound = signal<string | null>(null);
  currentAudio = signal<HTMLAudioElement | null>(null);

  // Pagination
  pageSize = 10;
  pageIndex = 0;
  pageSizeOptions = [5, 10, 25, 50];

  // Sorting
  sortedData: Sound[] = [];

  // Table columns
  get displayedColumns(): string[] {
    const cols = ['title', 'category', 'status', 'city', 'date', 'likes', 'actions'];
    if (this.showUserColumn) {
      cols.splice(1, 0, 'user');
    }
    return cols;
  }

  ngOnInit() {
    // Watch for breakpoint changes
    this.breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        this.isMobile.set(result.matches);
      });

    this.sortedData = [...this.sounds];
  }

  ngOnChanges(changes: SimpleChanges) {
    // Update sortedData when sounds input changes
    if (changes['sounds'] && !changes['sounds'].firstChange) {
      this.sortedData = [...this.sounds];
      // Reset to first page when data changes
      this.pageIndex = 0;
    }
  }

  ngOnDestroy() {
    this.stopAudio();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Get current language for display
  get currentLang(): string {
    return this.translate.currentLang || 'fr';
  }

  // Get display title in current language
  getDisplayTitle(sound: Sound): string {
    return sound.title_i18n?.[this.currentLang] || sound.title || '';
  }

  // Get display category
  getDisplayCategory(sound: Sound): string {
    if (!sound.category) return '-';
    const key = sound.secondaryCategory
      ? `categories.${sound.category}.${sound.secondaryCategory}`
      : `categories.${sound.category}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : sound.category;
  }

  // Get category image URL based on secondary category
  getCategoryImageUrl(sound: Sound): string | null {
    const categoryKey = sound.secondaryCategory || sound.category;
    if (!categoryKey) return null;
    return `img/backgrounds/categories/fond_${categoryKey}.jpg`;
  }

  // Get status chip color
  getStatusColor(status: SoundStatus | undefined): string {
    switch (status) {
      case 'public':
        return 'primary';
      case 'public_to_be_approved':
        return 'accent';
      case 'private':
        return 'warn';
      default:
        return '';
    }
  }

  // Get status display text
  getStatusText(status: SoundStatus | undefined): string {
    if (!status) return '-';
    return this.translate.instant(`dashboard.status.${status}`);
  }

  // Format date for display
  formatDate(date: Date | undefined): string {
    if (!date) return '-';
    return new Intl.DateTimeFormat(this.currentLang, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  // Pagination
  get paginatedSounds(): Sound[] {
    const start = this.pageIndex * this.pageSize;
    return this.sortedData.slice(start, start + this.pageSize);
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  // Sorting
  sortData(sort: Sort) {
    const data = [...this.sounds];

    if (!sort.active || sort.direction === '') {
      this.sortedData = data;
      return;
    }

    this.sortedData = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'title':
          return this.compare(
            this.getDisplayTitle(a),
            this.getDisplayTitle(b),
            isAsc,
          );
        case 'category':
          return this.compare(a.category || '', b.category || '', isAsc);
        case 'status':
          return this.compare(a.status || '', b.status || '', isAsc);
        case 'city':
          return this.compare(a.city || '', b.city || '', isAsc);
        case 'date':
          return this.compare(
            a.recordDateTime?.getTime() || 0,
            b.recordDateTime?.getTime() || 0,
            isAsc,
          );
        case 'user':
          return this.compare(
            a.user?.username || '',
            b.user?.username || '',
            isAsc,
          );
        default:
          return 0;
      }
    });
  }

  private compare(a: string | number, b: string | number, isAsc: boolean) {
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
  }

  // Audio preview
  async playAudio(sound: Sound) {
    // Stop current audio if playing
    if (this.playingSound() === sound.id) {
      this.stopAudio();
      return;
    }

    this.stopAudio();

    try {
      const url = await this.dashboardService.getAudioUrl(sound);
      const audio = new Audio(url);

      audio.onended = () => {
        this.playingSound.set(null);
        this.currentAudio.set(null);
      };

      audio.onerror = () => {
        this.snackBar.open(
          this.translate.instant('dashboard.audioError'),
          'OK',
          { duration: 3000 },
        );
        this.playingSound.set(null);
        this.currentAudio.set(null);
      };

      this.currentAudio.set(audio);
      this.playingSound.set(sound.id || null);
      await audio.play();
    } catch (err) {
      console.error('[SoundList] Failed to play audio:', err);
      this.snackBar.open(
        this.translate.instant('dashboard.audioError'),
        'OK',
        { duration: 3000 },
      );
    }
  }

  stopAudio() {
    const audio = this.currentAudio();
    if (audio) {
      audio.pause();
      // Remove event listeners before clearing src to avoid triggering error event
      audio.onended = null;
      audio.onerror = null;
      audio.src = '';
      audio.load(); // Reset the audio element
    }
    this.playingSound.set(null);
    this.currentAudio.set(null);
  }

  isPlaying(sound: Sound): boolean {
    return this.playingSound() === sound.id;
  }

  // Actions
  openEditDialog(sound: Sound) {
    const dialogRef = this.dialog.open(SoundEditDialogComponent, {
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { sound },
      panelClass: 'sound-edit-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((updatedSound: Sound | undefined) => {
      if (updatedSound) {
        this.soundUpdated.emit(updatedSound);
        this.snackBar.open(
          this.translate.instant('dashboard.edit.saveSuccess'),
          'OK',
          { duration: 3000 },
        );
      }
    });
  }

  confirmDelete(sound: Sound) {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '400px',
      data: { sound },
    });

    dialogRef.afterClosed().subscribe(async (confirmed: boolean) => {
      if (confirmed) {
        try {
          await this.dashboardService.deleteSound(sound);
          this.soundDeleted.emit(sound);
          this.snackBar.open(
            this.translate.instant('dashboard.delete.success'),
            'OK',
            { duration: 3000 },
          );
        } catch (err) {
          console.error('[SoundList] Failed to delete sound:', err);
          this.snackBar.open(
            this.translate.instant('dashboard.delete.error'),
            'OK',
            { duration: 5000 },
          );
        }
      }
    });
  }

  viewOnMap(sound: Sound) {
    if (sound.latitude && sound.longitude) {
      this.router.navigate(['/mapfly'], {
        queryParams: {
          [MAP_QUERY_KEYS.lat]: sound.latitude.toFixed(4),
          [MAP_QUERY_KEYS.lng]: sound.longitude.toFixed(4),
          [MAP_QUERY_KEYS.zoom]: 16,
          [MAP_QUERY_KEYS.basemap]: 'mapbox',
        },
      });
    }
  }

  // Track by function for ngFor
  trackBySound(index: number, sound: Sound): string {
    return sound.id || index.toString();
  }
}
