import { inject, Injectable } from '@angular/core';
import { AmplifyService } from './amplify.service';
import {
  FeaturedSoundCandidate,
  DailyFeaturedSound,
} from '../models/featured-sound.model';

@Injectable({
  providedIn: 'root',
})
export class FeaturedSoundService {
  private readonly amplifyService = inject(AmplifyService);

  private get client() {
    return this.amplifyService.client;
  }

  // ── Mapping ──────────────────────────────────────────

  private mapCandidate(raw: any): FeaturedSoundCandidate {
    return new FeaturedSoundCandidate({
      id: raw.id,
      soundId: raw.soundId,
      teasing: raw.teasing,
      teasing_i18n: raw.teasing_i18n
        ? JSON.parse(raw.teasing_i18n)
        : undefined,
      isActive: raw.isActive,
      sortOrder: raw.sortOrder,
    });
  }

  private mapDaily(raw: any): DailyFeaturedSound {
    return new DailyFeaturedSound({
      id: raw.id,
      date: raw.date,
      featuredCandidateId: raw.featuredCandidateId,
      soundId: raw.soundId,
      teasing: raw.teasing,
      teasing_i18n: raw.teasing_i18n
        ? JSON.parse(raw.teasing_i18n)
        : undefined,
      soundTitle: raw.soundTitle,
      soundCity: raw.soundCity,
      soundLatitude: raw.soundLatitude,
      soundLongitude: raw.soundLongitude,
      soundCategory: raw.soundCategory,
      soundSecondaryCategory: raw.soundSecondaryCategory,
      soundFilename: raw.soundFilename,
    });
  }

  // ── Admin CRUD — FeaturedSoundCandidate ──────────────

  async listCandidates(): Promise<FeaturedSoundCandidate[]> {
    let all: any[] = [];
    let nextToken: string | null | undefined = undefined;

    do {
      const page: any = await this.client.models.FeaturedSoundCandidate.list({
        limit: 100,
        nextToken: nextToken ?? undefined,
      });
      if (page.errors?.length) {
        console.error('Error listing candidates:', page.errors);
        throw new Error('Failed to list candidates');
      }
      if (page.data) {
        all.push(...page.data);
      }
      nextToken = page.nextToken;
    } while (nextToken);

    return all
      .map((c) => this.mapCandidate(c))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async createCandidate(
    data: Partial<FeaturedSoundCandidate>,
  ): Promise<FeaturedSoundCandidate> {
    const input = {
      soundId: data.soundId!,
      teasing: data.teasing!,
      teasing_i18n: data.teasing_i18n
        ? JSON.stringify(data.teasing_i18n)
        : undefined,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    };

    const result =
      await this.client.models.FeaturedSoundCandidate.create(input);
    if (result.errors?.length) {
      console.error('Error creating candidate:', result.errors);
      throw new Error('Failed to create candidate');
    }
    return this.mapCandidate(result.data);
  }

  async updateCandidate(
    id: string,
    updates: Partial<FeaturedSoundCandidate>,
  ): Promise<FeaturedSoundCandidate> {
    const input: Record<string, unknown> = { id };

    if (updates.soundId !== undefined) input['soundId'] = updates.soundId;
    if (updates.teasing !== undefined) input['teasing'] = updates.teasing;
    if (updates.teasing_i18n !== undefined)
      input['teasing_i18n'] = JSON.stringify(updates.teasing_i18n);
    if (updates.isActive !== undefined) input['isActive'] = updates.isActive;
    if (updates.sortOrder !== undefined)
      input['sortOrder'] = updates.sortOrder;

    const result = await this.client.models.FeaturedSoundCandidate.update(
      input as any,
    );
    if (result.errors?.length) {
      console.error('Error updating candidate:', result.errors);
      throw new Error('Failed to update candidate');
    }
    return this.mapCandidate(result.data);
  }

  async deleteCandidate(id: string): Promise<void> {
    const result = await this.client.models.FeaturedSoundCandidate.delete({
      id,
    });
    if (result.errors?.length) {
      console.error('Error deleting candidate:', result.errors);
      throw new Error('Failed to delete candidate');
    }
  }

  // ── Public — DailyFeaturedSound ─────────────────────

  async getTodayFeatured(): Promise<DailyFeaturedSound | null> {
    const today = new Date().toISOString().split('T')[0];

    const result = await (
      this.client.models.DailyFeaturedSound.getDailyFeaturedByDate as any
    )({ date: today }, { authMode: 'apiKey' });

    if (result.errors?.length) {
      console.error('Error getting daily featured:', result.errors);
      throw new Error('Failed to get daily featured sound');
    }

    const items = result.data ?? [];
    return items.length > 0 ? this.mapDaily(items[0]) : null;
  }

  async forcePickDaily(candidate: FeaturedSoundCandidate): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // Delete existing daily featured for today
    const existing = await (
      this.client.models.DailyFeaturedSound.getDailyFeaturedByDate as any
    )({ date: today });
    if (existing.data) {
      for (const d of existing.data) {
        await this.client.models.DailyFeaturedSound.delete({ id: d.id });
      }
    }

    // Fetch the full Sound record
    const soundResult = await (this.client.models.Sound as any).get({ id: candidate.soundId });
    const sound = soundResult.data;
    if (!sound) {
      throw new Error('Sound not found for candidate');
    }

    // Create new DailyFeaturedSound with denormalized data
    const result = await this.client.models.DailyFeaturedSound.create({
      date: today,
      featuredCandidateId: candidate.id,
      soundId: candidate.soundId,
      teasing: candidate.teasing,
      teasing_i18n: candidate.teasing_i18n
        ? JSON.stringify(candidate.teasing_i18n)
        : undefined,
      soundTitle: sound.title,
      soundCity: sound.city ?? undefined,
      soundLatitude: sound.latitude ?? undefined,
      soundLongitude: sound.longitude ?? undefined,
      soundCategory: sound.category ?? undefined,
      soundSecondaryCategory: sound.secondaryCategory ?? undefined,
      soundFilename: sound.filename,
    } as any);

    if (result.errors?.length) {
      console.error('Error creating daily featured:', result.errors);
      throw new Error('Failed to set daily featured sound');
    }
  }
}
