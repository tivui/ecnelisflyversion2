import { inject, Injectable } from '@angular/core';
import { Sound } from '../models/sound.model'
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class SoundsService {
  private readonly storageService = inject(StorageService);

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
      hashtags: raw.hashtags
    });
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

