import { Injectable } from '@angular/core';
import { Sound } from '../models/sound.model'

@Injectable({
  providedIn: 'root'
})
export class SoundsService {
  // Transforme un objet brut Amplify en instance Sound
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map(raw: any): Sound {
    return new Sound({
      userId: raw.userId,
      title: raw.title,
      title_i18n: raw.title_i18n,
      shortStory: raw.shortStory,
      shortStory_i18n: raw.shortStory_i18n,
      filename: raw.filename,
      status: raw.status,
      latitude: raw.latitude,
      longitude: raw.longitude,
      city: raw.city,
      category: raw.category,
      secondaryCategory: raw.secondaryCategory,
      dateTime: raw.dateTime ? new Date(raw.dateTime) : undefined,
      recordDateTime: raw.recordDateTime ? new Date(raw.recordDateTime) : undefined,
      equipment: raw.equipment,
      layer: raw.layer,
      license: raw.license,
      likesCount: raw.likesCount,
      url: raw.url,
      urlTitle: raw.urlTitle,
      secondaryUrl: raw.secondaryUrl,
      secondaryUrlTitle: raw.secondaryUrlTitle,
      hashtags: raw.hashtags,
      shortHashtags: raw.shortHashtags,
    });
  }
}
