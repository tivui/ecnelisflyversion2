import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { FeaturedSoundService } from '../../../../core/services/featured-sound.service';
import {
  FeaturedSoundCandidate,
  DailyFeaturedSound,
} from '../../../../core/models/featured-sound.model';
import { FeaturedSoundDialogComponent } from './featured-sound-dialog/featured-sound-dialog.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-featured-sound',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatSlideToggleModule,
    TranslateModule,
  ],
  templateUrl: './featured-sound.component.html',
  styleUrl: './featured-sound.component.scss',
})
export class FeaturedSoundComponent implements OnInit {
  private readonly featuredSoundService = inject(FeaturedSoundService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  candidates = signal<FeaturedSoundCandidate[]>([]);
  dailyFeatured = signal<DailyFeaturedSound | null>(null);
  loading = signal(true);
  displayedColumns = ['teasing', 'isActive', 'sortOrder', 'actions'];

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const [candidates, daily] = await Promise.all([
        this.featuredSoundService.listCandidates(),
        this.featuredSoundService.getTodayFeatured(),
      ]);
      this.candidates.set(candidates);
      this.dailyFeatured.set(daily);
    } catch (error) {
      console.error('Error loading featured sounds:', error);
    } finally {
      this.loading.set(false);
    }
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(FeaturedSoundDialogComponent, {
      width: '90vw',
      maxWidth: '700px',
      maxHeight: '90vh',
      data: { candidate: null },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadData();
      }
    });
  }

  openEditDialog(candidate: FeaturedSoundCandidate) {
    const dialogRef = this.dialog.open(FeaturedSoundDialogComponent, {
      width: '90vw',
      maxWidth: '700px',
      maxHeight: '90vh',
      data: { candidate },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadData();
      }
    });
  }

  async toggleActive(candidate: FeaturedSoundCandidate) {
    try {
      await this.featuredSoundService.updateCandidate(candidate.id!, {
        isActive: !candidate.isActive,
      });
      this.loadData();
    } catch (error) {
      console.error('Error toggling candidate:', error);
    }
  }

  async deleteCandidate(candidate: FeaturedSoundCandidate) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.featuredSound.deleteConfirm'),
        message: this.translate.instant('admin.featuredSound.deleteConfirm'),
        confirmText: this.translate.instant('common.action.save'),
        cancelText: this.translate.instant('common.action.cancel'),
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.featuredSoundService.deleteCandidate(candidate.id!);
          this.snackBar.open(
            this.translate.instant('admin.featuredSound.deleteSuccess'),
            '',
            { duration: 3000 },
          );
          this.loadData();
        } catch (error) {
          console.error('Error deleting candidate:', error);
        }
      }
    });
  }

  getLocalizedTeasing(item: { teasing?: string; teasing_i18n?: Record<string, string> }): string {
    const lang = this.translate.currentLang;
    if (item.teasing_i18n && item.teasing_i18n[lang]) {
      return item.teasing_i18n[lang];
    }
    return item.teasing ?? '';
  }
}
