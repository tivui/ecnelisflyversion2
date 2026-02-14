import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, inject, OnInit, AfterViewInit, OnDestroy, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

import { AppUserService } from '../../../../core/services/app-user.service';
import { AppUser } from '../../../../core/models/app-user.model';
import { ZoneService } from '../../../../core/services/zone.service';
import { MonthlyZone } from '../../../../core/models/zone.model';
import { FeaturedSoundService } from '../../../../core/services/featured-sound.service';
import { DailyFeaturedSound } from '../../../../core/models/featured-sound.model';
import { QuizService } from '../../../quiz/services/quiz.service';
import { Quiz } from '../../../quiz/models/quiz.model';
import { ArticleService } from '../../../articles/services/article.service';
import { SoundArticle } from '../../../articles/models/article.model';
import { SoundJourneyService } from '../../../../core/services/sound-journey.service';
import { MonthlyJourney } from '../../../../core/models/sound-journey.model';
import { CarouselCategoriesComponent } from './widgets/carousel-categories/carousel-categories.component';
import { FitTextDirective } from '../../../../shared/directives/fit-text.directive';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    RouterLink,
    MatIconModule,
    CarouselCategoriesComponent,
    FitTextDirective,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly appUserService = inject(AppUserService);
  private readonly zoneService = inject(ZoneService);
  private readonly featuredSoundService = inject(FeaturedSoundService);
  private readonly quizService = inject(QuizService);
  private readonly articleService = inject(ArticleService);
  private readonly journeyService = inject(SoundJourneyService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  @ViewChild('secondaryScroll') secondaryScrollEl?: ElementRef<HTMLElement>;
  @ViewChild('heroVideo') heroVideoEl?: ElementRef<HTMLVideoElement>;

  shimmerX = signal('-200%');
  hasScrolled = signal(false);
  activeCardIndex = signal(0);
  dataLoaded = signal(false);
  isMobileGrid = signal(false);

  // Long press
  longPressedCard = signal<string | null>(null);
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;
  private longPressDismissTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly subtitleIndex = Math.floor(Math.random() * 7);
  randomSubtitle = computed(() => {
    // Re-evaluate when language changes
    this.currentLang();
    const subtitles = this.translate.instant('home.hero.subtitles');
    if (Array.isArray(subtitles)) {
      return subtitles[this.subtitleIndex % subtitles.length];
    }
    return this.translate.instant('home.hero.subtitle');
  });

  appUser = toSignal<AppUser | null>(this.appUserService.currentUser$, {
    initialValue: null,
  });

  dailyFeatured = signal<DailyFeaturedSound | null>(null);
  monthlyQuiz = signal<Quiz | null>(null);
  latestArticle = signal<SoundArticle | null>(null);
  monthlyZone = signal<MonthlyZone | null>(null);
  monthlyJourney = signal<MonthlyJourney | null>(null);

  /** Exactly 3 secondary cards (map always primary = 4 total).
   *  Available: Son du jour, Quiz du mois, Terroir du mois, Article du mois.
   *  If all 4 are available, randomly exclude one. */

  /** Which card types to show (set once after data loads) */
  visibleCardTypes = signal<Set<string>>(new Set());

  /** Ordered secondary cards: featured always centered for visual focus */
  orderedSecondaryCards = signal<string[]>([]);

  secondaryCardIndices = computed(() => {
    return Array.from({ length: this.orderedSecondaryCards().length }, (_, i) => i);
  });

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
    const [dailyResult, monthlyQuizResult, articleResult, monthlyZoneResult, monthlyJourneyResult] = await Promise.allSettled([
      this.featuredSoundService.getTodayFeatured(),
      this.quizService.getMonthlyQuiz(),
      this.articleService.getLatestPublishedArticle(),
      this.zoneService.getMonthlyZone(),
      this.journeyService.getMonthlyJourney(),
    ]);

    if (dailyResult.status === 'fulfilled') {
      this.dailyFeatured.set(dailyResult.value);
    }

    if (monthlyQuizResult.status === 'fulfilled' && monthlyQuizResult.value) {
      this.monthlyQuiz.set(monthlyQuizResult.value.quiz);
    }

    if (articleResult.status === 'fulfilled' && articleResult.value) {
      this.latestArticle.set(articleResult.value);
    }

    if (monthlyZoneResult.status === 'fulfilled' && monthlyZoneResult.value) {
      this.monthlyZone.set(monthlyZoneResult.value);
    }

    if (monthlyJourneyResult.status === 'fulfilled' && monthlyJourneyResult.value) {
      this.monthlyJourney.set(monthlyJourneyResult.value);
    }

    const isMobile = window.innerWidth <= 700;
    this.isMobileGrid.set(isMobile);

    let available: string[];

    // Pool of 4 rotating card types (all except featured)
    const pool: string[] = [];
    if (this.monthlyQuiz()) pool.push('quiz');
    if (this.latestArticle()) pool.push('article');
    if (this.monthlyJourney()) pool.push('monthlyJourney');
    if (this.monthlyZone()) pool.push('monthlyZone');

    // Shuffle pool (Fisher-Yates)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const hasFeatured = !!this.dailyFeatured();

    if (isMobile) {
      // Mobile: 2x2 grid — featured always present + pick 3 from pool
      const picked = pool.slice(0, 3);
      available = hasFeatured ? ['featured', ...picked] : [...pool.slice(0, 4)];
    } else {
      // Desktop: up to 4 secondary cards (featured + 3 from shuffled pool).
      // CSS hides 4th on non-XL; XL (≥1920px) shows all 4.
      // Pool includes: quiz, article, monthlyJourney, monthlyZone — all equal priority.
      const picked = pool.slice(0, 3);
      available = hasFeatured ? ['featured', ...picked] : [...pool.slice(0, 4)];
    }

    this.visibleCardTypes.set(new Set(available));

    // Ordering
    if (isMobile) {
      // Mobile grid: featured at position 2 (top-right) for visual focus
      const nonFeatured = available.filter(t => t !== 'featured');
      if (hasFeatured && nonFeatured.length >= 3) {
        this.orderedSecondaryCards.set([nonFeatured[0], 'featured', nonFeatured[1], nonFeatured[2]]);
      } else if (hasFeatured && nonFeatured.length >= 1) {
        this.orderedSecondaryCards.set([nonFeatured[0], 'featured', ...nonFeatured.slice(1)]);
      } else {
        this.orderedSecondaryCards.set(available);
      }
    } else {
      // Desktop: [pick1, featured, pick2, pick3] — featured always in position 2
      // CSS hides 4th card on non-XL screens
      const nonFeatured = available.filter(t => t !== 'featured');
      if (hasFeatured && nonFeatured.length >= 3) {
        this.orderedSecondaryCards.set([nonFeatured[0], 'featured', nonFeatured[1], nonFeatured[2]]);
      } else if (hasFeatured && nonFeatured.length >= 2) {
        this.orderedSecondaryCards.set([nonFeatured[0], 'featured', nonFeatured[1]]);
      } else if (hasFeatured) {
        this.orderedSecondaryCards.set([...nonFeatured, 'featured']);
      } else {
        this.orderedSecondaryCards.set(available);
      }
    }

    this.dataLoaded.set(true);

    setTimeout(() => {
      if (this.secondaryScrollEl && !isMobile) {
        const el = this.secondaryScrollEl.nativeElement;
        el.scrollLeft = 0;
        this.updateActiveCard(el);
        // Hint swipe: briefly scroll right then back to hint horizontal scrolling (desktop only)
        setTimeout(() => {
          el.scrollTo({ left: 40, behavior: 'smooth' });
          setTimeout(() => el.scrollTo({ left: 0, behavior: 'smooth' }), 600);
        }, 1200);
      }
    });
  }

  ngAfterViewInit() {
    const video = this.heroVideoEl?.nativeElement;
    if (video) {
      // Force load + play for mobile browsers that ignore autoplay
      video.load();
      video.play().catch(() => {});
      // Safety net: retry when video data is ready (slow connections)
      video.addEventListener('canplay', () => video.play().catch(() => {}), { once: true });
    }
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
    // Active card index based on scroll position
    const cardCount = this.secondaryCardIndices().length;
    const index = Math.round(ratio * (cardCount - 1));
    this.activeCardIndex.set(Math.min(index, cardCount - 1));
    this.updateActiveCard(el);
  }

  private updateActiveCard(container: HTMLElement) {
    const cards = container.querySelectorAll('.hero-card');
    const idx = this.activeCardIndex();
    cards.forEach((card, i) => {
      card.classList.toggle('card-in-view', i === idx);
    });
  }

  quizTitle = computed(() => {
    const quiz = this.monthlyQuiz();
    if (!quiz) return '';
    const lang = this.currentLang();
    if (quiz.title_i18n && quiz.title_i18n[lang]) return quiz.title_i18n[lang];
    return quiz.title;
  });

  quizDescription = computed(() => {
    const quiz = this.monthlyQuiz();
    if (!quiz) return '';
    const lang = this.currentLang();
    if (quiz.description_i18n && quiz.description_i18n[lang]) return quiz.description_i18n[lang];
    return quiz.description ?? '';
  });

  articleTitle = computed(() => {
    const article = this.latestArticle();
    if (!article) return '';
    const lang = this.currentLang();
    if (article.title_i18n && article.title_i18n[lang]) return article.title_i18n[lang];
    return article.title;
  });

  articleDescription = computed(() => {
    const article = this.latestArticle();
    if (!article) return '';
    const lang = this.currentLang();
    if (article.description_i18n && article.description_i18n[lang]) return article.description_i18n[lang];
    return article.description ?? '';
  });

  monthlyZoneName = computed(() => {
    const mz = this.monthlyZone();
    if (!mz) return '';
    const lang = this.currentLang();
    if (mz.zoneName_i18n && mz.zoneName_i18n[lang]) return mz.zoneName_i18n[lang];
    return mz.zoneName ?? '';
  });

  monthlyZoneDescription = computed(() => {
    const mz = this.monthlyZone();
    if (!mz) return '';
    const lang = this.currentLang();
    if (mz.zoneDescription_i18n && mz.zoneDescription_i18n[lang]) return mz.zoneDescription_i18n[lang];
    return mz.zoneDescription ?? '';
  });

  monthlyJourneyName = computed(() => {
    const mj = this.monthlyJourney();
    if (!mj) return '';
    const lang = this.currentLang();
    if (mj.journeyName_i18n && mj.journeyName_i18n[lang]) return mj.journeyName_i18n[lang];
    return mj.journeyName ?? '';
  });

  monthlyJourneyDescription = computed(() => {
    const mj = this.monthlyJourney();
    if (!mj) return '';
    const lang = this.currentLang();
    if (mj.journeyDescription_i18n && mj.journeyDescription_i18n[lang]) return mj.journeyDescription_i18n[lang];
    return mj.journeyDescription ?? '';
  });

  goToMonthlyJourney() {
    const mj = this.monthlyJourney();
    if (!mj?.journeyId) return;
    const params = new URLSearchParams({
      journeyMode: 'true',
      journeyId: mj.journeyId,
    });
    window.location.href = `/mapfly?${params.toString()}`;
  }

  goToMonthlyZone() {
    const mz = this.monthlyZone();
    if (!mz?.zoneId) return;
    const params = new URLSearchParams({ zoneId: mz.zoneId });
    window.location.href = `/mapfly?${params.toString()}`;
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
      soundTeasing: daily.teasing ?? '',
    });
    if (daily.teasing_i18n) {
      params.set('soundTeasingI18n', JSON.stringify(daily.teasing_i18n));
    }
    window.location.href = `/mapfly?${params.toString()}`;
  }

  // --- Long press handling (mobile grid tiles) ---

  onCardPointerDown(cardType: string, event: Event) {
    if (!this.isMobileGrid()) return;
    event.preventDefault();
    this.longPressFired = false;
    if (this.longPressDismissTimer) {
      clearTimeout(this.longPressDismissTimer);
      this.longPressDismissTimer = null;
    }
    this.longPressTimer = setTimeout(() => {
      this.longPressFired = true;
      this.longPressedCard.set(cardType);
      // Haptic feedback if supported
      if (navigator.vibrate) navigator.vibrate(10);
      // Auto-dismiss after 3s
      this.longPressDismissTimer = setTimeout(() => this.longPressedCard.set(null), 3000);
    }, 400);
  }

  onCardPointerUp(cardType: string) {
    if (!this.isMobileGrid()) return;
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (!this.longPressFired) {
      // Short tap → navigate
      this.longPressedCard.set(null);
      this.navigateToCard(cardType);
    }
    // If long press was fired, keep overlay visible (auto-dismiss handles it)
  }

  navigateToCard(cardType: string) {
    switch (cardType) {
      case 'featured':
        this.goToFeaturedSound();
        break;
      case 'monthlyJourney':
        this.goToMonthlyJourney();
        break;
      case 'quiz':
        if (this.monthlyQuiz()) {
          this.router.navigate(['/quiz', this.monthlyQuiz()!.id]);
        }
        break;
      case 'article':
        if (this.latestArticle()) {
          this.router.navigate(['/articles', this.latestArticle()!.slug]);
        }
        break;
      case 'monthlyZone':
        this.goToMonthlyZone();
        break;
    }
  }

  ngOnDestroy() {
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    if (this.longPressDismissTimer) clearTimeout(this.longPressDismissTimer);
  }
}
