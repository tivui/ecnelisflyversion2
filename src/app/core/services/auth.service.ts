import { Injectable, signal } from '@angular/core';
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth';

export interface CurrentUser {
  sub: string;
  username: string;
  email?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private _user = signal<CurrentUser | null>(null);
  readonly user = this._user.asReadonly();

  /**
   * Load the currently authenticated user.
   * Returns null if no valid session exists.
   */
  async loadCurrentUser(): Promise<CurrentUser | null> {
    try {
      const { username, userId, signInDetails } = await getCurrentUser();

      const currentUser: CurrentUser = {
        sub: userId,
        username,
        email: signInDetails?.loginId,
      };

      this._user.set(currentUser);
      return currentUser;
    } catch {
      this._user.set(null);
      return null;
    }
  }

  /**
   * Retrieve the current auth session and tokens (idToken, accessToken, etc.)
   */
  async getSession(forceRefresh = false) {
    const session = await fetchAuthSession({ forceRefresh });
    return session.tokens ?? null;
  }

  /**
   * Check if a valid session exists (user is authenticated).
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.loadCurrentUser();
      return this._user() !== null;
    } catch {
      return false;
    }
  }

  /**
   * Sign in with username and password.
   */
  async signIn(username: string, password: string) {
    return signIn({ username, password });
  }

  /**
   * Sign out and clear current user.
   */
  async signOut() {
    await signOut();
    this._user.set(null);
  }
}
