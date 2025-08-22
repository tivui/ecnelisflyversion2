import {
  Component,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import {
  AmplifyAuthenticatorModule,
  AuthenticatorService,
} from '@aws-amplify/ui-angular';
import { Hub } from 'aws-amplify/utils';
import { AppUserService } from './core/services/app-user.service';
import { LogService } from './core/services/log.service';

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
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit {
  public readonly authenticator = inject(AuthenticatorService);
  private readonly appUserService = inject(AppUserService);
  private readonly logService = inject(LogService);

  public showLogin = signal(false);
  public isDark = signal(false);

  ngOnInit() {
    // Load AppUser if already signed-in at app init (for page refresh)
    this.appUserService.loadCurrentUser();

    // Listen to Amplify auth events
    Hub.listen('auth', async ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          this.logService.info('User signed in via Amplify Hub');
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
}
