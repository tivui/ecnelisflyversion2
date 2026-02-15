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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';

import { SoundJourneyService } from '../../../../core/services/sound-journey.service';
import { SoundJourney } from '../../../../core/models/sound-journey.model';
import { JourneyDialogComponent } from './journey-dialog/journey-dialog.component';
import { JourneyStepsDialogComponent } from './journey-steps-dialog/journey-steps-dialog.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-journeys',
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
    TranslateModule,
    RouterLink,
  ],
  templateUrl: './journeys.component.html',
  styleUrl: './journeys.component.scss',
})
export class JourneysComponent implements OnInit {
  private readonly journeyService = inject(SoundJourneyService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  journeys = signal<SoundJourney[]>([]);
  loading = signal(true);
  displayedColumns = ['name', 'slug', 'isPublic', 'sortOrder', 'actions'];

  ngOnInit() {
    this.loadJourneys();
  }

  async loadJourneys() {
    this.loading.set(true);
    try {
      const journeys = await this.journeyService.listJourneys();
      this.journeys.set(journeys.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    } catch (error) {
      console.error('Error loading journeys:', error);
      this.snackBar.open(
        this.translate.instant('admin.journeys.loadError'),
        this.translate.instant('common.action.cancel'),
        { duration: 3000 }
      );
    } finally {
      this.loading.set(false);
    }
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(JourneyDialogComponent, {
      width: '90vw',
      maxWidth: '900px',
      maxHeight: '90vh',
      data: { journey: null },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadJourneys();
      }
    });
  }

  openEditDialog(journey: SoundJourney) {
    const dialogRef = this.dialog.open(JourneyDialogComponent, {
      width: '90vw',
      maxWidth: '900px',
      maxHeight: '90vh',
      data: { journey },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadJourneys();
      }
    });
  }

  openStepsDialog(journey: SoundJourney) {
    const dialogRef = this.dialog.open(JourneyStepsDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      data: { journey },
    });

    dialogRef.afterClosed().subscribe(() => {
      // No need to reload journeys, just steps association
    });
  }

  async deleteJourney(journey: SoundJourney) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.journeys.delete.title'),
        message: this.translate.instant('admin.journeys.delete.message', {
          name: journey.name,
        }),
        confirmText: this.translate.instant('admin.journeys.delete.confirm'),
        cancelText: this.translate.instant('common.action.cancel'),
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.journeyService.deleteJourney(journey.id!);
          this.snackBar.open(
            this.translate.instant('admin.journeys.delete.success'),
            '',
            { duration: 3000 }
          );
          this.loadJourneys();
        } catch (error) {
          console.error('Error deleting journey:', error);
          this.snackBar.open(
            this.translate.instant('admin.journeys.delete.error'),
            '',
            { duration: 3000 }
          );
        }
      }
    });
  }

  async setAsMonthly(journey: SoundJourney) {
    try {
      await this.journeyService.setMonthlyJourney(journey);
      this.snackBar.open(
        this.translate.instant('admin.journeys.monthlySet'),
        '',
        { duration: 3000 },
      );
    } catch (error) {
      console.error('Error setting monthly journey:', error);
    }
  }

  previewOnMap(journey: SoundJourney) {
    window.open(`/mapfly?journeyMode=true&journeyId=${journey.id}`, '_blank');
  }

  getLocalizedName(journey: SoundJourney): string {
    const lang = this.translate.currentLang;
    if (journey.name_i18n && journey.name_i18n[lang]) {
      return journey.name_i18n[lang];
    }
    return journey.name;
  }
}
