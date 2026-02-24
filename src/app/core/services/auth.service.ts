import { Injectable, signal } from '@angular/core';
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  fetchUserAttributes,
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

      // For email/password users, loginId is the email.
      // For OAuth users (Google), loginId is undefined — resolve email via multiple fallbacks.
      let email = signInDetails?.loginId;
      if (!email) {
        // Fallback 1: ID token (most reliable for OAuth — always contains email claim)
        try {
          const session = await fetchAuthSession();
          const tokenEmail = session.tokens?.idToken?.payload?.['email'];
          if (typeof tokenEmail === 'string') {
            email = tokenEmail;
          }
        } catch {
          // Session not available
        }

        // Fallback 2: user attributes
        if (!email) {
          try {
            const attrs = await fetchUserAttributes();
            email = attrs.email;
          } catch {
            // Attributes not available
          }
        }
      }

      const currentUser: CurrentUser = {
        sub: userId,
        username,
        email,
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
    this._groups.set([]);
  }

  /**
   * Clear user and groups signals (used by Hub signedOut handler
   * when signOut is triggered externally, e.g. via Amplify Authenticator).
   */
  clearUser() {
    this._user.set(null);
    this._groups.set([]);
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
