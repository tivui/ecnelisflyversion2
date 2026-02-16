import { inject, Injectable } from '@angular/core';
import { Sound } from '../models/sound.model'
import { StorageService } from './storage.service';
import { AmplifyService } from './amplify.service';

export interface CommunityStats {
  soundCount: number;
  countryCount: number;
  contributorCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class SoundsService {
  private readonly storageService = inject(StorageService);
  private readonly amplifyService = inject(AmplifyService);

  // Transform raw dynamo db object any to client sound model used in the app
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map(raw: any): Sound {
    return new Sound({
      id: raw.id,
      userId: raw.userId,
      user: raw.user
        ? {
            username: raw.user.username,
            country: raw.user.country,
          }
        : undefined,
      title: raw.title,
      title_i18n: raw.title_i18n ? JSON.parse(raw.title_i18n) : undefined,
      shortStory: raw.shortStory,
      shortStory_i18n: raw.shortStory_i18n
        ? JSON.parse(raw.shortStory_i18n)
        : undefined,
      filename: raw.filename,
      status: raw.status,
      latitude: raw.latitude,
      longitude: raw.longitude,
      city: raw.city,
      category: raw.category,
      secondaryCategory: raw.secondaryCategory,
      dateTime: raw.dateTime ? new Date(raw.dateTime) : undefined,
      recordDateTime: raw.recordDateTime
        ? new Date(raw.recordDateTime)
        : undefined,
      equipment: raw.equipment,
      license: raw.license,
      url: raw.url,
      urlTitle: raw.urlTitle,
      secondaryUrl: raw.secondaryUrl,
      secondaryUrlTitle: raw.secondaryUrlTitle,
      hashtags: raw.hashtags,
      likesCount: raw.likesCount ?? 0,
      createdAt: raw.createdAt ? new Date(raw.createdAt) : undefined,
    });
  }

  /**
   * Fetch all public sounds with client-side pagination.
   * Uses the listSoundsByStatus GSI directly (no Lambda) to avoid
   * the AppSync 1 MB response payload limit.
   */
  async fetchAllPublicSounds(): Promise<Sound[]> {
    const allItems: Sound[] = [];
    let nextToken: string | null | undefined = undefined;

    do {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page: any =
        await this.amplifyService.client.models.Sound.listSoundsByStatus(
          { status: 'public' },
          {
            limit: 200,
            nextToken: nextToken ?? undefined,
            selectionSet: [
              'id',
              'userId',
              'title',
              'title_i18n',
              'filename',
              'city',
              'category',
              'secondaryCategory',
              'latitude',
              'longitude',
              'status',
            ],
          },
        );

      const data = page.data ?? [];
      for (const raw of data) {
        allItems.push(this.map(raw));
      }
      nextToken = page.nextToken ?? null;
    } while (nextToken);

    return allItems;
  }

  /**
   * Get a single Sound by its ID
   */
  async getSoundById(id: string): Promise<Sound | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (this.amplifyService.client.models.Sound as any).get({ id });
    if (result.errors?.length) {
      console.error('Error getting sound:', result.errors);
      return null;
    }
    return result.data ? this.map(result.data) : null;
  }

  /**
   * Get a presigned URL for a Sound's audio file
   * @param sound Sound object
   */
  async getAudioUrl(sound: Sound): Promise<string> {
    if (!sound.filename) {
      throw new Error('Sound has no filename');
    }
    return this.storageService.getSoundUrl(sound.filename);
  }

  // --- Community stats (cached 5 min) ---

  private cachedStats: { data: CommunityStats; ts: number } | null = null;

  async getCommunityStats(): Promise<CommunityStats> {
    const now = Date.now();
    if (this.cachedStats && now - this.cachedStats.ts < 5 * 60_000) {
      return this.cachedStats.data;
    }

    const userIds = new Set<string>();
    const countries = new Set<string>();
    let soundCount = 0;
    let nextToken: string | null | undefined = undefined;

    do {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page: any =
        await this.amplifyService.client.models.Sound.listSoundsByStatus(
          { status: 'public' },
          {
            limit: 500,
            nextToken: nextToken ?? undefined,
            authMode: 'apiKey',
            selectionSet: ['id', 'userId', 'city'],
          },
        );

      const data = page.data ?? [];
      for (const raw of data) {
        soundCount++;
        if (raw.userId) userIds.add(raw.userId);
        if (raw.city) {
          // city often contains "City, Country" — extract last segment
          const parts = (raw.city as string).split(',');
          const country = parts[parts.length - 1]?.trim();
          if (country) countries.add(country.toLowerCase());
        }
      }
      nextToken = page.nextToken ?? null;
    } while (nextToken);

    const stats: CommunityStats = {
      soundCount,
      countryCount: countries.size,
      contributorCount: userIds.size,
    };
    this.cachedStats = { data: stats, ts: now };
    return stats;
  }

  // Detect MIME type from file extension
  getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'mp3': return 'audio/mpeg';
      case 'wav': return 'audio/wav';
      case 'ogg': return 'audio/ogg';
      case 'aac': return 'audio/aac';
      case 'flac': return 'audio/flac';
      case 'm4a': return 'audio/mp4';
      case 'opus': return 'audio/opus';
      default: return 'application/octet-stream';
    }
  }
}

