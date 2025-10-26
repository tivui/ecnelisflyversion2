/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Component,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
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

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [
    RouterOutlet,
    CommonModule,
    MatToolbarModule,
    MatSlideToggleModule,
    MatIconModule,
    MatButtonModule,
    AmplifyAuthenticatorModule,
    TranslatePipe,
    MatInputModule,
    RouterOutlet,
    RouterLink,
    MatMenuModule,
    MatTooltipModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
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

  public appUser = signal<AppUser | null>(null);
  public showLogin = signal(false);
  public isDark = signal(false);
  public isAdmin = signal(false);

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

    // Subscribe to currentUser$ with automatic unsubscription on destroy
    this.appUserService.currentUser$
      .pipe(takeUntilDestroyed())
      .subscribe((user) => {
        if (user) {
          this.applyTheme(user.theme);
          I18n.setLanguage(user.language);
          this.selectedLang.set(user.language);
        }
      });
  }

  async ngOnInit() {
    // 1️⃣ Try to load user from backend (if authenticated)
    const appUser = await this.appUserService.loadCurrentUser();

    // Load current user & groups
    await this.authService.loadCurrentUser();

    // Check if current user is in ADMIN group
    this.isAdmin.set(this.authService.isInGroup('ADMIN'));

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

    // 2️⃣ Listen to authentication events (Amplify Hub)
    Hub.listen('auth', async ({ payload }) => {
      switch (payload.event) {
        case 'signedIn': {
          this.logService.info('User signed in via Amplify Hub');

          const appUser = await this.appUserService.loadCurrentUser();
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
          break;
        }

        case 'signedOut':
          this.appUserService.clearCurrentUser();

          // Navigation forcée vers /login
          this.router.navigate(['/home'], { replaceUrl: true });
          break;
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
}
