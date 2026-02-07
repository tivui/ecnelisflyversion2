import { inject, Injectable } from '@angular/core';
import { AmplifyService } from './amplify.service';
import { Zone, ZoneSound, ZonePolygon, ZoneCenter } from '../models/zone.model';
import { Sound } from '../models/sound.model';
import { SoundsService } from './sounds.service';

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
    const result = await this.client.models.Zone.list();
    if (result.errors?.length) {
      console.error('Error listing zones:', result.errors);
      throw new Error('Failed to list zones');
    }
    return (result.data ?? []).map((z) => this.mapZone(z));
  }

  async listPublicZones(): Promise<Zone[]> {
    const zones = await this.listZones();
    return zones
      .filter((z) => z.isPublic)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async getZoneById(id: string): Promise<Zone | null> {
    const result = await this.client.models.Zone.get({ id });
    if (result.errors?.length) {
      console.error('Error getting zone:', result.errors);
      throw new Error('Failed to get zone');
    }
    return result.data ? this.mapZone(result.data) : null;
  }

  async getZoneBySlug(slug: string): Promise<Zone | null> {
    const result = await this.client.models.Zone.getZoneBySlug({ slug });
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
    )({
      zoneId,
    });
    if (result.errors?.length) {
      console.error('Error listing zone sounds:', result.errors);
      throw new Error('Failed to list zone sounds');
    }
    return (result.data ?? []).map((zs: any) => this.mapZoneSound(zs));
  }

  async listZoneSoundsBySound(soundId: string): Promise<ZoneSound[]> {
    const result = await (
      this.client.models.ZoneSound.listZoneSoundsBySound as any
    )({
      soundId,
    });
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
    const result = await this.client.queries.listSoundsByZone({ zoneId });
    if (result.errors?.length) {
      console.error('Error fetching sounds for zone:', result.errors);
      throw new Error('Failed to fetch sounds for zone');
    }
    return (result.data ?? []).map((s: any) => this.soundsService.map(s));
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
}
