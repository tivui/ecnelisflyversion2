export class FeaturedSoundCandidate {
  id?: string;
  soundId!: string;
  teasing!: string;
  teasing_i18n?: Record<string, string>;
  isActive?: boolean;
  sortOrder?: number;

  constructor(init?: Partial<FeaturedSoundCandidate>) {
    Object.assign(this, init);
  }
}

export class DailyFeaturedSound {
  id?: string;
  date!: string;
  featuredCandidateId!: string;
  soundId!: string;
  teasing?: string;
  teasing_i18n?: Record<string, string>;
  soundTitle?: string;
  soundCity?: string;
  soundLatitude?: number;
  soundLongitude?: number;
  soundCategory?: string;
  soundSecondaryCategory?: string;
  soundFilename?: string;

  constructor(init?: Partial<DailyFeaturedSound>) {
    Object.assign(this, init);
  }
}
