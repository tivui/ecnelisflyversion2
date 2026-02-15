import { inject, Injectable } from '@angular/core';
import { AmplifyService } from './amplify.service';
import { AuthService } from './auth.service';
import { QuotaInfo, QUOTA_LIMITS } from '../models/quota.model';

@Injectable({
  providedIn: 'root',
})
export class QuotaService {
  private readonly amplifyService = inject(AmplifyService);
  private readonly authService = inject(AuthService);

  async getUserQuota(userId: string): Promise<QuotaInfo> {
    // Admins have no limits
    if (this.authService.isInGroup('ADMIN')) {
      return {
        weekCount: 0,
        monthCount: 0,
        weekLimit: Infinity,
        monthLimit: Infinity,
        canUpload: true,
        weekRemaining: Infinity,
        monthRemaining: Infinity,
      };
    }

    const now = new Date();

    // Start of current week (Monday)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);

    // Start of current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Load user's sounds (all statuses) with pagination
    const sounds: { createdAt?: string }[] = [];
    let nextToken: string | null | undefined = undefined;

    do {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const result: { data: any[]; nextToken?: string | null } = await (
        this.amplifyService.client.models.Sound.listSoundsByUserAndStatus as any
      )({
        userId,
        limit: 100,
        nextToken,
        selectionSet: ['createdAt'],
      });
      /* eslint-enable @typescript-eslint/no-explicit-any */

      if (result.data) {
        sounds.push(...result.data);
      }
      nextToken = result.nextToken;
    } while (nextToken);

    // Count sounds created this week and this month
    let weekCount = 0;
    let monthCount = 0;

    for (const s of sounds) {
      if (!s.createdAt) continue;
      const createdAt = new Date(s.createdAt);
      if (createdAt >= monthStart) {
        monthCount++;
        if (createdAt >= weekStart) {
          weekCount++;
        }
      }
    }

    const weekRemaining = Math.max(0, QUOTA_LIMITS.WEEKLY - weekCount);
    const monthRemaining = Math.max(0, QUOTA_LIMITS.MONTHLY - monthCount);
    const canUpload = weekRemaining > 0 && monthRemaining > 0;

    return {
      weekCount,
      monthCount,
      weekLimit: QUOTA_LIMITS.WEEKLY,
      monthLimit: QUOTA_LIMITS.MONTHLY,
      canUpload,
      weekRemaining,
      monthRemaining,
    };
  }
}
