import { inject, Injectable } from '@angular/core';
import { getUrl, uploadData } from 'aws-amplify/storage';
import { Observable } from 'rxjs';
import { AmplifyService } from './amplify.service';
import { Zone, ZoneSound, ZonePolygon, ZoneCenter, MonthlyZone } from '../models/zone.model';
import { Sound } from '../models/sound.model';
import { SoundsService } from './sounds.service';
import { generateUniqueFilename } from './filename.service';

@Injectable({
  providedIn: 'root',
})
export class ZoneService {
  private readonly amplifyService = inject(AmplifyService);
  private readonly soundsService = inject(SoundsService);

  private get client() {
    return this.amplifyService.client;
  }

  // Transform raw DynamoDB object to Zone model
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapZone(raw: any): Zone {
    return new Zone({
      id: raw.id,
      name: raw.name,
      name_i18n: raw.name_i18n ? JSON.parse(raw.name_i18n) : undefined,
      description: raw.description,
      description_i18n: raw.description_i18n
        ? JSON.parse(raw.description_i18n)
        : undefined,
      slug: raw.slug,
      polygon: raw.polygon ? JSON.parse(raw.polygon) : undefined,
      center: raw.center ? JSON.parse(raw.center) : undefined,
      defaultZoom: raw.defaultZoom,
      coverImage: raw.coverImage,
      coverImagePosition: raw.coverImagePosition,
      coverImageZoom: raw.coverImageZoom,
      ambientSound: raw.ambientSound,
      ambientSoundLabel: raw.ambientSoundLabel,
      icon: raw.icon,
      timelineEnabled: raw.timelineEnabled,
      color: raw.color,
      isPublic: raw.isPublic,
      sortOrder: raw.sortOrder,
      createdBy: raw.createdBy,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  // Transform raw DynamoDB object to ZoneSound model
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapZoneSound(raw: any): ZoneSound {
    return new ZoneSound({
      id: raw.id,
      zoneId: raw.zoneId,
      soundId: raw.soundId,
      sortOrder: raw.sortOrder,
    });
  }

  // ============ ZONE CRUD ============

  async listZones(): Promise<Zone[]> {
    const result = await (this.client.models.Zone.list as any)({ authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error listing zones:', result.errors);
      throw new Error('Failed to list zones');
    }
    return (result.data ?? []).map((z: any) => this.mapZone(z));
  }

  async listPublicZones(): Promise<Zone[]> {
    const zones = await this.listZones();
    return zones
      .filter((z) => z.isPublic)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async getZoneById(id: string): Promise<Zone | null> {
    const result = await (this.client.models.Zone.get as any)({ id }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error getting zone:', result.errors);
      throw new Error('Failed to get zone');
    }
    return result.data ? this.mapZone(result.data) : null;
  }

  async getZoneBySlug(slug: string): Promise<Zone | null> {
    const result = await (this.client.models.Zone.getZoneBySlug as any)({ slug }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error getting zone by slug:', result.errors);
      throw new Error('Failed to get zone by slug');
    }
    const zones = result.data ?? [];
    return zones.length > 0 ? this.mapZone(zones[0]) : null;
  }

  async createZone(zone: Partial<Zone>): Promise<Zone> {
    const input = {
      name: zone.name!,
      name_i18n: zone.name_i18n ? JSON.stringify(zone.name_i18n) : undefined,
      description: zone.description,
      description_i18n: zone.description_i18n
        ? JSON.stringify(zone.description_i18n)
        : undefined,
      slug: zone.slug!,
      polygon: JSON.stringify(zone.polygon),
      center: zone.center ? JSON.stringify(zone.center) : undefined,
      defaultZoom: zone.defaultZoom ?? 12,
      coverImage: zone.coverImage,
      coverImagePosition: zone.coverImagePosition ?? 'center',
      coverImageZoom: zone.coverImageZoom ?? 100,
      ambientSound: zone.ambientSound,
      ambientSoundLabel: zone.ambientSoundLabel,
      icon: zone.icon ?? 'terrain',
      timelineEnabled: zone.timelineEnabled ?? false,
      color: zone.color ?? '#1976d2',
      isPublic: zone.isPublic ?? true,
      sortOrder: zone.sortOrder ?? 0,
      createdBy: zone.createdBy,
    };

    const result = await this.client.models.Zone.create(input);
    if (result.errors?.length) {
      console.error('Error creating zone:', result.errors);
      throw new Error('Failed to create zone');
    }
    return this.mapZone(result.data);
  }

  async updateZone(id: string, updates: Partial<Zone>): Promise<Zone> {
    const input: Record<string, unknown> = { id };

    if (updates.name !== undefined) input['name'] = updates.name;
    if (updates.name_i18n !== undefined)
      input['name_i18n'] = JSON.stringify(updates.name_i18n);
    if (updates.description !== undefined)
      input['description'] = updates.description;
    if (updates.description_i18n !== undefined)
      input['description_i18n'] = JSON.stringify(updates.description_i18n);
    if (updates.slug !== undefined) input['slug'] = updates.slug;
    if (updates.polygon !== undefined)
      input['polygon'] = JSON.stringify(updates.polygon);
    if (updates.center !== undefined)
      input['center'] = JSON.stringify(updates.center);
    if (updates.defaultZoom !== undefined)
      input['defaultZoom'] = updates.defaultZoom;
    if (updates.coverImage !== undefined)
      input['coverImage'] = updates.coverImage;
    if (updates.coverImagePosition !== undefined)
      input['coverImagePosition'] = updates.coverImagePosition;
    if (updates.coverImageZoom !== undefined)
      input['coverImageZoom'] = updates.coverImageZoom;
    if (updates.ambientSound !== undefined)
      input['ambientSound'] = updates.ambientSound;
    if (updates.ambientSoundLabel !== undefined)
      input['ambientSoundLabel'] = updates.ambientSoundLabel;
    if (updates.icon !== undefined) input['icon'] = updates.icon;
    if (updates.timelineEnabled !== undefined)
      input['timelineEnabled'] = updates.timelineEnabled;
    if (updates.color !== undefined) input['color'] = updates.color;
    if (updates.isPublic !== undefined) input['isPublic'] = updates.isPublic;
    if (updates.sortOrder !== undefined) input['sortOrder'] = updates.sortOrder;

    const result = await this.client.models.Zone.update(input as any);
    if (result.errors?.length) {
      console.error('Error updating zone:', result.errors);
      throw new Error('Failed to update zone');
    }
    return this.mapZone(result.data);
  }

  async deleteZone(id: string): Promise<void> {
    // First delete all ZoneSound associations
    const zoneSounds = await this.listZoneSoundsByZone(id);
    for (const zs of zoneSounds) {
      await this.deleteZoneSound(zs.id!);
    }

    const result = await this.client.models.Zone.delete({ id });
    if (result.errors?.length) {
      console.error('Error deleting zone:', result.errors);
      throw new Error('Failed to delete zone');
    }
  }

  // ============ ZONE-SOUND ASSOCIATIONS ============

  async listZoneSoundsByZone(zoneId: string): Promise<ZoneSound[]> {
    const result = await (
      this.client.models.ZoneSound.listZoneSoundsByZone as any
    )({ zoneId }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error listing zone sounds:', result.errors);
      throw new Error('Failed to list zone sounds');
    }
    return (result.data ?? []).map((zs: any) => this.mapZoneSound(zs));
  }

  async listZoneSoundsBySound(soundId: string): Promise<ZoneSound[]> {
    const result = await (
      this.client.models.ZoneSound.listZoneSoundsBySound as any
    )({ soundId }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error listing zone sounds by sound:', result.errors);
      throw new Error('Failed to list zone sounds by sound');
    }
    return (result.data ?? []).map((zs: any) => this.mapZoneSound(zs));
  }

  async addSoundToZone(
    zoneId: string,
    soundId: string,
    sortOrder?: number
  ): Promise<ZoneSound> {
    // Check if association already exists
    const existing = await this.listZoneSoundsByZone(zoneId);
    const alreadyExists = existing.find((zs) => zs.soundId === soundId);
    if (alreadyExists) {
      return alreadyExists;
    }

    const result = await this.client.models.ZoneSound.create({
      zoneId,
      soundId,
      sortOrder: sortOrder ?? 0,
    });
    if (result.errors?.length) {
      console.error('Error adding sound to zone:', result.errors);
      throw new Error('Failed to add sound to zone');
    }
    return this.mapZoneSound(result.data);
  }

  async removeSoundFromZone(zoneId: string, soundId: string): Promise<void> {
    const zoneSounds = await this.listZoneSoundsByZone(zoneId);
    const toDelete = zoneSounds.find((zs) => zs.soundId === soundId);
    if (toDelete?.id) {
      await this.deleteZoneSound(toDelete.id);
    }
  }

  async deleteZoneSound(id: string): Promise<void> {
    const result = await this.client.models.ZoneSound.delete({ id });
    if (result.errors?.length) {
      console.error('Error deleting zone sound:', result.errors);
      throw new Error('Failed to delete zone sound');
    }
  }

  // ============ SOUNDS FOR ZONE (via Lambda) ============

  async getSoundsForZone(zoneId: string): Promise<Sound[]> {
    const result = await (this.client.queries.listSoundsByZone as any)({ zoneId }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error fetching sounds for zone:', result.errors);
      throw new Error('Failed to fetch sounds for zone');
    }
    return (result.data ?? []).map((s: any) => this.soundsService.map(s));
  }

  // ============ MONTHLY ZONE ============

  async getMonthlyZone(): Promise<MonthlyZone | null> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const result = await (
      this.client.models.MonthlyZone as any
    ).getMonthlyZoneByMonth({ month }, { authMode: 'apiKey' });

    if (result.errors?.length) {
      console.error('Error getting monthly zone:', result.errors);
      return null;
    }

    const actives = (result.data ?? []).filter((m: any) => m.active);
    if (actives.length === 0) return null;

    const raw = actives[0];
    return {
      id: raw.id,
      zoneId: raw.zoneId,
      month: raw.month,
      active: raw.active,
      zoneName: raw.zoneName,
      zoneName_i18n: raw.zoneName_i18n ? JSON.parse(raw.zoneName_i18n) : undefined,
      zoneDescription: raw.zoneDescription,
      zoneDescription_i18n: raw.zoneDescription_i18n ? JSON.parse(raw.zoneDescription_i18n) : undefined,
      zoneSlug: raw.zoneSlug,
      zoneCoverImage: raw.zoneCoverImage,
      zoneIcon: raw.zoneIcon,
      zoneColor: raw.zoneColor,
    };
  }

  async setMonthlyZone(zone: Zone): Promise<void> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Deactivate existing active entries for this month
    const existing = await (
      this.client.models.MonthlyZone as any
    ).getMonthlyZoneByMonth({ month });
    if (existing.data) {
      for (const m of existing.data) {
        if (m.active) {
          await this.client.models.MonthlyZone.update({
            id: m.id,
            active: false,
          } as any);
        }
      }
    }

    // Create new MonthlyZone with denormalized data
    const result = await this.client.models.MonthlyZone.create({
      id: crypto.randomUUID(),
      zoneId: zone.id,
      month,
      active: true,
      zoneName: zone.name ?? undefined,
      zoneName_i18n: zone.name_i18n ? JSON.stringify(zone.name_i18n) : undefined,
      zoneDescription: zone.description ?? undefined,
      zoneDescription_i18n: zone.description_i18n ? JSON.stringify(zone.description_i18n) : undefined,
      zoneSlug: zone.slug ?? undefined,
      zoneCoverImage: zone.coverImage ?? undefined,
      zoneIcon: zone.icon ?? undefined,
      zoneColor: zone.color ?? undefined,
    } as any);

    if (result.errors?.length) {
      console.error('Error setting monthly zone:', result.errors);
      throw new Error('Failed to set monthly zone');
    }
  }

  // ============ UTILITIES ============

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  calculateCenter(polygon: ZonePolygon): ZoneCenter {
    const coords = polygon.coordinates[0];
    let latSum = 0;
    let lngSum = 0;

    for (const coord of coords) {
      lngSum += coord[0];
      latSum += coord[1];
    }

    return {
      lat: latSum / coords.length,
      lng: lngSum / coords.length,
    };
  }

  // ============ ZONE FILE STORAGE ============

  /**
   * Upload a zone cover image to S3
   * @returns Object with progress$ observable and result promise containing the S3 key
   */
  uploadZoneImage(
    file: File
  ): { progress$: Observable<number>; result: Promise<{ key: string }> } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let progressObserver: any;
    const progress$ = new Observable<number>((observer) => {
      progressObserver = observer;
    });

    const sanitized = generateUniqueFilename(file.name);
    const key = `zones/images/${sanitized}`;

    const uploadTask = uploadData({
      path: key,
      data: file,
      options: {
        contentType: file.type,
        onProgress: ({ transferredBytes, totalBytes }) => {
          if (totalBytes && progressObserver) {
            progressObserver.next(
              Math.round((transferredBytes / totalBytes) * 100)
            );
          }
        },
      },
    });

    const result = uploadTask.result
      .then(() => ({ key }))
      .finally(() => progressObserver?.complete());

    return { progress$, result };
  }

  /**
   * Upload a zone ambient sound to S3
   * @returns Object with progress$ observable and result promise containing the S3 key
   */
  uploadZoneAmbientSound(
    file: File
  ): { progress$: Observable<number>; result: Promise<{ key: string }> } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let progressObserver: any;
    const progress$ = new Observable<number>((observer) => {
      progressObserver = observer;
    });

    const sanitized = generateUniqueFilename(file.name);
    const key = `zones/ambient/${sanitized}`;

    const uploadTask = uploadData({
      path: key,
      data: file,
      options: {
        contentType: file.type,
        onProgress: ({ transferredBytes, totalBytes }) => {
          if (totalBytes && progressObserver) {
            progressObserver.next(
              Math.round((transferredBytes / totalBytes) * 100)
            );
          }
        },
      },
    });

    const result = uploadTask.result
      .then(() => ({ key }))
      .finally(() => progressObserver?.complete());

    return { progress$, result };
  }

  /**
   * Get a presigned URL for a zone file (image or ambient sound)
   */
  async getZoneFileUrl(key: string): Promise<string> {
    const { url } = await getUrl({ path: key });
    return url.toString();
  }

  // ============ GEOMETRY UTILITIES ============

  /**
   * Test if a point (lat, lng) is inside a polygon using ray-casting algorithm
   */
  isPointInPolygon(lat: number, lng: number, polygon: number[][][]): boolean {
    const ring = polygon[0]; // outer ring: [[lng, lat], ...]
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = [ring[i][1], ring[i][0]]; // lat, lng
      const [xj, yj] = [ring[j][1], ring[j][0]];
      if (
        yi > lng !== yj > lng &&
        lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi
      ) {
        inside = !inside;
      }
    }
    return inside;
  }
}
