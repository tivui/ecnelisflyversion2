import { inject, Injectable, signal } from '@angular/core';
import { AmplifyService } from './amplify.service';
import { AppUserService } from './app-user.service';
import { LogService } from './log.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class LikeService {
  private readonly amplifyService = inject(AmplifyService);
  private readonly appUserService = inject(AppUserService);
  private readonly logService = inject(LogService);

  /** Set of liked sound IDs for the current user */
  readonly likedSoundIds = signal<Set<string>>(new Set());

  /** Sound IDs currently being processed (anti-double-click) */
  private readonly processing = signal<Set<string>>(new Set());

  constructor() {
    // Sync liked IDs from current user
    this.appUserService.currentUser$
      .pipe(takeUntilDestroyed())
      .subscribe((user) => {
        if (user?.likedSoundIds?.length) {
          this.likedSoundIds.set(new Set(user.likedSoundIds));
        } else {
          this.likedSoundIds.set(new Set());
        }
      });
  }

  /** Check if a sound is liked by the current user */
  isLiked(soundId: string): boolean {
    return this.likedSoundIds().has(soundId);
  }

  /** Check if a sound is currently being processed */
  isProcessing(soundId: string): boolean {
    return this.processing().has(soundId);
  }

  /**
   * Toggle like on a sound.
   * Returns the new likes count, or null if operation failed.
   */
  async toggleLike(soundId: string, currentLikesCount: number): Promise<{ newCount: number } | null> {
    // Guard: user must be authenticated
    const user = this.appUserService.currentUser;
    if (!user) return null;

    // Guard: prevent double-click
    if (this.processing().has(soundId)) return null;

    // Mark as processing
    const newProcessing = new Set(this.processing());
    newProcessing.add(soundId);
    this.processing.set(newProcessing);

    const wasLiked = this.isLiked(soundId);
    const newCount = wasLiked
      ? Math.max(0, currentLikesCount - 1)
      : currentLikesCount + 1;

    // Optimistic UI: toggle immediately
    const newSet = new Set(this.likedSoundIds());
    if (wasLiked) {
      newSet.delete(soundId);
    } else {
      newSet.add(soundId);
    }
    this.likedSoundIds.set(newSet);

    try {
      // Update Sound.likesCount
      await this.amplifyService.client.models.Sound.update({
        id: soundId,
        likesCount: newCount,
      });

      // Update User.likedSoundIds
      await this.amplifyService.client.models.User.update({
        id: user.id,
        likedSoundIds: JSON.stringify([...newSet]),
      });

      this.logService.info(
        `${wasLiked ? 'Unliked' : 'Liked'} sound ${soundId} (count: ${newCount})`,
      );

      return { newCount };
    } catch (error) {
      this.logService.error(error);

      // Rollback on error
      const rollbackSet = new Set(this.likedSoundIds());
      if (wasLiked) {
        rollbackSet.add(soundId);
      } else {
        rollbackSet.delete(soundId);
      }
      this.likedSoundIds.set(rollbackSet);

      return null;
    } finally {
      // Remove from processing
      const doneProcessing = new Set(this.processing());
      doneProcessing.delete(soundId);
      this.processing.set(doneProcessing);
    }
  }
}
