export class SoundJourney {
  id?: string;
  name!: string;
  name_i18n?: Record<string, string>;
  description?: string;
  description_i18n?: Record<string, string>;
  slug!: string;
  color?: string;
  coverImage?: string;
  isPublic?: boolean;
  sortOrder?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;

  constructor(init?: Partial<SoundJourney>) {
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
