import { CategoryKey } from "../../../../amplify/data/categories";

export type SoundStatus = 'private' | 'public_to_be_approved' | 'public';
export type LicenseType = 'READ_ONLY' | 'PUBLIC_DOMAIN' | 'CC_BY' | 'CC_BY_NC';

export class Sound {
  id?: string;
  userId!: string;

  // User info à exposer
  user?: {
    username: string;
    country?: string;
  };

  title!: string;
  title_i18n?: Record<string, string>;

  shortStory?: string;
  shortStory_i18n?: Record<string, string>;

  filename!: string;
  status?: SoundStatus;

  latitude?: number;
  longitude?: number;
  city?: string;

  category?: CategoryKey;
  secondaryCategory?: string;

  dateTime?: Date;
  recordDateTime?: Date;

  equipment?: string;
  license?: LicenseType;

  url?: string;
  urlTitle?: string;
  secondaryUrl?: string;
  secondaryUrlTitle?: string;

  hashtags?: string;

  constructor(init?: Partial<Sound>) {
    Object.assign(this, init);
  }
}
