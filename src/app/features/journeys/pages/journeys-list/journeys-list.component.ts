import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRippleModule } from '@angular/material/core';

import { SoundJourneyService } from '../../../../core/services/sound-journey.service';
import { SoundJourney } from '../../../../core/models/sound-journey.model';

@Component({
  selector: 'app-journeys-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatRippleModule,
  ],
  templateUrl: './journeys-list.component.html',
  styleUrl: './journeys-list.component.scss',
})
export class JourneysListComponent implements OnInit {
  private readonly journeyService = inject(SoundJourneyService);
  private readonly translate = inject(TranslateService);

  journeys = signal<SoundJourney[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.loadJourneys();
  }

  async loadJourneys() {
    this.loading.set(true);
    try {
      const journeys = await this.journeyService.listPublicJourneys();
      this.journeys.set(journeys);
    } catch (error) {
      console.error('Error loading journeys:', error);
    } finally {
      this.loading.set(false);
    }
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
}
