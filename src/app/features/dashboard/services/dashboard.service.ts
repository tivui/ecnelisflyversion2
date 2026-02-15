import { inject, Injectable } from '@angular/core';
import { AmplifyService } from '../../../core/services/amplify.service';
import { SoundsService } from '../../../core/services/sounds.service';
import { StorageService } from '../../../core/services/storage.service';
import { Sound } from '../../../core/models/sound.model';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly amplifyService = inject(AmplifyService);
  private readonly soundsService = inject(SoundsService);
  private readonly storageService = inject(StorageService);

  /**
   * Load sounds for a specific user
   * Uses the existing secondary index: listSoundsByUserAndStatus
   * Handles pagination with nextToken to load all sounds
   */
  async loadUserSounds(userId: string): Promise<Sound[]> {
    try {
      const allSounds: Sound[] = [];
      let nextToken: string | null | undefined = undefined;

      do {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const result: { data: any[]; nextToken?: string | null } = await (
          this.amplifyService.client.models.Sound.listSoundsByUserAndStatus as any
        )({
          userId,
          limit: 100,
          nextToken,
        });
        /* eslint-enable @typescript-eslint/no-explicit-any */

        if (result.data) {
          allSounds.push(...result.data.map((raw) => this.soundsService.map(raw)));
        }

        nextToken = result.nextToken;
      } while (nextToken);

      return allSounds;
    } catch (error) {
      console.error('[DashboardService] Failed to load user sounds:', error);
      throw error;
    }
  }

  /**
   * Load all sounds (admin only)
   * Handles pagination with nextToken to load all sounds
   */
  async loadAllSounds(): Promise<Sound[]> {
    const selectionSet = [
      'id',
      'userId',
      'user.username',
      'user.country',
      'title',
      'title_i18n',
      'shortStory',
      'shortStory_i18n',
      'filename',
      'status',
      'latitude',
      'longitude',
      'city',
      'category',
      'secondaryCategory',
      'dateTime',
      'recordDateTime',
      'equipment',
      'license',
      'url',
      'urlTitle',
      'secondaryUrl',
      'secondaryUrlTitle',
      'hashtags',
      'likesCount',
      'createdAt',
      'updatedAt',
    ] as const;

    try {
      const allSounds: Sound[] = [];
      let nextToken: string | null | undefined = undefined;

      do {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const result: { data: any[]; nextToken?: string | null } = await (
          this.amplifyService.client.models.Sound.list as any
        )({
          selectionSet,
          limit: 100,
          nextToken,
        });
        /* eslint-enable @typescript-eslint/no-explicit-any */

        if (result.data) {
          allSounds.push(...result.data.map((raw) => this.soundsService.map(raw)));
        }

        nextToken = result.nextToken;
      } while (nextToken);

      return allSounds;
    } catch (error) {
      console.error('[DashboardService] Failed to load all sounds:', error);
      throw error;
    }
  }

  /**
   * Update sound metadata
   */
  async updateSound(
    soundId: string,
    data: Partial<Sound>,
  ): Promise<Sound | null> {
    try {
      // Prepare update payload - use bracket notation for index signature access
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatePayload: Record<string, any> = {
        id: soundId,
      };

      // Map client-side Sound fields to DynamoDB fields
      if (data['title'] !== undefined) updatePayload['title'] = data['title'];
      if (data['title_i18n'] !== undefined) {
        updatePayload['title_i18n'] = JSON.stringify(data['title_i18n']);
      }
      if (data['shortStory'] !== undefined) {
        updatePayload['shortStory'] = data['shortStory'];
      }
      if (data['shortStory_i18n'] !== undefined) {
        updatePayload['shortStory_i18n'] = JSON.stringify(data['shortStory_i18n']);
      }
      if (data['category'] !== undefined) updatePayload['category'] = data['category'];
      if (data['secondaryCategory'] !== undefined) {
        updatePayload['secondaryCategory'] = data['secondaryCategory'];
      }
      if (data['recordDateTime'] !== undefined) {
        const recordDate = data['recordDateTime'];
        updatePayload['recordDateTime'] = recordDate
          ? recordDate.toISOString().split('T')[0]
          : null;
      }
      if (data['equipment'] !== undefined) updatePayload['equipment'] = data['equipment'];
      if (data['latitude'] !== undefined) updatePayload['latitude'] = data['latitude'];
      if (data['longitude'] !== undefined) updatePayload['longitude'] = data['longitude'];
      if (data['city'] !== undefined) updatePayload['city'] = data['city'];
      if (data['url'] !== undefined) updatePayload['url'] = data['url'] || null;
      if (data['urlTitle'] !== undefined) updatePayload['urlTitle'] = data['urlTitle'] || null;
      if (data['secondaryUrl'] !== undefined) {
        updatePayload['secondaryUrl'] = data['secondaryUrl'] || null;
      }
      if (data['secondaryUrlTitle'] !== undefined) {
        updatePayload['secondaryUrlTitle'] = data['secondaryUrlTitle'] || null;
      }
      if (data['license'] !== undefined) updatePayload['license'] = data['license'];
      if (data['status'] !== undefined) updatePayload['status'] = data['status'];
      if (data['hashtags'] !== undefined) updatePayload['hashtags'] = data['hashtags'];

      // Cast to any for Amplify client compatibility
      const result = await this.amplifyService.client.models.Sound.update(
        updatePayload as Parameters<typeof this.amplifyService.client.models.Sound.update>[0]
      );

      if (result.data) {
        return this.soundsService.map(result.data);
      }

      return null;
    } catch (error) {
      console.error('[DashboardService] Failed to update sound:', error);
      throw error;
    }
  }

  /**
   * Delete sound (record + S3 file)
   */
  async deleteSound(sound: Sound & { id?: string }): Promise<boolean> {
    try {
      if (!sound.id) {
        throw new Error('Sound ID is required for deletion');
      }

      // Delete from DynamoDB first
      await this.amplifyService.client.models.Sound.delete({
        id: sound.id,
      });

      // Delete file from S3 (fire-and-forget, don't fail if file doesn't exist)
      if (sound.filename) {
        try {
          await this.storageService.deleteSound(sound.filename);
        } catch (fileError) {
          console.warn(
            '[DashboardService] Failed to delete sound file (may not exist):',
            fileError,
          );
        }
      }

      return true;
    } catch (error) {
      console.error('[DashboardService] Failed to delete sound:', error);
      throw error;
    }
  }

  /**
   * Get audio URL for a sound
   */
  async getAudioUrl(sound: Sound): Promise<string> {
    return this.soundsService.getAudioUrl(sound);
  }

  /**
   * Load all users (admin only)
   */
  async loadAllUsers(): Promise<{ id: string; username: string; createdAt?: string }[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const users: any[] = [];
      let nextToken: string | null | undefined = undefined;

      do {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const result: { data: any[]; nextToken?: string | null } = await (
          this.amplifyService.client.models.User.list as any
        )({
          selectionSet: ['id', 'username', 'createdAt'],
          limit: 100,
          nextToken,
          authMode: 'userPool',
        });
        /* eslint-enable @typescript-eslint/no-explicit-any */

        if (result.data) {
          users.push(...result.data);
        }
        nextToken = result.nextToken;
      } while (nextToken);

      return users;
    } catch (error) {
      console.error('[DashboardService] Failed to load users:', error);
      throw error;
    }
  }
}
