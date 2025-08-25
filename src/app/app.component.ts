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
import { Hub } from 'aws-amplify/utils';
import { AppUserService } from './core/services/app-user.service';
import { LogService } from './core/services/log.service';
import { Language } from './core/models/i18n.model';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

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
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    FormsModule,
    RouterOutlet,
    RouterLink,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit {
  public readonly authenticator = inject(AuthenticatorService);
  private readonly appUserService = inject(AppUserService);
  private readonly logService = inject(LogService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  public showLogin = signal(false);
  public isDark = signal(false);

  public languages: Language[] = ['en', 'fr', 'es'];
  public selectedLang = signal('fr');

  constructor() {
    const supportedLangs: Language[] = ['en', 'fr'];
    this.translate.addLangs(supportedLangs);

    const savedLang = localStorage.getItem('lang');
    const browserLang = navigator.language.split('-')[0];
    const defaultLang =
      savedLang ||
      (supportedLangs.includes(browserLang as Language) ? browserLang : 'en');

    this.translate.use(defaultLang);
  }

  ngOnInit() {
    // 1️⃣ Chargement initial (rafraîchissement)
    this.appUserService.loadCurrentUser();

    // 2️⃣ Hub auth events
    Hub.listen('auth', async ({ payload }) => {
      // const user = this.authenticator.user;
      switch (payload.event) {
        case 'signedIn': {
          this.logService.info('User signed in via Amplify Hub');

          const appUser = await this.appUserService.loadCurrentUser();
          if (appUser?.language) {
            // Language
            this.selectedLang.set(appUser.language);
            this.translate.use(appUser.language);

            // Theme
            this.isDark.set(appUser.theme === 'dark');
            this.applyTheme(appUser.theme);
          }

          this.router.navigate(['/home']);

          break;
        }

        case 'signedOut':
          this.logService.info('User signed out');
          this.appUserService.clearCurrentUser();
          break;
      }
    });
  }

  toggleDarkMode() {
    const dark = !this.isDark();
    const theme = dark ? 'dark' : 'light';

    this.isDark.set(dark);
    this.applyTheme(theme);

    // Save in DynamoDB
    this.appUserService.updateTheme(theme);
  }

  async changeLang(event: MatSelectChange) {
    const lang = event.value as Language;

    // update local UI immediately
    this.selectedLang.set(lang);
    this.translate.use(lang);
    localStorage.setItem('lang', lang);

    // persist to DynamoDB
    await this.appUserService.updateLanguage(lang);
  }

  private applyTheme(theme: 'light' | 'dark') {
    const body = document.body;
    body.classList.toggle('dark-theme', theme === 'dark');
    body.classList.toggle('light-theme', theme === 'light');
  }
}
