import { Component, inject, signal, computed, output, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';

import { FeaturedSoundService } from '../../../core/services/featured-sound.service';
import { DailyFeaturedSound } from '../../../core/models/featured-sound.model';

@Component({
  selector: 'app-sidenav-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    TranslateModule,
    MatIconModule,
    MatRippleModule,
  ],
  templateUrl: './sidenav-menu.component.html',
  styleUrl: './sidenav-menu.component.scss',
})
export class SidenavMenuComponent {
  private readonly featuredSoundService = inject(FeaturedSoundService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  isOpen = input(false);
  closed = output<void>();

  dailyFeatured = signal<DailyFeaturedSound | null>(null);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.loadDailyFeatured();
      }
    });
  }

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

  menuItems = [
    {
      icon: 'public',
      labelKey: 'sidenav.worldMap',
      route: '/mapfly',
      queryParams: {},
    },
    {
      icon: 'category',
      labelKey: 'sidenav.categories',
      route: '/categories',
      queryParams: {},
    },
    {
      icon: 'location_on',
      labelKey: 'sidenav.discoverZones',
      route: '/zones',
      queryParams: {},
    },
    {
      icon: 'route',
      labelKey: 'sidenav.soundJourneys',
      route: '/journeys',
      queryParams: {},
    },
  ];

  private async loadDailyFeatured() {
    try {
      const daily = await this.featuredSoundService.getTodayFeatured();
      this.dailyFeatured.set(daily);
    } catch (error) {
      console.error('Error loading daily featured:', error);
    }
  }

  goToFeaturedSound() {
    const daily = this.dailyFeatured();
    if (!daily) return;

    this.close();

    // Use window.location.href to force full reload (needed when already on /mapfly)
    const params = new URLSearchParams({
      featuredMode: 'true',
      lat: String(daily.soundLatitude ?? ''),
      lng: String(daily.soundLongitude ?? ''),
      soundFilename: daily.soundFilename ?? '',
      soundTitle: daily.soundTitle ?? '',
      soundCity: daily.soundCity ?? '',
      soundCategory: daily.soundCategory ?? '',
      soundId: daily.soundId ?? '',
      soundTeasing: daily.teasing ?? '',
    });
    if (daily.teasing_i18n) {
      params.set('soundTeasingI18n', JSON.stringify(daily.teasing_i18n));
    }
    window.location.href = `/mapfly?${params.toString()}`;
  }

  close() {
    this.closed.emit();
  }

  onItemClick(item: typeof this.menuItems[number], event: Event) {
    this.close();

    // If already on the same route, force a full page reload
    if (this.router.url.startsWith(item.route)) {
      event.preventDefault();
      window.location.href = item.route;
    }
  }
}
