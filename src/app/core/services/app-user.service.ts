import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { AppUser, Theme } from '../models/app-user.model';
import { Language } from '../models/i18n.model';
import { LogService } from './log.service';
import { BehaviorSubject } from 'rxjs';
import { AmplifyService } from './amplify.service';
import { BrowserService } from './browser.service';

@Injectable({
  providedIn: 'root',
})
export class AppUserService {
  private readonly authService = inject(AuthService);
  private readonly logService = inject(LogService);
  private readonly amplifyService = inject(AmplifyService);
  private readonly browserService = inject(BrowserService);

  private readonly _currentUser = new BehaviorSubject<AppUser | null>(null);
  public readonly currentUser$ = this._currentUser.asObservable();

  /**
   * Load or create the full AppUser
   * Always resolves with a consistent AppUser | null
   */
  async loadCurrentUser(): Promise<AppUser | null> {
    try {
      // 1️⃣ Get the current Cognito user
      const currentAuthUser = await this.authService.loadCurrentUser();
      if (!currentAuthUser) {
        this._currentUser.next(null);
        return null;
      }

      // 2️⃣ Try to load from DynamoDB
      const existing = await this.amplifyService.client.models.User.get({
        id: currentAuthUser.sub,
      });

      let appUser: AppUser | null = null;

      if (existing.data) {
        // ✅ Existing user
        const d = existing.data;
        this.logService.info(`Existing user found: ${d.username} (${d.id})`);
        appUser = {
          id: d.id,
          username: d.username,
          email: d.email ?? '',
          language: (d.language ?? 'fr') as Language,
          theme: (d.theme ?? 'light') as Theme,
          newNotificationCount: d.newNotificationCount ?? 0,
          flashNew: d.flashNew ?? false,
          country: d.country,
          firstName: d.firstName,
          lastName: d.lastName
        };
      } else {
        // 🚀 No user → create minimal user
        this.logService.info(
          `No user found, creating minimal user for ${currentAuthUser.username}`,
        );

        // Get browser locale for language and country
        const { language, country } = this.browserService.getLocale();

        // Derive username from email or fallback to Cognito username
        const email = currentAuthUser.email ?? currentAuthUser.username ?? '';
        const usernameFromEmail = email.split('@')[0]; // e.g., "john.doe@example.com" → "john.doe"

        // Derive firstName and lastName from username
        const nameParts = usernameFromEmail.split('.');
        const firstNameFallback = nameParts[0] ?? usernameFromEmail;
        const lastNameFallback = nameParts[1] ?? '';

        // Create minimal user in DynamoDB with pre-filled fields
        const newUser = await this.amplifyService.client.models.User.create({
          id: currentAuthUser.sub,
          username: usernameFromEmail,
          email: email,
          firstName: firstNameFallback,
          lastName: lastNameFallback,
          language: language,
          theme: 'light',
          newNotificationCount: 0,
          flashNew: false,
          country: country,
        });

        if (!newUser.data) {
          // Creation failed
          this.logService.error(
            `Failed to create user for ${currentAuthUser.username}`,
          );
          appUser = null;
        } else {
          // Creation succeeded
          const d = newUser.data;
          this.logService.info(`User created: ${d.username} (${d.id})`);
          appUser = {
            id: d.id,
            username: d.username,
            email: d.email ?? '',
            firstName: d.firstName,
            lastName: d.lastName,
            language: (d.language ?? 'fr') as Language,
            theme: (d.theme ?? 'light') as Theme,
            newNotificationCount: d.newNotificationCount ?? 0,
            flashNew: d.flashNew ?? false,
            country: d.country,
          };
        }
      }

      // 3️⃣ Update BehaviorSubject
      this._currentUser.next(appUser);
      return appUser;
    } catch (error) {
      this.logService.error(error);
      this._currentUser.next(null);
      return null;
    }
  }

  /** Clear current user */
  clearCurrentUser() {
    this._currentUser.next(null);
  }

  async updateLanguage(lang: Language): Promise<AppUser | null> {
    const current = this._currentUser.value;
    if (!current) return null;

    try {
      // update in DynamoDB
      const updated = await this.amplifyService.client.models.User.update({
        id: current.id,
        language: lang,
      });

      if (!updated.data) {
        this.logService.error(
          `Failed to update language for user ${current.id}`,
        );
        return current;
      }

      const d = updated.data;
      const appUser: AppUser = {
        ...current,
        language: d.language as Language,
      };

      this._currentUser.next(appUser);
      return appUser;
    } catch (err) {
      this.logService.error(err);
      return current;
    }
  }

  async updateTheme(theme: 'light' | 'dark'): Promise<void> {
    const user = this._currentUser.value;
    if (!user) return;

    try {
      await this.amplifyService.client.models.User.update({
        id: user.id,
        theme,
      });

      this._currentUser.next({ ...user, theme });
      this.logService.info(`Theme updated for ${user.username} → ${theme}`);
    } catch (error) {
      this.logService.error(error);
    }
  }

  async updateProfile(fields: {
    username?: string;
    email?: string;
    country?: string | null;
    firstName?: string | null;
    lastName?: string | null
  }): Promise<AppUser | null> {
    const current = this._currentUser.value;
    if (!current) return null;

    try {
      const updated = await this.amplifyService.client.models.User.update({
        id: current.id,
        ...fields,
      });

      if (!updated.data) {
        this.logService.error(
          `Failed to update profile for user ${current.id}`,
        );
        return current;
      }

      const d = updated.data;
      const appUser: AppUser = {
        ...current,
        username: d.username,
        email: d.email,
        country: d.country,
        language: d.language as Language,
        theme: d.theme as Theme,
        firstName: d.firstName,
        lastName: d.lastName
      };

      this._currentUser.next(appUser);
      return appUser;
    } catch (err) {
      this.logService.error(err);
      return current;
    }
  }
}
