import { inject, Injectable } from '@angular/core';
import type { Schema } from '../../../../amplify/data/resource';
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

  // Global observable of current AppUser
  private readonly _currentUser = new BehaviorSubject<AppUser | null>(null);
  public readonly currentUser$ = this._currentUser.asObservable();

  /**
   * Load or create the AppUser and emit it to the observable
   */
  async loadCurrentUser() {
    const currentAuthUser = await this.authService.loadCurrentUser();
    if (!currentAuthUser) {
      // No authenticated user, emit null
      this._currentUser.next(null);
      return null;
    }

    // Fetch user from backend
    const existing = await this.amplifyService.client.models.User.get({
      id: currentAuthUser.sub,
    });
    let appUser: AppUser | null;

    if (existing.data) {
      const data = existing.data;
      this.logService.info(
        `Existing user found: ${data.username} (${data.id})`,
      );
      appUser = {
        id: data.id,
        username: data.username,
        email: data.email ?? '',
        language: (data.language ?? 'fr') as Language,
        newNotificationCount: data.newNotificationCount ?? 0,
        flashNew: data.flashNew ?? false,
      };
    } else {
      // Create minimal user if not found
      this.logService.info(
        `No existing user found. Creating minimal user for ${currentAuthUser.username}`,
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
          `Failed to create user for ${currentAuthUser.username}`,
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

    // Emit the current AppUser
    this._currentUser.next(appUser);
    return appUser;
  }

  /**
   * Update the current AppUser in the backend
   */
  async updateUser(data: Partial<Schema['User']['type']>) {
    const current = this.authService.user();
    if (!current) return null;

    const updated = await this.amplifyService.client.models.User.update({
      id: current.sub,
      ...data,
    });
    this.logService.info(`User updated: ${current.sub}`);
    // Refresh currentUser observable
    await this.loadCurrentUser();
    return updated;
  }

  /**
   * ⚡ Pré-remplir l'utilisateur dès le login Cognito (avant le backend)
   */
  setPartialUser(partial: Partial<AppUser>) {
    const current = this._currentUser.value; // ← on repart de ce qu’on a déjà
    this._currentUser.next({
      ...(current ?? {}), // merge avec l’existant
      ...partial, // ajoute/écrase les champs fournis
    } as AppUser);
  }

  /**
   * Clear the current AppUser (on logout)
   */
  clearCurrentUser() {
    this._currentUser.next(null);
  }
}
