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

/** Cognito groups used in the app */
export type CognitoGroup = 'ADMIN';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private _user = signal<CurrentUser | null>(null);
  readonly user = this._user.asReadonly();

  private _groups = signal<string[]>([]);
  readonly groups = this._groups.asReadonly();


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

      await this.loadGroups();

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

 /**
   * Load current Cognito user group(s) and cast to CognitoGroup type
   */
  async loadGroups(forceRefresh = false): Promise<CognitoGroup[]> {
    const session = await this.getSession(forceRefresh);

    const rawGroups = session?.accessToken?.payload['cognito:groups'];

    const groups = Array.isArray(rawGroups)
      ? (rawGroups as CognitoGroup[])
      : rawGroups
        ? [rawGroups as CognitoGroup]
        : [];

    this._groups.set(groups);
    return groups;
  }

  /**
   * Checks if the user belongs to one group
   * @param groupName a single group name
   * @returns true if the user belongs to this group
   */
  isInGroup(groupName: CognitoGroup): boolean {
    const groups = this._groups();
    return groups.includes(groupName);
  }
}
