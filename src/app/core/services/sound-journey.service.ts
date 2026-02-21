/* eslint-disable @typescript-eslint/no-explicit-any */
import { inject, Injectable } from '@angular/core';
import { getUrl, uploadData } from 'aws-amplify/storage';
import { Observable } from 'rxjs';
import { AmplifyService } from './amplify.service';
import {
  SoundJourney,
  SoundJourneyStep,
  MonthlyJourney,
} from '../models/sound-journey.model';
import { generateUniqueFilename } from './filename.service';

@Injectable({
  providedIn: 'root',
})
export class SoundJourneyService {
  private readonly amplifyService = inject(AmplifyService);

  private get client() {
    return this.amplifyService.client;
  }

  // ── Mapping ──────────────────────────────────────────

  private mapJourney(raw: any): SoundJourney {
    return new SoundJourney({
      id: raw.id,
      name: raw.name,
      name_i18n: raw.name_i18n ? JSON.parse(raw.name_i18n) : undefined,
      description: raw.description,
      description_i18n: raw.description_i18n
        ? JSON.parse(raw.description_i18n)
        : undefined,
      slug: raw.slug,
      color: raw.color,
      coverImage: raw.coverImage,
      coverImagePosition: raw.coverImagePosition,
      coverImageZoom: raw.coverImageZoom,
      isPublic: raw.isPublic,
      sortOrder: raw.sortOrder,
      createdBy: raw.createdBy,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  private mapStep(raw: any): SoundJourneyStep {
    return new SoundJourneyStep({
      id: raw.id,
      journeyId: raw.journeyId,
      soundId: raw.soundId,
      stepOrder: raw.stepOrder,
      themeText: raw.themeText,
      themeText_i18n: raw.themeText_i18n
        ? JSON.parse(raw.themeText_i18n)
        : undefined,
    });
  }

  // ── Journey CRUD (Admin) ─────────────────────────────

  async listJourneys(): Promise<SoundJourney[]> {
    const result = await this.client.models.SoundJourney.list();
    if (result.errors?.length) {
      console.error('Error listing journeys:', result.errors);
      throw new Error('Failed to list journeys');
    }
    return (result.data ?? []).map((j: any) => this.mapJourney(j));
  }

  async getJourneyById(id: string): Promise<SoundJourney | null> {
    const result = await this.client.models.SoundJourney.get({ id });
    if (result.errors?.length) {
      console.error('Error getting journey:', result.errors);
      throw new Error('Failed to get journey');
    }
    return result.data ? this.mapJourney(result.data) : null;
  }

  async getJourneyBySlug(slug: string): Promise<SoundJourney | null> {
    const result = await (
      this.client.models.SoundJourney as any
    ).getJourneyBySlug({ slug });
    if (result.errors?.length) {
      console.error('Error getting journey by slug:', result.errors);
      throw new Error('Failed to get journey by slug');
    }
    const items = result.data ?? [];
    return items.length > 0 ? this.mapJourney(items[0]) : null;
  }

  async createJourney(journey: Partial<SoundJourney>): Promise<SoundJourney> {
    const input = {
      name: journey.name!,
      name_i18n: journey.name_i18n
        ? JSON.stringify(journey.name_i18n)
        : undefined,
      description: journey.description,
      description_i18n: journey.description_i18n
        ? JSON.stringify(journey.description_i18n)
        : undefined,
      slug: journey.slug!,
      color: journey.color ?? '#1976d2',
      coverImage: journey.coverImage,
      coverImagePosition: journey.coverImagePosition ?? 'center',
      coverImageZoom: journey.coverImageZoom ?? 100,
      isPublic: journey.isPublic ?? true,
      sortOrder: journey.sortOrder ?? 0,
      createdBy: journey.createdBy,
    };

    const result = await this.client.models.SoundJourney.create(input);
    if (result.errors?.length) {
      console.error('Error creating journey:', result.errors);
      throw new Error('Failed to create journey');
    }
    return this.mapJourney(result.data);
  }

  async updateJourney(
    id: string,
    updates: Partial<SoundJourney>,
  ): Promise<SoundJourney> {
    const input: Record<string, unknown> = { id };

    if (updates.name !== undefined) input['name'] = updates.name;
    if (updates.name_i18n !== undefined)
      input['name_i18n'] = JSON.stringify(updates.name_i18n);
    if (updates.description !== undefined)
      input['description'] = updates.description;
    if (updates.description_i18n !== undefined)
      input['description_i18n'] = JSON.stringify(updates.description_i18n);
    if (updates.slug !== undefined) input['slug'] = updates.slug;
    if (updates.color !== undefined) input['color'] = updates.color;
    if (updates.coverImage !== undefined)
      input['coverImage'] = updates.coverImage;
    if (updates.coverImagePosition !== undefined)
      input['coverImagePosition'] = updates.coverImagePosition;
    if (updates.coverImageZoom !== undefined)
      input['coverImageZoom'] = updates.coverImageZoom;
    if (updates.isPublic !== undefined) input['isPublic'] = updates.isPublic;
    if (updates.sortOrder !== undefined)
      input['sortOrder'] = updates.sortOrder;

    const result = await this.client.models.SoundJourney.update(input as any);
    if (result.errors?.length) {
      console.error('Error updating journey:', result.errors);
      throw new Error('Failed to update journey');
    }
    return this.mapJourney(result.data);
  }

  async deleteJourney(id: string): Promise<void> {
    // First delete all steps
    const steps = await this.listStepsByJourney(id);
    for (const step of steps) {
      await this.deleteStep(step.id!);
    }

    const result = await this.client.models.SoundJourney.delete({ id });
    if (result.errors?.length) {
      console.error('Error deleting journey:', result.errors);
      throw new Error('Failed to delete journey');
    }
  }

  // ── Step Associations (Admin) ────────────────────────

  async listStepsByJourney(journeyId: string): Promise<SoundJourneyStep[]> {
    const result = await (
      this.client.models.SoundJourneyStep as any
    ).listJourneyStepsByJourney({ journeyId });
    if (result.errors?.length) {
      console.error('Error listing journey steps:', result.errors);
      throw new Error('Failed to list journey steps');
    }
    return (result.data ?? [])
      .map((s: any) => this.mapStep(s))
      .sort(
        (a: SoundJourneyStep, b: SoundJourneyStep) =>
          a.stepOrder - b.stepOrder,
      );
  }

  async addStepToJourney(
    journeyId: string,
    soundId: string,
    stepOrder: number,
    themeText?: string,
    themeText_i18n?: Record<string, string>,
  ): Promise<SoundJourneyStep> {
    // Check if sound already exists in this journey
    const existing = await this.listStepsByJourney(journeyId);
    const alreadyExists = existing.find((s) => s.soundId === soundId);
    if (alreadyExists) {
      return alreadyExists;
    }

    const result = await this.client.models.SoundJourneyStep.create({
      journeyId,
      soundId,
      stepOrder,
      themeText,
      themeText_i18n: themeText_i18n
        ? JSON.stringify(themeText_i18n)
        : undefined,
    } as any);
    if (result.errors?.length) {
      console.error('Error adding step to journey:', result.errors);
      throw new Error('Failed to add step to journey');
    }
    return this.mapStep(result.data);
  }

  async updateStep(
    id: string,
    updates: Partial<SoundJourneyStep>,
  ): Promise<SoundJourneyStep> {
    const input: Record<string, unknown> = { id };

    if (updates.stepOrder !== undefined) input['stepOrder'] = updates.stepOrder;
    if (updates.themeText !== undefined) input['themeText'] = updates.themeText;
    if (updates.themeText_i18n !== undefined)
      input['themeText_i18n'] = JSON.stringify(updates.themeText_i18n);

    const result = await this.client.models.SoundJourneyStep.update(
      input as any,
    );
    if (result.errors?.length) {
      console.error('Error updating step:', result.errors);
      throw new Error('Failed to update step');
    }
    return this.mapStep(result.data);
  }

  async deleteStep(id: string): Promise<void> {
    const result = await this.client.models.SoundJourneyStep.delete({ id });
    if (result.errors?.length) {
      console.error('Error deleting step:', result.errors);
      throw new Error('Failed to delete step');
    }
  }

  async removeStepFromJourney(
    journeyId: string,
    soundId: string,
  ): Promise<void> {
    const steps = await this.listStepsByJourney(journeyId);
    const toDelete = steps.find((s) => s.soundId === soundId);
    if (toDelete?.id) {
      await this.deleteStep(toDelete.id);
    }
  }

  // ── Public reads (apiKey) ────────────────────────────

  async listPublicJourneys(): Promise<SoundJourney[]> {
    const result = await (this.client.models.SoundJourney.list as any)({
      authMode: 'apiKey',
    });
    if (result.errors?.length) {
      console.error('Error listing public journeys:', result.errors);
      throw new Error('Failed to list public journeys');
    }
    return (result.data ?? [])
      .map((j: any) => this.mapJourney(j))
      .filter((j: SoundJourney) => j.isPublic)
      .sort(
        (a: SoundJourney, b: SoundJourney) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      );
  }

  async getJourneyByIdPublic(id: string): Promise<SoundJourney | null> {
    const result = await (this.client.models.SoundJourney.get as any)(
      { id },
      { authMode: 'apiKey' },
    );
    if (result.errors?.length) {
      console.error('Error getting journey:', result.errors);
      throw new Error('Failed to get journey');
    }
    return result.data ? this.mapJourney(result.data) : null;
  }

  async listStepsByJourneyPublic(
    journeyId: string,
  ): Promise<SoundJourneyStep[]> {
    const result = await (
      this.client.models.SoundJourneyStep as any
    ).listJourneyStepsByJourney({ journeyId }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error listing journey steps:', result.errors);
      throw new Error('Failed to list journey steps');
    }
    return (result.data ?? [])
      .map((s: any) => this.mapStep(s))
      .sort(
        (a: SoundJourneyStep, b: SoundJourneyStep) =>
          a.stepOrder - b.stepOrder,
      );
  }

  // ── Monthly Journey ─────────────────────────────────

  async getMonthlyJourney(): Promise<MonthlyJourney | null> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const result = await (
      this.client.models.MonthlyJourney as any
    ).getMonthlyJourneyByMonth({ month }, { authMode: 'apiKey' });

    if (result.errors?.length) {
      console.error('Error getting monthly journey:', result.errors);
      return null;
    }

    const actives = (result.data ?? []).filter((m: any) => m.active);
    if (actives.length === 0) return null;

    const raw = actives[0];
    return new MonthlyJourney({
      id: raw.id,
      journeyId: raw.journeyId,
      month: raw.month,
      active: raw.active,
      journeyName: raw.journeyName,
      journeyName_i18n: raw.journeyName_i18n ? JSON.parse(raw.journeyName_i18n) : undefined,
      journeyDescription: raw.journeyDescription,
      journeyDescription_i18n: raw.journeyDescription_i18n ? JSON.parse(raw.journeyDescription_i18n) : undefined,
      journeySlug: raw.journeySlug,
      journeyColor: raw.journeyColor,
      journeyCoverImage: raw.journeyCoverImage,
    });
  }

  async setMonthlyJourney(journey: SoundJourney): Promise<void> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Deactivate existing active entries for this month
    const existing = await (
      this.client.models.MonthlyJourney as any
    ).getMonthlyJourneyByMonth({ month });
    if (existing.data) {
      for (const m of existing.data) {
        if (m.active) {
          await this.client.models.MonthlyJourney.update({
            id: m.id,
            active: false,
          } as any);
        }
      }
    }

    // Create new MonthlyJourney with denormalized data
    const result = await this.client.models.MonthlyJourney.create({
      id: crypto.randomUUID(),
      journeyId: journey.id,
      month,
      active: true,
      journeyName: journey.name ?? undefined,
      journeyName_i18n: journey.name_i18n ? JSON.stringify(journey.name_i18n) : undefined,
      journeyDescription: journey.description ?? undefined,
      journeyDescription_i18n: journey.description_i18n ? JSON.stringify(journey.description_i18n) : undefined,
      journeySlug: journey.slug ?? undefined,
      journeyColor: journey.color ?? undefined,
      journeyCoverImage: journey.coverImage ?? undefined,
    } as any);

    if (result.errors?.length) {
      console.error('Error setting monthly journey:', result.errors);
      throw new Error('Failed to set monthly journey');
    }
  }

  // ── Journey File Storage ────────────────────────────

  uploadJourneyImage(
    file: File
  ): { progress$: Observable<number>; result: Promise<{ key: string }> } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let progressObserver: any;
    const progress$ = new Observable<number>((observer) => {
      progressObserver = observer;
    });

    const sanitized = generateUniqueFilename(file.name);
    const key = `journeys/images/${sanitized}`;

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

  async getJourneyFileUrl(key: string): Promise<string> {
    const { url } = await getUrl({ path: key });
    return url.toString();
  }

  // ── Utilities ────────────────────────────────────────

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
