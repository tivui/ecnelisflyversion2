/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { SidenavMenuComponent } from './shared/components/sidenav-menu/sidenav-menu.component';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import {
  AmplifyAuthenticatorModule,
  AuthenticatorService,
} from '@aws-amplify/ui-angular';
import { Hub, I18n } from 'aws-amplify/utils';
import { AppUserService } from './core/services/app-user.service';
import { LogService } from './core/services/log.service';
import { Language } from './core/models/i18n.model';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { BrowserService } from './core/services/browser.service';
import { AppUser, Theme } from './core/models/app-user.model';
import { AmplifyI18nService } from './core/services/amplify-i18n.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from './core/services/auth.service';
import { DOCUMENT } from '@angular/common'; // required for fullscreen
import { PwaInstallBannerComponent } from './shared/components/pwa-install-banner/pwa-install-banner.component';
import { UserAvatarComponent } from './shared/components/user-avatar/user-avatar.component';
import { AppUpdateService } from './core/services/app-update.service';
import { FeaturedSoundService } from './core/services/featured-sound.service';
import { DailyFeaturedSound } from './core/models/featured-sound.model';
import { DashboardService } from './features/dashboard/services/dashboard.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    imports: [
        RouterOutlet,
        CommonModule,
        MatToolbarModule,
        MatSlideToggleModule,
        MatIconModule,
        MatButtonModule,
        MatSidenavModule,
        AmplifyAuthenticatorModule,
        TranslatePipe,
        MatInputModule,
        RouterOutlet,
        RouterLink,
        MatMenuModule,
        MatTooltipModule,
        SidenavMenuComponent,
        PwaInstallBannerComponent,
        UserAvatarComponent,
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppComponent implements OnInit {
  public readonly authenticator = inject(AuthenticatorService);
  private readonly appUserService = inject(AppUserService);
  private readonly logService = inject(LogService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly browserService = inject(BrowserService);
  private readonly amplifyI18n = inject(AmplifyI18nService);
  private readonly authService = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly appUpdateService = inject(AppUpdateService);
  private readonly featuredSoundService = inject(FeaturedSoundService);
  private readonly dashboardService = inject(DashboardService);

  public appUser = signal<AppUser | null>(null);
  public showLogin = signal(false);
  public isDark = signal(false);
  public isAdmin = signal(false);
  public sidenavOpened = signal(false);
  public isHomePage = signal(false);
  public isLoginPage = signal(false);
  public isCategoryMapPage = signal(false);

  /** Badge: user notifications (from AppUser.newNotificationCount) */
  public notificationCount = computed(() => this.appUser()?.newNotificationCount ?? 0);
  /** Badge: admin — number of sounds awaiting moderation */
  public pendingSoundsCount = signal(0);

  // ==================== BOTTOM NAV (mobile) ====================
  public isMobilePortrait = signal(false);
  public activeRoute = signal('');
  public bottomNavFeatured = signal<DailyFeaturedSound | null>(null);

  // ==================== WELCOME / GOODBYE OVERLAY ====================
  public welcomeVisible = signal(false);
  public welcomeFadingOut = signal(false);
  public welcomeUsername = signal('');
  public welcomeFlag = signal('');

  public goodbyeVisible = signal(false);
  public goodbyeFadingOut = signal(false);
  public goodbyeUsername = signal('');

  private showWelcomeOverlay(username: string, country?: string) {
    this.welcomeUsername.set(username);
    this.welcomeFlag.set(country ?? '');
    this.welcomeVisible.set(true);
    this.welcomeFadingOut.set(false);

    // Start fade out after 2.5s
    setTimeout(() => this.welcomeFadingOut.set(true), 2500);
    // Remove from DOM after fade animation
    setTimeout(() => this.welcomeVisible.set(false), 3500);
  }

  private showGoodbyeOverlay(username: string) {
    this.goodbyeUsername.set(username);
    this.goodbyeVisible.set(true);
    this.goodbyeFadingOut.set(false);

    setTimeout(() => this.goodbyeFadingOut.set(true), 2000);
    setTimeout(() => this.goodbyeVisible.set(false), 3000);
  }

  // ==================== FULLSCREEN ====================

  // Detect mobile environment (Android / iOS)
  public readonly isMobile = /Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent,
  );

  // Reference to the main document element
  private elem = this.document.documentElement;

  // Fullscreen state signal
  public isFullscreen = signal(false);

  // Open fullscreen mode (desktop + Android)
  openFullscreen(): void {
    // Skip for iOS (no fullscreen API available)
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return;

    if (this.elem.requestFullscreen) {
      this.elem.requestFullscreen();
    } else if ((this.elem as any).webkitRequestFullscreen) {
      (this.elem as any).webkitRequestFullscreen();
    } else if ((this.elem as any).msRequestFullscreen) {
      (this.elem as any).msRequestFullscreen();
    }
    this.isFullscreen.set(true);
  }

  // Exit fullscreen mode
  closeFullscreen(): void {
    if (this.document.exitFullscreen) {
      this.document.exitFullscreen();
    } else if ((this.document as any).webkitExitFullscreen) {
      (this.document as any).webkitExitFullscreen();
    } else if ((this.document as any).msExitFullscreen) {
      (this.document as any).msExitFullscreen();
    }
    this.isFullscreen.set(false);
  }

  // Toggle fullscreen
  toggleFullscreen(): void {
    if (this.isFullscreen()) {
      this.closeFullscreen();
    } else {
      this.openFullscreen();
    }
  }

  public languages: Language[] = ['en', 'fr', 'es'];
  public selectedLang = signal<Language>('fr');

  constructor() {
    this.translate.addLangs(this.languages);

    // Mobile portrait detection
    const checkMobile = () => {
      this.isMobilePortrait.set(
        window.innerWidth <= 700 &&
        window.matchMedia('(orientation: portrait)').matches
      );
    };
    checkMobile();
    window.addEventListener('resize', () => checkMobile());
    screen.orientation?.addEventListener('change', () => checkMobile());

    // Track current route for conditional UI
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects;
        this.isHomePage.set(url.startsWith('/home'));
        this.isLoginPage.set(url.startsWith('/login'));
        this.isCategoryMapPage.set(url.startsWith('/mapfly') && url.includes('category='));
        this.activeRoute.set(url);
      }
    });

    // Subscribe to currentUser$ with automatic unsubscription on destroy
    this.appUserService.currentUser$
      .pipe(takeUntilDestroyed())
      .subscribe((user) => {
        this.appUser.set(user);
        if (user) {
          this.isDark.set(user.theme === 'dark');
          this.applyTheme(user.theme);
          I18n.setLanguage(user.language);
          this.selectedLang.set(user.language);
        }
      });
  }

  async ngOnInit() {
    // 🔄 Listen for app updates (Service Worker)
    this.appUpdateService.init();

    // 🎨 Detect OS theme preference as initial default (overridden later if user has a stored preference)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.isDark.set(prefersDark);
    this.applyTheme(prefersDark ? 'dark' : 'light');

    // 1️⃣ Try to load user from backend (if authenticated)
    const appUser = await this.appUserService.loadCurrentUser();

    // Load current user & groups
    // Force token refresh to ensure cognito:groups claim is present for OAuth users
    await this.authService.loadCurrentUser();
    if (!this.authService.isInGroup('ADMIN') && this.authService.user()) {
      // Retry with forced refresh — OAuth tokens may not include groups initially
      await this.authService.loadGroups(true);
    }
    this.isAdmin.set(this.authService.isInGroup('ADMIN'));

    // Load pending sounds count for admin badge
    if (this.isAdmin()) {
      this.loadPendingSoundsCount();
    }

    let defaultLang: Language;

    if (appUser?.language) {
      // Case 1: Use user's stored language from DynamoDB (highest priority)
      defaultLang = appUser.language;
    } else {
      // Case 2: Try localStorage
      const savedLang = localStorage.getItem('lang') as Language | null;

      if (savedLang) {
        defaultLang = savedLang;
      } else {
        // Case 3: Fallback to browser language via BrowserService
        defaultLang = this.browserService.getBrowserLanguage();
      }
    }

    // Apply language globally intially
    this.selectedLang.set(defaultLang);
    this.translate.use(defaultLang);
    this.amplifyI18n.init(defaultLang);

    // Load featured sound for bottom nav
    this.featuredSoundService.getTodayFeatured()
      .then((daily) => this.bottomNavFeatured.set(daily))
      .catch(() => {});

    // 2️⃣ Listen to authentication events (Amplify Hub)
    Hub.listen('auth', async ({ payload }) => {
      switch (payload.event) {
        case 'signedIn': {
          this.logService.info('User signed in via Amplify Hub');

          const appUser = await this.appUserService.loadCurrentUser();

          // Reload groups and update admin status
          // Force token refresh to ensure cognito:groups claim is present
          // (OAuth providers like Google may not include groups in the initial cached token)
          await this.authService.loadCurrentUser();
          await this.authService.loadGroups(true);
          this.isAdmin.set(this.authService.isInGroup('ADMIN'));

          // Refresh pending badge on sign-in
          if (this.isAdmin()) {
            this.loadPendingSoundsCount();
          }

          if (appUser?.language) {
            // Update language from user preference
            this.selectedLang.set(appUser.language);
            this.translate.use(appUser.language);
            this.amplifyI18n.setLanguage(appUser.language);
            localStorage.setItem('lang', appUser.language);
          }

          // Apply theme
          if (appUser?.theme) {
            this.isDark.set(appUser.theme === 'dark');
            this.applyTheme(appUser.theme);
          }

          this.router.navigate(['/home']);

          // Show welcome overlay (fallback to Cognito email if appUser creation failed)
          const displayName = appUser?.username
            ?? this.authService.user()?.email?.split('@')[0]
            ?? null;
          if (displayName) {
            this.showWelcomeOverlay(displayName, appUser?.country ?? undefined);
          }
          break;
        }

        case 'signedOut': {
          const previousUsername = this.appUserService.currentUser?.username ?? '';
          this.appUserService.clearCurrentUser();
          this.authService.clearUser();
          this.isAdmin.set(false);
          this.pendingSoundsCount.set(0);

          this.router.navigate(['/home'], { replaceUrl: true });

          if (previousUsername) {
            this.showGoodbyeOverlay(previousUsername);
          }
          break;
        }
      }
    });

    // ==================== FULLSCREEN DETECTION ====================

    // ✅ Detect native fullscreen changes (F11, Esc, or programmatic)
    this.document.addEventListener('fullscreenchange', () => {
      const fsActive = !!this.document.fullscreenElement;
      this.isFullscreen.set(fsActive);
    });

    // ✅ Fallback: detect fullscreen by window size (for browsers or mobile)
    window.addEventListener('resize', () => {
      const isLikelyFullscreen =
        Math.abs(window.innerHeight - screen.height) < 10 &&
        Math.abs(window.innerWidth - screen.width) < 10;
      this.isFullscreen.set(isLikelyFullscreen);
    });
  }

  async changeLang(languageSelected: Language) {
    // Immediately update UI
    this.selectedLang.set(languageSelected);
    this.translate.use(languageSelected);
    this.amplifyI18n.setLanguage(languageSelected);
    localStorage.setItem('lang', languageSelected);

    // Persist to DynamoDB
    await this.appUserService.updateLanguage(languageSelected);
  }

  toggleDarkMode() {
    const dark = !this.isDark();
    const theme = dark ? 'dark' : 'light';

    this.isDark.set(dark);
    this.applyTheme(theme);

    // Save preference in backend
    this.appUserService.updateTheme(theme);
  }

  private applyTheme(theme: Theme) {
    // Apply theme CSS classes globally
    const body = document.body;
    body.classList.toggle('dark-theme', theme === 'dark');
    body.classList.toggle('light-theme', theme === 'light');
  }

  goToAccount() {
    this.router.navigate(['/account']);
  }

  goToNewSound() {
    this.router.navigate(['/new-sound']);
  }

  toggleSidenav() {
    const wasOpen = this.sidenavOpened();
    this.sidenavOpened.update((v) => !v);
    // Opening sidenav → reset notification badge
    if (!wasOpen && this.notificationCount() > 0) {
      this.appUserService.resetNotifications();
    }
  }

  closeSidenav() {
    this.sidenavOpened.set(false);
  }

  private async loadPendingSoundsCount() {
    try {
      const count = await this.dashboardService.getPendingSoundsCount();
      this.pendingSoundsCount.set(count);
    } catch {
      // non-blocking
    }
  }

  goToMap() {
    if (this.router.url.startsWith('/mapfly')) {
      // Already on mapfly (e.g. featuredMode) — force full reload to clean state
      window.location.href = '/mapfly';
    } else {
      this.router.navigate(['/mapfly']);
    }
  }

  goToFeaturedFromBottomNav() {
    const daily = this.bottomNavFeatured();
    if (!daily) return;

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
}
