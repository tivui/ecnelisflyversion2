import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRippleModule } from '@angular/material/core';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';

import { SoundJourneyService } from '../../../../core/services/sound-journey.service';
import { SoundJourney } from '../../../../core/models/sound-journey.model';
import { RandomJourneySheetComponent } from './random-journey-sheet/random-journey-sheet.component';

@Component({
    selector: 'app-journeys-list',
    imports: [
        CommonModule,
        RouterLink,
        TranslateModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatRippleModule,
        MatBottomSheetModule,
    ],
    templateUrl: './journeys-list.component.html',
    styleUrl: './journeys-list.component.scss'
})
export class JourneysListComponent implements OnInit {
  private readonly journeyService = inject(SoundJourneyService);
  private readonly translate = inject(TranslateService);
  private readonly bottomSheet = inject(MatBottomSheet);

  journeys = signal<SoundJourney[]>([]);
  loading = signal(true);
  coverImageUrls = signal<Map<string, string>>(new Map());

  ngOnInit() {
    this.loadJourneys();
  }

  async loadJourneys() {
    this.loading.set(true);
    try {
      const journeys = await this.journeyService.listPublicJourneys();
      this.journeys.set(journeys);

      // Resolve cover image URLs
      const urlMap = new Map<string, string>();
      await Promise.allSettled(
        journeys
          .filter((j) => j.coverImage)
          .map(async (j) => {
            try {
              const url = await this.journeyService.getJourneyFileUrl(j.coverImage!);
              urlMap.set(j.id!, url);
            } catch {
              // Ignore failed URL resolutions
            }
          })
      );
      this.coverImageUrls.set(urlMap);
    } catch (error) {
      console.error('Error loading journeys:', error);
    } finally {
      this.loading.set(false);
    }
  }

  getCoverImageUrl(journey: SoundJourney): string | undefined {
    return this.coverImageUrls().get(journey.id!);
  }

  journeyName(journey: SoundJourney): string {
    const lang = this.translate.currentLang;
    if (journey.name_i18n && journey.name_i18n[lang]) {
      return journey.name_i18n[lang];
    }
    return journey.name;
  }

  journeyDescription(journey: SoundJourney): string {
    const lang = this.translate.currentLang;
    if (journey.description_i18n && journey.description_i18n[lang]) {
      return journey.description_i18n[lang];
    }
    return journey.description ?? '';
  }

  goToJourney(journey: SoundJourney) {
    const params = new URLSearchParams({
      journeyMode: 'true',
      journeyId: journey.id ?? '',
    });
    window.location.href = `/mapfly?${params.toString()}`;
  }

  openRandomJourney() {
    this.bottomSheet.open(RandomJourneySheetComponent, {
      panelClass: 'random-journey-sheet-panel',
    });
  }
}
