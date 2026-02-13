import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { AppUser, Theme } from '../models/app-user.model';
import { Language } from '../models/i18n.model';
import { LogService } from './log.service';
import { BehaviorSubject } from 'rxjs';
import { AmplifyService } from './amplify.service';
import { BrowserService } from './browser.service';
import { v4 as uuidv4 } from 'uuid';

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

  /** Synchronous snapshot of the current user */
  get currentUser(): AppUser | null {
    return this._currentUser.value;
  }

  /**
   * Load or create the full AppUser
   * Always resolves with a consistent AppUser | null
   */
  async loadCurrentUser(): Promise<AppUser | null> {
    try {
      const currentAuthUser = await this.authService.loadCurrentUser();
      if (!currentAuthUser) {
        this._currentUser.next(null);
        return null;
      }

      const cognitoSub = currentAuthUser.sub;
      const email =
        currentAuthUser.email ?? currentAuthUser.username ?? 'unknown@user';

      let userRecord = null;

      // --------------------------------------------------
      // 1️⃣ Recherche par cognitoSub (cas normal)
      // --------------------------------------------------
      const bySub =
        await this.amplifyService.client.models.User.getUserByCognitoSub({
          cognitoSub,
        });

      if (bySub.data.length > 0) {
        userRecord = bySub.data[0];
        this.logService.info(`User found by cognitoSub (${userRecord.id})`);
      }

      // --------------------------------------------------
      // 2️⃣ Sinon, recherche par email (cas legacy)
      // --------------------------------------------------
      if (!userRecord) {
        const byEmail =
          await this.amplifyService.client.models.User.getUserByEmail({
            email,
          });

        if (byEmail.data.length > 0) {
          userRecord = byEmail.data[0];

          this.logService.info(
            `User found by email (${userRecord.id}), linking cognitoSub`
          );

          // 🔗 Mise à jour du cognitoSub
          const updated = await this.amplifyService.client.models.User.update({
            id: userRecord.id,
            cognitoSub,
          });

          console.log("updated", updated)

          if (updated.data) {
            userRecord = updated.data;
          }
        }
      }

      // --------------------------------------------------
      // 3️⃣ Sinon, création
      // --------------------------------------------------
      if (!userRecord) {
        this.logService.info(`No user found, creating new AppUser`);

        const { language, country } = this.browserService.getLocale();
        const usernameFromEmail = email.split('@')[0];
        const [firstName, lastName] = usernameFromEmail.split('.');

        const created = await this.amplifyService.client.models.User.create({
          id: uuidv4(),
          cognitoSub,
          email,
          username: usernameFromEmail,
          firstName: firstName ?? usernameFromEmail,
          lastName: lastName ?? '',
          language,
          theme: 'light',
          newNotificationCount: 0,
          flashNew: false,
          country,
        });

        if (!created.data) {
          this.logService.error('User creation failed');
          return null;
        }

        userRecord = created.data;
      }

      // --------------------------------------------------
      // 4️⃣ Mapping vers AppUser
      // --------------------------------------------------
      const appUser: AppUser = {
        id: userRecord.id,
        username: userRecord.username,
        email: userRecord.email ?? undefined,
        language: (userRecord.language ?? 'fr') as Language,
        theme: (userRecord.theme ?? 'light') as Theme,
        newNotificationCount: userRecord.newNotificationCount ?? 0,
        flashNew: userRecord.flashNew ?? false,
        country: userRecord.country,
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
        likedSoundIds: userRecord.likedSoundIds
          ? JSON.parse(userRecord.likedSoundIds)
          : [],
        avatarStyle: userRecord.avatarStyle,
        avatarSeed: userRecord.avatarSeed,
        avatarBgColor: userRecord.avatarBgColor,
        avatarOptions: userRecord.avatarOptions
          ? JSON.parse(userRecord.avatarOptions as string)
          : null,
      };

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
    lastName?: string | null;
    avatarStyle?: string | null;
    avatarSeed?: string | null;
    avatarBgColor?: string | null;
    avatarOptions?: Record<string, string> | null;
  }): Promise<AppUser | null> {
    const current = this._currentUser.value;
    if (!current) return null;

    try {
      // Separate avatarOptions — persisted separately to avoid AppSync auth issues
      const { avatarOptions, ...otherFields } = fields;

      const updated = await this.amplifyService.client.models.User.update({
        id: current.id,
        ...otherFields,
      });

      if (!updated.data) {
        this.logService.error(
          `Failed to update profile for user ${current.id}`,
        );
        return current;
      }

      // Try persisting avatarOptions separately (fails silently if field not deployed)
      if (avatarOptions !== undefined) {
        try {
          await this.amplifyService.client.models.User.update({
            id: current.id,
            avatarOptions: avatarOptions ? JSON.stringify(avatarOptions) : null,
          });
        } catch {
          // Field may not be deployed yet — avatar options will only persist in memory
        }
      }

      const d = updated.data;
      const appUser: AppUser = {
        ...current,
        username: d.username,
        email: d.email ?? undefined,
        country: d.country,
        language: d.language as Language,
        theme: d.theme as Theme,
        firstName: d.firstName,
        lastName: d.lastName,
        avatarStyle: d.avatarStyle,
        avatarSeed: d.avatarSeed,
        avatarBgColor: d.avatarBgColor,
        avatarOptions: avatarOptions !== undefined
          ? (avatarOptions ?? null)
          : current.avatarOptions ?? null,
      };

      this._currentUser.next(appUser);
      return appUser;
    } catch (err) {
      this.logService.error(err);
      return current;
    }
  }
}
