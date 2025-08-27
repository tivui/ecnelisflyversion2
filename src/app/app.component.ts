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

  public appUser = signal<AppUser | null>(null);
  public showLogin = signal(false);
  public isDark = signal(false);

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
