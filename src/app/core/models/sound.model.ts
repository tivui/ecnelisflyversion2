import { CategoryKey } from "../../../../amplify/data/categories";

export class Sound {
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
  status?: 'public' | 'private';

  latitude?: number;
  longitude?: number;
  city?: string;

  category?: CategoryKey;
  secondaryCategory?: string;

  dateTime?: Date;
  recordDateTime?: Date;

  equipment?: string;
  license?: string;

  url?: string;
  urlTitle?: string;
  secondaryUrl?: string;
  secondaryUrlTitle?: string;

  hashtags?: string;

  constructor(init?: Partial<Sound>) {
    Object.assign(this, init);
  }
}
