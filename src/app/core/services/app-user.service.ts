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

  /** Guard to prevent concurrent duplicate merges */
  private _mergeInProgress = false;

  /** Synchronous snapshot of the current user */
  get currentUser(): AppUser | null {
    return this._currentUser.value;
  }

  /**
   * Load or create the full AppUser.
   * Handles account linking between email/password and OAuth (Google) logins:
   * - Normalizes email to lowercase for reliable matching
   * - Links accounts by cognitoSub when found by email
   * - Merges duplicate User records if they exist
   */
  async loadCurrentUser(): Promise<AppUser | null> {
    try {
      const currentAuthUser = await this.authService.loadCurrentUser();
      if (!currentAuthUser) {
        this._currentUser.next(null);
        return null;
      }

      const cognitoSub = currentAuthUser.sub;
      const rawEmail =
        currentAuthUser.email ?? currentAuthUser.username ?? 'unknown@user';
      const email = rawEmail.toLowerCase().trim();

      this.logService.info(
        `[AccountLink] cognitoSub=${cognitoSub}, email=${email}, username=${currentAuthUser.username}`
      );

      let userRecord: any = null;

      // --------------------------------------------------
      // 1️⃣ Recherche par cognitoSub (fast path)
      // --------------------------------------------------
      let subRecord: any = null;
      try {
        const bySub =
          await this.amplifyService.client.models.User.getUserByCognitoSub({
            cognitoSub,
          });
        if (bySub.data.length > 0) {
          subRecord = bySub.data[0];
        }
      } catch (e) {
        this.logService.error('cognitoSub search failed: ' + e);
      }

      // --------------------------------------------------
      // 2️⃣ Recherche par email (liaison de compte + detection doublons)
      // --------------------------------------------------
      let emailRecords: any[] = [];
      if (email !== 'unknown@user') {
        try {
          const byEmail =
            await this.amplifyService.client.models.User.getUserByEmail({
              email,
            });
          emailRecords = (byEmail.data ?? []).filter((r: any) => r !== null);
        } catch (e) {
          this.logService.error('Email search failed: ' + e);
        }
      }

      // --------------------------------------------------
      // 3️⃣ Choisir le compte PRINCIPAL (le plus ancien = le vrai compte)
      //    Le cognitoSub peut pointer vers un doublon OAuth vide,
      //    donc on choisit toujours le record le plus ancien.
      // --------------------------------------------------
      const allRecordsMap = new Map<string, any>();
      if (subRecord) allRecordsMap.set(subRecord.id, subRecord);
      for (const r of emailRecords) {
        if (r && !allRecordsMap.has(r.id)) allRecordsMap.set(r.id, r);
      }

      if (allRecordsMap.size > 0) {
        const allRecords = [...allRecordsMap.values()];

        // Score each record: prefer the one with real user data
        const dataScore = (r: any): number => {
          let s = 0;
          if (r.avatarSeed) s += 10;
          if (r.avatarStyle) s += 5;
          if (r.likedSoundIds) s += 3;
          if (r.theme === 'dark') s += 1;
          if (r.firstName || r.lastName) s += 1;
          return s;
        };

        // Sort: highest data score first; on tie, oldest first
        allRecords.sort((a, b) => {
          const sa = dataScore(a);
          const sb = dataScore(b);
          if (sa !== sb) return sb - sa;
          const dateA = a.createdAt
            ? new Date(a.createdAt).getTime()
            : 0;
          const dateB = b.createdAt
            ? new Date(b.createdAt).getTime()
            : 0;
          return dateA - dateB;
        });

        userRecord = allRecords[0];
        this.logService.info(
          `Primary user: ${userRecord.id} (score=${dataScore(userRecord)}, ` +
            `${allRecords.length} total record(s), ` +
            `email=${userRecord.email}, avatar=${userRecord.avatarSeed ?? 'none'})`
        );

        // Re-fetch primary by ID to get ALL fields (index queries may omit avatarOptions etc.)
        try {
          const full = await this.amplifyService.client.models.User.get({ id: userRecord.id });
          if (full.data) {
            userRecord = full.data;
          }
        } catch (e) {
          this.logService.error('Full user fetch failed: ' + e);
        }

        // 4️⃣ Link cognitoSub to primary if it points elsewhere
        //    Don't replace userRecord — the update response may omit fields like avatarOptions
        if (userRecord.cognitoSub !== cognitoSub) {
          try {
            await this.amplifyService.client.models.User.update({
              id: userRecord.id,
              cognitoSub,
            });
            userRecord.cognitoSub = cognitoSub;
            this.logService.info('cognitoSub linked to primary user');
          } catch (e) {
            this.logService.error('Failed to link cognitoSub: ' + e);
          }
        }

        // 5️⃣ Merge duplicates in background (fire-and-forget)
        const duplicates = allRecords.filter(
          (r: any) => r.id !== userRecord!.id
        );
        if (duplicates.length > 0 && !this._mergeInProgress) {
          this.logService.info(
            `Found ${duplicates.length} duplicate(s), merging in background...`
          );
          this.mergeDuplicateUsers(userRecord, duplicates);
        }
      }

      // --------------------------------------------------
      // 5️⃣ Creation uniquement si aucun record trouve
      // --------------------------------------------------
      if (!userRecord) {
        this.logService.info('No user found, creating new AppUser');

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
      // 6️⃣ Mapping vers AppUser
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
        avatarOptions: userRecord.avatarOptions && userRecord.avatarOptions !== '{}'
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

  /**
   * Merge duplicate User records into a primary record (runs in background).
   * Transfers sounds and liked sounds, then neutralizes duplicates.
   * Guarded against concurrent execution.
   */
  private async mergeDuplicateUsers(
    primary: any,
    duplicates: any[]
  ): Promise<void> {
    if (this._mergeInProgress) return;
    this._mergeInProgress = true;

    try {
      for (const dup of duplicates) {
        try {
          // Transfer sounds from duplicate to primary
          let nextToken: string | null | undefined = null;
          do {
            const soundsResult: any =
              await this.amplifyService.client.models.Sound.listSoundsByUserAndStatus(
                { userId: dup.id },
                nextToken ? { nextToken } : {}
              );
            for (const sound of soundsResult.data ?? []) {
              if (sound) {
                try {
                  await this.amplifyService.client.models.Sound.update({
                    id: sound.id,
                    userId: primary.id,
                  });
                } catch {
                  // Sound transfer failed, skip
                }
              }
            }
            nextToken = soundsResult.nextToken;
          } while (nextToken);

          // Merge liked sounds
          if (dup.likedSoundIds) {
            try {
              const dupLikes: string[] = JSON.parse(dup.likedSoundIds);
              const primaryLikes: string[] = primary.likedSoundIds
                ? JSON.parse(primary.likedSoundIds)
                : [];
              const mergedLikes = [
                ...new Set([...primaryLikes, ...dupLikes]),
              ];
              await this.amplifyService.client.models.User.update({
                id: primary.id,
                likedSoundIds: JSON.stringify(mergedLikes),
              });
            } catch {
              // Liked sounds merge failed, skip
            }
          }

          // Neutralize the duplicate (clear identifiers so it's never found again)
          try {
            await this.amplifyService.client.models.User.update({
              id: dup.id,
              email: `merged_${dup.id}@deleted`,
              cognitoSub: `merged_${dup.id}`,
            });
          } catch {
            // Neutralize failed, skip
          }
        } catch {
          // Skip this duplicate and continue
        }
      }

      this.logService.info(
        `Background merge complete: ${duplicates.length} duplicate(s) processed`
      );
    } finally {
      this._mergeInProgress = false;
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

      // Persist avatarOptions in a separate call (AppSync auth requires it)
      let avatarOptionsSaved = false;
      if (avatarOptions !== undefined) {
        try {
          await this.amplifyService.client.models.User.update({
            id: current.id,
            avatarOptions: avatarOptions ? JSON.stringify(avatarOptions) : '{}',
          });
          avatarOptionsSaved = true;
        } catch (e) {
          this.logService.error('avatarOptions save failed: ' + e);
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
