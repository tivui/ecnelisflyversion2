import {
  Component,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit {
  public readonly authenticator = inject(AuthenticatorService);
  private readonly appUserService = inject(AppUserService);
  private readonly logService = inject(LogService);
  private readonly translate = inject(TranslateService);

  public showLogin = signal(false);
  public isDark = signal(false);

  public languages: Language[] = ['en', 'fr', 'es'];
  public selectedLang = signal('fr');

  constructor() {
    // Supported languages in the app
    const supportedLangs: Language[] = ['en', 'fr'];
    this.translate.addLangs(supportedLangs);

    // 1️⃣ Get the previously saved language from localStorage (if any)
    const savedLang = localStorage.getItem('lang');

    // 2️⃣ Otherwise, detect the browser language (e.g. "fr-FR" → "fr")
    const browserLang = navigator.language.split('-')[0];

    // 3️⃣ Choose the final language:
    //    - If a saved language exists, use it
    //    - Else, if browser language is supported, use it
    //    - Else fallback to English
    const defaultLang =
      savedLang ||
      (supportedLangs.includes(browserLang as Language) ? browserLang : 'en');

    // 4️⃣ Apply language settings
    this.translate.use(defaultLang); // set chosen language
  }

  ngOnInit() {
    // Load AppUser if already signed-in at app init (for page refresh)
    this.appUserService.loadCurrentUser();

    // Listen to Amplify auth events
    Hub.listen('auth', async ({ payload }) => {
                const user = this.authenticator.user;

      switch (payload.event) {
        case 'signedIn':
          this.logService.info('User signed in via Amplify Hub');
          // 1️⃣ Pré-remplir directement avec les infos Cognito
          if (user) {
            this.appUserService.setPartialUser({
              username: user.username ?? user.signInDetails?.loginId ?? '',
              email: user.signInDetails?.loginId ?? '',
            });
          }

          // 2️⃣ Puis compléter avec ton backend (attributs custom, rôles, etc.)
          await this.appUserService.loadCurrentUser();
          break;
        case 'signedOut':
          this.logService.info('User signed out');
          this.appUserService.clearCurrentUser();
          break;
      }
    });
  }

  toggleDarkMode() {
    const dark = !this.isDark();
    this.isDark.set(dark);

    const body = document.body;
    body.classList.toggle('dark-theme', dark);
    body.classList.toggle('light-theme', !dark);
  }

  changeLang(event: MatSelectChange) {
    const lang = event.value;
    this.selectedLang.set(lang);
    localStorage.setItem('lang', lang);
    this.translate.use(lang);
  }
}
