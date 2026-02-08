/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CdkDropList, CdkDrag, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { SoundJourneyService } from '../../../../../core/services/sound-journey.service';
import { AmplifyService } from '../../../../../core/services/amplify.service';
import { SoundsService } from '../../../../../core/services/sounds.service';
import { SoundJourney, SoundJourneyStep } from '../../../../../core/models/sound-journey.model';
import { Sound } from '../../../../../core/models/sound.model';

interface DialogData {
  journey: SoundJourney;
}

interface StepWithSound {
  step: SoundJourneyStep;
  sound: Sound;
}

@Component({
  selector: 'app-journey-steps-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatChipsModule,
    MatTooltipModule,
    TranslateModule,
    CdkDropList,
    CdkDrag,
  ],
  templateUrl: './journey-steps-dialog.component.html',
  styleUrl: './journey-steps-dialog.component.scss',
})
export class JourneyStepsDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<JourneyStepsDialogComponent>);
  private readonly data: DialogData = inject(MAT_DIALOG_DATA);
  private readonly journeyService = inject(SoundJourneyService);
  private readonly amplifyService = inject(AmplifyService);
  private readonly soundsService = inject(SoundsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  journey = this.data.journey;
  journeySteps = signal<StepWithSound[]>([]);
  allSounds = signal<Sound[]>([]);
  filteredSounds = signal<Sound[]>([]);
  loading = signal(true);
  adding = signal(false);
  savingStory = signal(false);

  editingStepId = signal<string | null>(null);
  storyControl = new FormControl('');
  storyFrControl = new FormControl('');
  storyEnControl = new FormControl('');
  storyEsControl = new FormControl('');

  searchControl = new FormControl('');

  get canAddMore(): boolean {
    return this.journeySteps().length < 10;
  }

  get hasMinimumSteps(): boolean {
    return this.journeySteps().length >= 3;
  }

  ngOnInit() {
    this.loadData();
    this.setupSearch();
  }

  private async loadData() {
    this.loading.set(true);
    try {
      // Load steps for this journey
      const steps = await this.journeyService.listStepsByJourney(this.journey.id!);

      // For each step, load the associated Sound by ID
      const stepsWithSounds: StepWithSound[] = [];
      for (const step of steps) {
        try {
          const result = await this.amplifyService.client.models.Sound.get(
            { id: step.soundId },
            {
              selectionSet: [
                'id',
                'title',
                'title_i18n',
                'city',
                'filename',
                'category',
                'secondaryCategory',
              ],
            } as any,
          );
          if (result.data) {
            const sound = this.soundsService.map(result.data);
            stepsWithSounds.push({ step, sound });
          }
        } catch (err) {
          console.warn(`Could not load sound ${step.soundId} for step ${step.id}:`, err);
        }
      }
      this.journeySteps.set(stepsWithSounds);

      // Load all public sounds for the "add" section
      const allResult = await this.amplifyService.client.queries.listSoundsForMap({});
      const allSounds = (allResult.data ?? []).map((s: any) => this.soundsService.map(s));
      this.allSounds.set(allSounds);
      this.updateFilteredSounds();
    } catch (error) {
      console.error('Error loading journey steps:', error);
      this.snackBar.open(
        this.translate.instant('admin.journeys.steps.loadError'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.loading.set(false);
    }
  }

  private setupSearch() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.updateFilteredSounds();
      });
  }

  private updateFilteredSounds() {
    const search = (this.searchControl.value ?? '').toLowerCase();
    const existingIds = new Set(this.journeySteps().map((item) => item.sound.id));

    let filtered = this.allSounds().filter((s) => !existingIds.has(s.id));

    if (search) {
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(search) ||
          s.city?.toLowerCase().includes(search),
      );
    }

    this.filteredSounds.set(filtered.slice(0, 50));
  }

  async addSound(sound: Sound) {
    this.adding.set(true);
    try {
      const stepOrder = this.journeySteps().length + 1;
      await this.journeyService.addStepToJourney(
        this.journey.id!,
        sound.id!,
        stepOrder,
      );
      await this.loadData();
      this.searchControl.setValue('');
      this.snackBar.open(
        this.translate.instant('admin.journeys.steps.addSuccess'),
        '',
        { duration: 2000 },
      );
    } catch (error) {
      console.error('Error adding step:', error);
      this.snackBar.open(
        this.translate.instant('admin.journeys.steps.addError'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.adding.set(false);
    }
  }

  async removeStep(item: StepWithSound) {
    try {
      await this.journeyService.deleteStep(item.step.id!);

      // Reorder remaining steps
      const remaining = this.journeySteps().filter((s) => s.step.id !== item.step.id);
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].step.stepOrder !== i + 1) {
          await this.journeyService.updateStep(remaining[i].step.id!, {
            stepOrder: i + 1,
          });
        }
      }

      await this.loadData();
      this.snackBar.open(
        this.translate.instant('admin.journeys.steps.removeSuccess'),
        '',
        { duration: 2000 },
      );
    } catch (error) {
      console.error('Error removing step:', error);
      this.snackBar.open(
        this.translate.instant('admin.journeys.steps.removeError'),
        '',
        { duration: 3000 },
      );
    }
  }

  async onDrop(event: CdkDragDrop<StepWithSound[]>) {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const items = [...this.journeySteps()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.journeySteps.set(items);

    // Determine the range of affected indices
    const minIndex = Math.min(event.previousIndex, event.currentIndex);
    const maxIndex = Math.max(event.previousIndex, event.currentIndex);

    try {
      for (let i = minIndex; i <= maxIndex; i++) {
        await this.journeyService.updateStep(items[i].step.id!, {
          stepOrder: i + 1,
        });
        items[i].step.stepOrder = i + 1;
      }
      this.journeySteps.set([...items]);
    } catch (error) {
      console.error('Error reordering steps:', error);
      this.snackBar.open(
        this.translate.instant('admin.journeys.steps.reorderError'),
        '',
        { duration: 3000 },
      );
      // Reload to restore correct order on failure
      await this.loadData();
    }
  }

  toggleEditStory(item: StepWithSound) {
    if (this.editingStepId() === item.step.id) {
      this.editingStepId.set(null);
      return;
    }
    this.editingStepId.set(item.step.id!);
    this.storyControl.setValue(item.step.themeText ?? '');
    this.storyFrControl.setValue(item.step.themeText_i18n?.['fr'] ?? '');
    this.storyEnControl.setValue(item.step.themeText_i18n?.['en'] ?? '');
    this.storyEsControl.setValue(item.step.themeText_i18n?.['es'] ?? '');
  }

  async saveStepStory(item: StepWithSound) {
    this.savingStory.set(true);
    try {
      const themeText = this.storyControl.value ?? '';
      const themeText_i18n: Record<string, string> = {};
      if (this.storyFrControl.value) themeText_i18n['fr'] = this.storyFrControl.value;
      if (this.storyEnControl.value) themeText_i18n['en'] = this.storyEnControl.value;
      if (this.storyEsControl.value) themeText_i18n['es'] = this.storyEsControl.value;

      await this.journeyService.updateStep(item.step.id!, {
        themeText,
        themeText_i18n: Object.keys(themeText_i18n).length > 0 ? themeText_i18n : undefined,
      });

      item.step.themeText = themeText;
      item.step.themeText_i18n = Object.keys(themeText_i18n).length > 0 ? themeText_i18n : undefined;
      this.editingStepId.set(null);

      this.snackBar.open(
        this.translate.instant('admin.journeys.steps.storySaved'),
        '',
        { duration: 2000 },
      );
    } catch (error) {
      console.error('Error saving step story:', error);
      this.snackBar.open(
        this.translate.instant('admin.journeys.steps.storyError'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.savingStory.set(false);
    }
  }

  hasStory(item: StepWithSound): boolean {
    return !!(item.step.themeText || item.step.themeText_i18n);
  }

  close() {
    this.dialogRef.close();
  }

  getLocalizedTitle(sound: Sound): string {
    const lang = this.translate.currentLang;
    if (sound.title_i18n && sound.title_i18n[lang]) {
      return sound.title_i18n[lang];
    }
    return sound.title;
  }
}
