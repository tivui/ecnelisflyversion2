import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { AppUser } from '../models/app-user.model';
import { Language } from '../models/i18n.model';
import { LogService } from './log.service';
import { BehaviorSubject } from 'rxjs';
import { AmplifyService } from './amplify.service';

@Injectable({
  providedIn: 'root',
})
export class AppUserService {
  private readonly authService = inject(AuthService);
  private readonly logService = inject(LogService);
  private readonly amplifyService = inject(AmplifyService);

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
          newNotificationCount: d.newNotificationCount ?? 0,
          flashNew: d.flashNew ?? false,
        };
      } else {
        // 🚀 No user → create minimal
        this.logService.info(
          `No user found, creating minimal user for ${currentAuthUser.username}`
        );

        const newUser = await this.amplifyService.client.models.User.create({
          id: currentAuthUser.sub,
          username: currentAuthUser.email ?? currentAuthUser.username,
          email: currentAuthUser.email ?? '',
          language: 'fr',
          newNotificationCount: 0,
          flashNew: false,
        });

        if (!newUser.data) {
          this.logService.error(
            `Failed to create user for ${currentAuthUser.username}`
          );
          appUser = null;
        } else {
          const d = newUser.data;
          this.logService.info(`User created: ${d.username} (${d.id})`);
          appUser = {
            id: d.id,
            username: d.username,
            email: d.email ?? '',
            language: (d.language ?? 'fr') as Language,
            newNotificationCount: d.newNotificationCount ?? 0,
            flashNew: d.flashNew ?? false,
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
      this.logService.error(`Failed to update language for user ${current.id}`);
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

}
