export class SoundJourney {
  id?: string;
  name!: string;
  name_i18n?: Record<string, string>;
  description?: string;
  description_i18n?: Record<string, string>;
  slug!: string;
  color?: string;
  coverImage?: string;
  coverImagePosition?: string;
  coverImageZoom?: number;
  isPublic?: boolean;
  sortOrder?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;

  constructor(init?: Partial<SoundJourney>) {
    Object.assign(this, init);
  }
}

export class MonthlyJourney {
  id?: string;
  journeyId!: string;
  month!: string;
  active?: boolean;
  journeyName?: string;
  journeyName_i18n?: Record<string, string>;
  journeyDescription?: string;
  journeyDescription_i18n?: Record<string, string>;
  journeySlug?: string;
  journeyColor?: string;
  journeyCoverImage?: string;

  constructor(init?: Partial<MonthlyJourney>) {
    Object.assign(this, init);
  }
}

export class SoundJourneyStep {
  id?: string;
  journeyId!: string;
  soundId!: string;
  stepOrder!: number;
  themeText?: string;
  themeText_i18n?: Record<string, string>;

  constructor(init?: Partial<SoundJourneyStep>) {
    Object.assign(this, init);
  }
}
