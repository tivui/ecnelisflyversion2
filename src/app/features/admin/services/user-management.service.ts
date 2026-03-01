import { inject, Injectable } from '@angular/core';
import { AmplifyService } from '../../../core/services/amplify.service';

export interface AdminUser {
  // DynamoDB fields
  id: string;
  username: string;
  email: string;
  country?: string;
  firstName?: string;
  lastName?: string;
  cognitoSub?: string;
  avatarStyle?: string;
  avatarSeed?: string;
  avatarBgColor?: string;
  avatarOptions?: string;
  likedSoundIds?: string;
  soundCount: number;
  // Cognito enrichment
  cognitoUsername?: string;
  cognitoEnabled?: boolean;
  cognitoStatus?: string;
  cognitoGroups?: string[];
  cognitoProvider?: string;
  cognitoCreatedAt?: string;
}

export type UserTypeFilter = 'all' | 'imported' | 'registered';
export type UserStatusFilter = 'all' | 'active' | 'disabled';
export type UserRoleFilter = 'all' | 'admin' | 'user';
export type SortField = 'username' | 'sounds' | 'date';

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  private readonly amplifyService = inject(AmplifyService);

  async loadAllUsers(): Promise<AdminUser[]> {
    const rawUsers: any[] = [];
    let nextToken: string | null | undefined = undefined;

    do {
      const page: any = await this.amplifyService.client.models.User.list({
        limit: 500,
        nextToken: nextToken ?? undefined,
        selectionSet: [
          'id', 'username', 'email', 'country', 'firstName', 'lastName',
          'cognitoSub', 'avatarStyle', 'avatarSeed', 'avatarBgColor',
          'avatarOptions', 'likedSoundIds',
        ],
      });
      rawUsers.push(...(page.data ?? []));
      nextToken = page.nextToken ?? null;
    } while (nextToken);

    // Filter out neutralized/merged users
    const activeUsers = rawUsers.filter(
      (u) => u && !u.email?.startsWith('merged_'),
    );

    // Count sounds per user
    const users: AdminUser[] = [];
    for (const user of activeUsers) {
      let soundCount = 0;
      let soundToken: string | null | undefined = undefined;

      do {
        const soundPage: any =
          await this.amplifyService.client.models.Sound.listSoundsByUserAndStatus(
            { userId: user.id },
            { limit: 500, nextToken: soundToken ?? undefined, selectionSet: ['id'] },
          );
        soundCount += (soundPage.data ?? []).length;
        soundToken = soundPage.nextToken ?? null;
      } while (soundToken);

      users.push({
        id: user.id,
        username: user.username,
        email: user.email,
        country: user.country ?? undefined,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        cognitoSub: user.cognitoSub ?? undefined,
        avatarStyle: user.avatarStyle ?? undefined,
        avatarSeed: user.avatarSeed ?? undefined,
        avatarBgColor: user.avatarBgColor ?? undefined,
        avatarOptions: user.avatarOptions ?? undefined,
        likedSoundIds: user.likedSoundIds ?? undefined,
        soundCount,
      });
    }

    return users;
  }

  async enrichWithCognitoData(users: AdminUser[]): Promise<void> {
    try {
      const result: any = await (this.amplifyService.client as any).mutations.manageCognitoUser({
        action: 'listUserStatuses',
      });

      console.log('[UserManagement] Raw mutation result:', JSON.stringify(result)?.substring(0, 500));

      // Normalize response — result.data is the Lambda response (a.json())
      const raw = result.data;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

      console.log('[UserManagement] Parsed response keys:', parsed ? Object.keys(parsed) : 'null');

      if (!parsed?.users) {
        console.warn('[UserManagement] No users field in parsed response:', parsed);
        return;
      }

      const cognitoUsers: Array<{
        sub: string;
        email: string;
        username: string;
        enabled: boolean;
        status: string;
        createdAt: string;
        provider: string;
        groups: string[];
      }> = typeof parsed.users === 'string'
        ? JSON.parse(parsed.users)
        : parsed.users;

      console.log(`[UserManagement] Cognito users count: ${cognitoUsers.length}`);
      if (cognitoUsers.length > 0) {
        console.log('[UserManagement] First Cognito user sample:', JSON.stringify(cognitoUsers[0]));
      }

      // Build lookup maps: by sub (primary) and by email (fallback)
      const bySub = new Map(cognitoUsers.map((cu) => [cu.sub, cu]));
      const byEmail = new Map(
        cognitoUsers
          .filter((cu) => cu.email)
          .map((cu) => [cu.email.toLowerCase(), cu]),
      );

      let matchedCount = 0;
      for (const user of users) {
        // Try matching by cognitoSub first, then by email
        let cu = user.cognitoSub ? bySub.get(user.cognitoSub) : undefined;
        if (!cu && user.email) {
          cu = byEmail.get(user.email.toLowerCase());
        }
        if (!cu) continue;

        matchedCount++;
        user.cognitoUsername = cu.username;
        user.cognitoEnabled = cu.enabled;
        user.cognitoStatus = cu.status;
        user.cognitoGroups = cu.groups;
        user.cognitoProvider = cu.provider;
        user.cognitoCreatedAt = cu.createdAt;
      }
      console.log(`[UserManagement] Matched ${matchedCount}/${users.length} users with Cognito data`);
    } catch (e) {
      console.error('[UserManagement] enrichWithCognitoData failed:', e);
      throw e;
    }
  }

  async disableUser(cognitoUsername: string): Promise<void> {
    await (this.amplifyService.client as any).mutations.manageCognitoUser({
      action: 'disableUser',
      username: cognitoUsername,
    });
  }

  async enableUser(cognitoUsername: string): Promise<void> {
    await (this.amplifyService.client as any).mutations.manageCognitoUser({
      action: 'enableUser',
      username: cognitoUsername,
    });
  }

  async addToAdminGroup(cognitoUsername: string): Promise<void> {
    await (this.amplifyService.client as any).mutations.manageCognitoUser({
      action: 'addToGroup',
      username: cognitoUsername,
      groupName: 'ADMIN',
    });
  }

  async removeFromAdminGroup(cognitoUsername: string): Promise<void> {
    await (this.amplifyService.client as any).mutations.manageCognitoUser({
      action: 'removeFromGroup',
      username: cognitoUsername,
      groupName: 'ADMIN',
    });
  }

  async deleteCognitoUser(cognitoUsername: string): Promise<void> {
    await (this.amplifyService.client as any).mutations.manageCognitoUser({
      action: 'deleteUser',
      username: cognitoUsername,
    });
  }

  async deleteDynamoUser(userId: string): Promise<void> {
    await (this.amplifyService.client as any).models.User.delete({ id: userId });
  }

  async deleteUserSounds(userId: string): Promise<number> {
    // Collect all sound IDs first (GSI pagination trap)
    const allSoundIds: string[] = [];
    let nextToken: string | null | undefined = undefined;

    do {
      const page: any =
        await this.amplifyService.client.models.Sound.listSoundsByUserAndStatus(
          { userId },
          { limit: 500, nextToken: nextToken ?? undefined, selectionSet: ['id'] },
        );
      for (const s of page.data ?? []) {
        if (s?.id) allSoundIds.push(s.id);
      }
      nextToken = page.nextToken ?? null;
    } while (nextToken);

    // Delete each sound
    for (const id of allSoundIds) {
      try {
        await (this.amplifyService.client as any).models.Sound.delete({ id });
      } catch (e) {
        console.warn(`[UserManagement] Failed to delete sound ${id}:`, e);
      }
    }

    return allSoundIds.length;
  }
}
