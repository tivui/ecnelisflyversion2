import { Component, inject, signal, computed, output, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';

import { FeaturedSoundService } from '../../../core/services/featured-sound.service';
import { APP_VERSION } from '../../../../environments/version';
import { DailyFeaturedSound } from '../../../core/models/featured-sound.model';
import { Language } from '../../../core/models/i18n.model';

@Component({
    selector: 'app-sidenav-menu',
    imports: [
        CommonModule,
        RouterLink,
        RouterLinkActive,
        TranslateModule,
        MatIconModule,
        MatRippleModule,
    ],
    templateUrl: './sidenav-menu.component.html',
    styleUrl: './sidenav-menu.component.scss'
})
export class SidenavMenuComponent {
  private readonly featuredSoundService = inject(FeaturedSoundService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  isOpen = input(false);
  isDark = input(false);
  isAdmin = input(false);
  currentLanguage = input<Language>('fr');
  languages = input<Language[]>(['fr', 'en', 'es']);
  closed = output<void>();
  themeToggled = output<void>();
  languageChanged = output<Language>();

  dailyFeatured = signal<DailyFeaturedSound | null>(null);
  showAdminMenu = signal(false);
  readonly appVersion = APP_VERSION;

  private tapCount = 0;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;

  adminMenuItems = [
    { icon: 'dashboard', labelKey: 'toolbar.admin.dashboard', route: '/admin/dashboard' },
    { icon: 'people', labelKey: 'toolbar.admin.users', route: '/admin/users' },
    { icon: 'storage', labelKey: 'toolbar.admin.database', route: '/admin/database' },
    { icon: 'help_outline', labelKey: 'toolbar.admin.guide', route: '/admin/guide' },
  ];

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.loadDailyFeatured();
      } else {
        this.showAdminMenu.set(false);
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
    {
      icon: 'quiz',
      labelKey: 'sidenav.soundQuiz',
      route: '/quiz',
      queryParams: {},
    },
    {
      icon: 'menu_book',
      labelKey: 'sidenav.soundArticles',
      route: '/articles',
      queryParams: {},
    },
    {
      icon: 'help_outline',
      labelKey: 'sidenav.guide',
      route: '/guide',
      queryParams: {},
    },
    {
      icon: 'favorite',
      labelKey: 'sidenav.support',
      route: '/support',
      queryParams: {},
    },
    {
      icon: 'gavel',
      labelKey: 'sidenav.legal',
      route: '/legal',
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

  onLogoTap(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.tapCount++;

    if (this.tapCount >= 3 && this.isAdmin()) {
      this.showAdminMenu.set(true);
      this.tapCount = 0;
      if (this.tapTimer) { clearTimeout(this.tapTimer); this.tapTimer = null; }
      return;
    }

    if (this.tapCount === 1) {
      this.tapTimer = setTimeout(() => {
        if (this.tapCount === 1) {
          this.router.navigate(['/home']);
          this.close();
        }
        this.tapCount = 0;
        this.tapTimer = null;
      }, 500);
    }
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
