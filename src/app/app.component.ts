import { Component, signal, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TodosComponent } from './todos/todos.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [
    RouterOutlet,
    TodosComponent,
    CommonModule,
    MatToolbarModule,
    MatSlideToggleModule,
    MatIconModule,
    MatButtonModule,
    AmplifyAuthenticatorModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent {
  title = 'ecnelisflyv2';

  isDark = signal(false);
  showLogin = signal(false); // ✅ signal moderne
  authenticator = inject(AuthenticatorService);

  toggleDarkMode() {
    const dark = !this.isDark();
    this.isDark.set(dark);

    const body = document.body;
    body.classList.toggle('dark-theme', dark);
    body.classList.toggle('light-theme', !dark);
  }
}
