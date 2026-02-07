export interface ZonePolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface ZoneCenter {
  lat: number;
  lng: number;
}

export class Zone {
  id?: string;
  name!: string;
  name_i18n?: Record<string, string>;
  description?: string;
  description_i18n?: Record<string, string>;
  slug!: string;
  polygon!: ZonePolygon;
  center?: ZoneCenter;
  defaultZoom?: number;
  coverImage?: string;
  color?: string;
  isPublic?: boolean;
  sortOrder?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;

  constructor(init?: Partial<Zone>) {
    Object.assign(this, init);
  }
}

export class ZoneSound {
  id?: string;
  zoneId!: string;
  soundId!: string;
  sortOrder?: number;

  constructor(init?: Partial<ZoneSound>) {
    Object.assign(this, init);
  }
}
