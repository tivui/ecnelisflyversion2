import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, inject, NgZone, OnInit, AfterViewInit, OnDestroy, signal, computed, ViewChild } from '@angular/core';
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
import { SoundArticle, MonthlyArticle } from '../../../articles/models/article.model';
import { SoundJourneyService } from '../../../../core/services/sound-journey.service';
import { MonthlyJourney } from '../../../../core/models/sound-journey.model';
import { CarouselCategoriesComponent } from './widgets/carousel-categories/carousel-categories.component';
import { FitTextDirective } from '../../../../shared/directives/fit-text.directive';
import { GooeyAudioService } from '../../../../core/services/gooey-audio.service';

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
  private readonly ngZone = inject(NgZone);
  private readonly gooeyAudio = inject(GooeyAudioService);

  @ViewChild('secondaryScroll') secondaryScrollEl?: ElementRef<HTMLElement>;
  @ViewChild('heroVideo') heroVideoEl?: ElementRef<HTMLVideoElement>;
  @ViewChild('mapLogo') mapLogoEl?: ElementRef<HTMLImageElement>;
  @ViewChild('bouncingLogo') bouncingLogoEl?: ElementRef<HTMLImageElement>;

  shimmerX = signal('-200%');
  hasScrolled = signal(false);
  activeCardIndex = signal(0);
  dataLoaded = signal(false);
  isMobileGrid = signal(false);


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
      this.loadArticle(),
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

  private async loadArticle(): Promise<SoundArticle | null> {
    // Try monthly article first, fall back to latest published
    const monthly = await this.articleService.getMonthlyArticle();
    if (monthly) {
      return {
        id: monthly.articleId,
        title: monthly.articleTitle ?? '',
        title_i18n: monthly.articleTitle_i18n,
        description: monthly.articleDescription,
        description_i18n: monthly.articleDescription_i18n,
        slug: monthly.articleSlug ?? '',
        coverImageKey: monthly.articleCoverImageKey,
        authorName: monthly.articleAuthorName,
        tags: [],
        status: 'published',
        blockCount: 0,
        sortOrder: 0,
      };
    }
    return this.articleService.getLatestPublishedArticle();
  }

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

  // --- Card click handling ---

  onCardClick(cardType: string): void {
    this.navigateToCard(cardType);
  }

  onCardCtaClick(cardType: string, event: Event): void {
    if (!this.isMobileGrid()) return; // Desktop: let click bubble to card/routerLink
    event.stopPropagation();
    this.navigateToCard(cardType);
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

  // =====================================================================
  // Gooey Living Logo — Interactive physics + synthesized audio
  // =====================================================================

  logoState = signal<'idle' | 'dragging' | 'bouncing' | 'returning' | 'longpress'>('idle');
  logoCloneActive = signal(false);
  logoSquishing = signal(false);
  cloneSize = signal(100);

  // Physics state (mutated at 60fps — NOT signals to avoid change detection)
  private rAFId = 0;
  private pointerStart = { x: 0, y: 0, time: 0 };
  private pointerCurrent = { x: 0, y: 0 };
  private logoHome = { x: 0, y: 0 };
  private logoSize = 100;
  private pointerHistory: Array<{ x: number; y: number; time: number }> = [];
  private position = { x: 0, y: 0 };
  private velocity = { x: 0, y: 0 };
  private bounceStartTime = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressStartTime = 0;
  private gestureStarted = false;
  private totalMovement = 0;
  private justTapped = false;
  private activePointerId: number | null = null;
  private activeLogoEl: HTMLImageElement | null = null;

  // Physics constants
  private readonly SPRING_STIFFNESS = 0.08;
  private readonly SPRING_DAMPING = 0.85;
  private readonly BOUNCE_FRICTION = 0.985;
  private readonly WALL_RESTITUTION = 0.7;
  private readonly FLICK_VELOCITY_THRESHOLD = 800;
  private readonly MAX_BOUNCE_TIME = 8000;
  private readonly TAP_MAX_DURATION = 200;
  private readonly TAP_MAX_MOVEMENT = 10;
  private readonly LONG_PRESS_DURATION = 500;
  private readonly GOO_STRETCH_MAX = 150;

  // --- Pointer Event Handlers (template-bound) ---

  onLogoDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const state = this.logoState();
    if (state === 'bouncing' || state === 'returning') return;

    this.gooeyAudio.ensureContext();

    this.activePointerId = event.pointerId;
    this.gestureStarted = true;
    this.totalMovement = 0;
    this.pointerStart = { x: event.clientX, y: event.clientY, time: Date.now() };
    this.pointerCurrent = { x: event.clientX, y: event.clientY };
    this.pointerHistory = [{ x: event.clientX, y: event.clientY, time: Date.now() }];

    const logoEl = event.target as HTMLImageElement;
    this.activeLogoEl = logoEl;
    const rect = logoEl.getBoundingClientRect();
    this.logoHome = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.logoSize = rect.width;
    this.cloneSize.set(rect.width);

    this.longPressTimer = setTimeout(() => {
      if (this.gestureStarted && this.totalMovement < this.TAP_MAX_MOVEMENT) {
        this.startLongPress();
      }
    }, this.LONG_PRESS_DURATION);

    logoEl.setPointerCapture(event.pointerId);
  }

  onLogoMove(event: PointerEvent): void {
    if (!this.gestureStarted || event.pointerId !== this.activePointerId) return;

    const dx = event.clientX - this.pointerStart.x;
    const dy = event.clientY - this.pointerStart.y;
    this.totalMovement = Math.sqrt(dx * dx + dy * dy);

    this.pointerHistory.push({ x: event.clientX, y: event.clientY, time: Date.now() });
    if (this.pointerHistory.length > 4) this.pointerHistory.shift();

    this.pointerCurrent = { x: event.clientX, y: event.clientY };

    if (this.totalMovement > this.TAP_MAX_MOVEMENT) {
      this.clearLongPressTimer();
      const state = this.logoState();
      if (state === 'longpress') {
        this.endLongPress(false);
      }
      if (state !== 'dragging') {
        this.startDrag();
      }
    }
  }

  onLogoUp(event: PointerEvent): void {
    if (!this.gestureStarted || event.pointerId !== this.activePointerId) return;
    this.gestureStarted = false;
    this.activePointerId = null;
    this.clearLongPressTimer();

    const duration = Date.now() - this.pointerStart.time;
    const state = this.logoState();

    if (state === 'longpress') {
      this.endLongPress(true);
      return;
    }

    if (state === 'dragging') {
      const vel = this.computeVelocity();
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (speed > this.FLICK_VELOCITY_THRESHOLD) {
        this.startBounce(vel);
      } else {
        this.startReturn();
      }
      return;
    }

    // Tap detection
    if (duration < this.TAP_MAX_DURATION && this.totalMovement < this.TAP_MAX_MOVEMENT) {
      this.handleTap();
      return;
    }

    this.logoState.set('idle');
  }

  onLogoCancel(event: PointerEvent): void {
    if (!this.gestureStarted || event.pointerId !== this.activePointerId) return;
    this.gestureStarted = false;
    this.activePointerId = null;
    this.clearLongPressTimer();

    const state = this.logoState();
    if (state === 'dragging') {
      this.startReturn();
    } else if (state === 'longpress') {
      this.endLongPress(true);
    } else {
      this.logoState.set('idle');
      this.activeLogoEl = null;
    }
  }

  onMapCardClick(event: Event): void {
    const state = this.logoState();
    if (state !== 'idle' || this.logoCloneActive() || this.justTapped) {
      event.preventDefault();
      event.stopPropagation();
      this.justTapped = false;
    }
  }


  // --- Gesture Handlers ---

  private handleTap(): void {
    this.justTapped = true;
    setTimeout(() => this.justTapped = false, 300);

    this.logoSquishing.set(true);
    setTimeout(() => this.logoSquishing.set(false), 400);

    this.gooeyAudio.playBoing();
    navigator.vibrate?.(10);
  }

  private startDrag(): void {
    this.logoState.set('dragging');
    this.logoCloneActive.set(true);
    this.position = { ...this.logoHome };
    this.gooeyAudio.startStretch(0);
    this.startPhysicsLoop();
  }

  private startBounce(vel: { x: number; y: number }): void {
    this.logoState.set('bouncing');
    this.velocity = vel;
    this.bounceStartTime = Date.now();
    this.gooeyAudio.stopStretch();
    this.gooeyAudio.playWhoosh(Math.sqrt(vel.x * vel.x + vel.y * vel.y));
    navigator.vibrate?.(15);
  }

  private startReturn(): void {
    this.logoState.set('returning');
    this.velocity = { x: 0, y: 0 };
    this.gooeyAudio.stopStretch();
    this.gooeyAudio.playSnap(Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2));
  }

  private startLongPress(): void {
    this.logoState.set('longpress');
    this.longPressStartTime = 0;
    this.gooeyAudio.startDrone();
    navigator.vibrate?.(10);
    // Kill CSS animation to allow JS transform (animation overrides inline styles)
    if (this.activeLogoEl) {
      this.activeLogoEl.classList.add('longpress-active');
    }
    if (!this.rAFId) this.startPhysicsLoop();
  }

  private endLongPress(withPop: boolean): void {
    this.gooeyAudio.stopDrone();
    if (withPop) this.gooeyAudio.playPop();
    this.logoState.set('idle');
    this.longPressStartTime = 0;

    const logoEl = this.activeLogoEl;
    if (logoEl) {
      logoEl.style.transform = '';
      logoEl.style.transition = '';
      logoEl.classList.remove('longpress-active');
    }
    this.activeLogoEl = null;
    this.stopPhysicsLoop();
  }

  // --- Physics Loop (outside Angular zone for performance) ---

  private startPhysicsLoop(): void {
    if (this.rAFId) return;

    this.ngZone.runOutsideAngular(() => {
      let lastTime = performance.now();

      const loop = (now: number) => {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        const state = this.logoState();

        switch (state) {
          case 'dragging':
            this.updateDragPhysics();
            break;
          case 'bouncing':
            this.updateBouncePhysics(dt);
            break;
          case 'returning':
            this.updateReturnPhysics();
            break;
          case 'longpress':
            this.updateLongPressVisual();
            break;
          default:
            this.stopPhysicsLoop();
            return;
        }

        this.rAFId = requestAnimationFrame(loop);
      };

      this.rAFId = requestAnimationFrame(loop);
    });
  }

  private stopPhysicsLoop(): void {
    if (this.rAFId) {
      cancelAnimationFrame(this.rAFId);
      this.rAFId = 0;
    }
  }

  // --- Physics Update Methods ---

  private updateDragPhysics(): void {
    const target = this.pointerCurrent;
    const home = this.logoHome;
    const dx = target.x - home.x;
    const dy = target.y - home.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Elastic resistance
    const maxStretch = this.GOO_STRETCH_MAX;
    const factor = distance < maxStretch ? 1 : maxStretch / distance * 0.5 + 0.5;

    this.position.x = home.x + dx * factor;
    this.position.y = home.y + dy * factor;

    // Goo deformation
    const stretchAmount = Math.min(distance / maxStretch, 1);
    const angle = Math.atan2(dy, dx);
    const scaleX = 1 + stretchAmount * 0.15 * Math.abs(Math.cos(angle));
    const scaleY = 1 + stretchAmount * 0.15 * Math.abs(Math.sin(angle));

    this.updateCloneTransform(this.position.x, this.position.y, scaleX, scaleY);
    this.gooeyAudio.updateStretch(distance);
  }

  private updateBouncePhysics(dt: number): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = this.logoSize / 2;

    this.velocity.x *= this.BOUNCE_FRICTION;
    this.velocity.y *= this.BOUNCE_FRICTION;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    let bounced = false;

    if (this.position.x - r < 0) {
      this.position.x = r;
      this.velocity.x = Math.abs(this.velocity.x) * this.WALL_RESTITUTION;
      bounced = true;
    } else if (this.position.x + r > vw) {
      this.position.x = vw - r;
      this.velocity.x = -Math.abs(this.velocity.x) * this.WALL_RESTITUTION;
      bounced = true;
    }

    if (this.position.y - r < 0) {
      this.position.y = r;
      this.velocity.y = Math.abs(this.velocity.y) * this.WALL_RESTITUTION;
      bounced = true;
    } else if (this.position.y + r > vh) {
      this.position.y = vh - r;
      this.velocity.y = -Math.abs(this.velocity.y) * this.WALL_RESTITUTION;
      bounced = true;
    }

    if (bounced) {
      const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
      this.gooeyAudio.playPlop(speed);
      navigator.vibrate?.(8);
    }

    // Deformation based on speed
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    const deform = Math.min(speed / 1500, 0.2);
    const angle = Math.atan2(this.velocity.y, this.velocity.x);
    const scaleX = 1 + deform * Math.abs(Math.cos(angle));
    const scaleY = 1 - deform * 0.5 * Math.abs(Math.cos(angle));

    this.updateCloneTransform(this.position.x, this.position.y, scaleX, scaleY);

    // Timeout or slowed enough → return
    const elapsed = Date.now() - this.bounceStartTime;
    if (elapsed > this.MAX_BOUNCE_TIME || speed < 20) {
      this.ngZone.run(() => {
        this.logoState.set('returning');
        this.velocity = { x: 0, y: 0 };
        this.gooeyAudio.playSnap(0);
      });
    }
  }

  private updateReturnPhysics(): void {
    const home = this.logoHome;
    const dx = home.x - this.position.x;
    const dy = home.y - this.position.y;

    this.velocity.x += dx * this.SPRING_STIFFNESS;
    this.velocity.y += dy * this.SPRING_STIFFNESS;
    this.velocity.x *= this.SPRING_DAMPING;
    this.velocity.y *= this.SPRING_DAMPING;

    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // Wobble deformation
    const dist = Math.sqrt(dx * dx + dy * dy);
    const wobble = Math.min(dist / 50, 0.15);
    const scaleX = 1 + wobble * 0.3;
    const scaleY = 1 - wobble * 0.15;

    this.updateCloneTransform(this.position.x, this.position.y, scaleX, scaleY);

    // Settled?
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    if (dist < 1 && speed < 0.5) {
      this.ngZone.run(() => {
        this.logoState.set('idle');
        this.logoCloneActive.set(false);
      });
      this.activeLogoEl = null;
      this.stopPhysicsLoop();
    }
  }

  private updateLongPressVisual(): void {
    if (!this.longPressStartTime) this.longPressStartTime = performance.now();

    const elapsed = (performance.now() - this.longPressStartTime) / 1000;

    // Inflate: 0 → 1 over 1.5s
    const inflateProgress = Math.min(elapsed / 1.5, 1);
    const baseScale = 1 + inflateProgress * 0.3;

    // Pulse: gentle breathing
    const pulse = 1 + Math.sin(elapsed * Math.PI * 2) * 0.03 * inflateProgress;
    const scale = baseScale * pulse;

    // Spin: quadratic acceleration — starts barely moving, gets exciting
    const rotation = 30 * Math.pow(elapsed, 2.5);

    // Wobble: asymmetric goo stretch while spinning
    const wobbleAmount = 0.025 * inflateProgress;
    const wobble = Math.sin(elapsed * 8) * wobbleAmount;
    const scaleX = (scale + wobble).toFixed(3);
    const scaleY = (scale - wobble).toFixed(3);

    const logoEl = this.activeLogoEl;
    if (logoEl) {
      logoEl.style.transition = 'none';
      logoEl.style.transform = `rotate(${rotation.toFixed(1)}deg) scaleX(${scaleX}) scaleY(${scaleY})`;
    }

    // Drone pitch rises exponentially with spin duration
    this.gooeyAudio.updateDrone(elapsed);
  }

  // --- Helpers ---

  private updateCloneTransform(x: number, y: number, scaleX: number, scaleY: number): void {
    const clone = this.bouncingLogoEl?.nativeElement;
    if (!clone) return;
    const halfSize = this.logoSize / 2;
    clone.style.transform = `translate(${x - halfSize}px, ${y - halfSize}px) scaleX(${scaleX.toFixed(3)}) scaleY(${scaleY.toFixed(3)})`;
  }

  private computeVelocity(): { x: number; y: number } {
    if (this.pointerHistory.length < 2) return { x: 0, y: 0 };
    const latest = this.pointerHistory[this.pointerHistory.length - 1];
    const earliest = this.pointerHistory[0];
    const dt = (latest.time - earliest.time) / 1000;
    if (dt === 0) return { x: 0, y: 0 };
    return {
      x: (latest.x - earliest.x) / dt,
      y: (latest.y - earliest.y) / dt,
    };
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.stopPhysicsLoop();
    this.clearLongPressTimer();
    this.gooeyAudio.stopStretch();
    this.gooeyAudio.stopDrone();
  }

}
