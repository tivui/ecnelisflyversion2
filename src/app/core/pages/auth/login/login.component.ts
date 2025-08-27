import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';
import { TranslateService } from '@ngx-translate/core';
import { I18n } from 'aws-amplify/utils';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, AmplifyAuthenticatorModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})

export class LoginComponent {
  public authenticatorVisible = signal(true);

  private readonly translate = inject(TranslateService);

  constructor() {
    // Watch language changes from ngx-translate
    this.translate.onLangChange.subscribe(event => {
      I18n.setLanguage(event.lang);

      // Force re-render: hide → show
      this.authenticatorVisible.set(false);
      setTimeout(() => this.authenticatorVisible.set(true), 0);
    });
  }
}
