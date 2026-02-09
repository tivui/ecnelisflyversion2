import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, inject, OnInit, signal, computed, NgZone, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

import { AppUserService } from '../../../../core/services/app-user.service';
import { AppUser } from '../../../../core/models/app-user.model';
import { ZoneService } from '../../../../core/services/zone.service';
import { Zone } from '../../../../core/models/zone.model';
import { FeaturedSoundService } from '../../../../core/services/featured-sound.service';
import { DailyFeaturedSound } from '../../../../core/models/featured-sound.model';
import { SoundJourneyService } from '../../../../core/services/sound-journey.service';
import { SoundJourney } from '../../../../core/models/sound-journey.model';
import { CarouselCategoriesComponent } from './widgets/carousel-categories/carousel-categories.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    RouterLink,
    MatIconModule,
    CarouselCategoriesComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HomeComponent implements OnInit {
  private readonly appUserService = inject(AppUserService);
  private readonly zoneService = inject(ZoneService);
  private readonly featuredSoundService = inject(FeaturedSoundService);
  private readonly soundJourneyService = inject(SoundJourneyService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  @ViewChild('secondaryScroll') secondaryScrollEl?: ElementRef<HTMLElement>;

  shimmerX = signal('-200%');
  hasScrolled = signal(false);
  scrollHintX = signal(0);

  appUser = toSignal<AppUser | null>(this.appUserService.currentUser$, {
    initialValue: null,
  });

  zones = signal<Zone[]>([]);
  dailyFeatured = signal<DailyFeaturedSound | null>(null);
  journeys = signal<SoundJourney[]>([]);

  private currentLang = toSignal(
    this.translate.onLangChange.pipe(map((e) => e.lang)),
    { initialValue: this.translate.currentLang },
  );

  teasingText = computed(() => {
    const daily = this.dailyFeatured();
    if (!daily) return '';
    const lang = this.currentLang();
    if (daily.teasing_i18n && daily.teasing_i18n[lang]) {
      return daily.teasing_i18n[lang];
    }
    return daily.teasing ?? '';
  });

  async ngOnInit() {
    const [zonesResult, dailyResult, journeysResult] = await Promise.allSettled([
      this.zoneService.listZones(),
      this.featuredSoundService.getTodayFeatured(),
      this.soundJourneyService.listPublicJourneys(),
    ]);

    if (zonesResult.status === 'fulfilled') {
      const publicZones = zonesResult.value
        .filter((z: Zone) => z.isPublic)
        .sort((a: Zone, b: Zone) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      this.zones.set(publicZones);
    }

    if (dailyResult.status === 'fulfilled') {
      this.dailyFeatured.set(dailyResult.value);
    }

    if (journeysResult.status === 'fulfilled') {
      this.journeys.set(journeysResult.value);
    }

    setTimeout(() => {
      if (this.secondaryScrollEl) {
        this.secondaryScrollEl.nativeElement.scrollLeft = 0;
      }
    });
  }

  journeyName(journey: SoundJourney): string {
    const lang = this.currentLang();
    if (journey.name_i18n && journey.name_i18n[lang]) {
      return journey.name_i18n[lang];
    }
    return journey.name;
  }

  journeyDescription(journey: SoundJourney): string {
    const lang = this.currentLang();
    if (journey.description_i18n && journey.description_i18n[lang]) {
      return journey.description_i18n[lang];
    }
    return journey.description ?? '';
  }

  goToJourney(journey: SoundJourney) {
    const params = new URLSearchParams({
      journeyMode: 'true',
      journeyId: journey.id!,
    });
    window.location.href = `/mapfly?${params.toString()}`;
  }

  onSecondaryScroll(event: Event) {
    const el = event.target as HTMLElement;
    if (!this.hasScrolled()) this.hasScrolled.set(true);
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;
    const ratio = el.scrollLeft / maxScroll;
    // Shimmer: map 0→1 to -200%→200%
    const pos = -200 + ratio * 400;
    this.shimmerX.set(`${pos}%`);
    // Scroll hint thumb: 0→32px (52px track - 20px thumb)
    this.scrollHintX.set(Math.round(ratio * 32));
  }

  goToFeaturedSound() {
    const daily = this.dailyFeatured();
    if (!daily) return;

    // Use window.location.href to force full component reload
    const params = new URLSearchParams({
      featuredMode: 'true',
      lat: String(daily.soundLatitude ?? ''),
      lng: String(daily.soundLongitude ?? ''),
      soundFilename: daily.soundFilename ?? '',
      soundTitle: daily.soundTitle ?? '',
      soundCity: daily.soundCity ?? '',
      soundCategory: daily.soundCategory ?? '',
      soundSecondaryCategory: daily.soundSecondaryCategory ?? '',
      soundId: daily.soundId ?? '',
    });
    window.location.href = `/mapfly?${params.toString()}`;
  }
}
