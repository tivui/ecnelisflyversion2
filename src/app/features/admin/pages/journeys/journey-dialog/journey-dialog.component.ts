/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { SoundJourneyService } from '../../../../../core/services/sound-journey.service';
import { SoundJourney } from '../../../../../core/models/sound-journey.model';

interface DialogData {
  journey: SoundJourney | null;
}

@Component({
  selector: 'app-journey-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslateModule,
  ],
  templateUrl: './journey-dialog.component.html',
  styleUrl: './journey-dialog.component.scss',
})
export class JourneyDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<JourneyDialogComponent>);
  private readonly data: DialogData = inject(MAT_DIALOG_DATA);
  private readonly journeyService = inject(SoundJourneyService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  form!: FormGroup;
  saving = signal(false);
  isEditMode = signal(false);

  ngOnInit() {
    this.isEditMode.set(!!this.data.journey);

    this.form = this.fb.group({
      name: [this.data.journey?.name ?? '', Validators.required],
      name_fr: [this.data.journey?.name_i18n?.['fr'] ?? ''],
      name_en: [this.data.journey?.name_i18n?.['en'] ?? ''],
      name_es: [this.data.journey?.name_i18n?.['es'] ?? ''],
      description: [this.data.journey?.description ?? ''],
      description_fr: [this.data.journey?.description_i18n?.['fr'] ?? ''],
      description_en: [this.data.journey?.description_i18n?.['en'] ?? ''],
      description_es: [this.data.journey?.description_i18n?.['es'] ?? ''],
      slug: [this.data.journey?.slug ?? '', Validators.required],
      color: [this.data.journey?.color ?? '#1976d2'],
      isPublic: [this.data.journey?.isPublic ?? true],
      sortOrder: [this.data.journey?.sortOrder ?? 0],
    });

    // Auto-generate slug from name (only in create mode)
    this.form.get('name')?.valueChanges.subscribe((name) => {
      if (!this.isEditMode() && name) {
        const slug = this.journeyService.generateSlug(name);
        this.form.patchValue({ slug }, { emitEvent: false });
      }
    });
  }

  async save() {
    if (!this.form.valid) {
      this.snackBar.open(
        this.translate.instant('admin.journeys.dialog.formInvalid'),
        '',
        { duration: 3000 }
      );
      return;
    }

    this.saving.set(true);

    try {
      const formValue = this.form.value;
      const name_i18n: Record<string, string> = {};
      if (formValue.name_fr) name_i18n['fr'] = formValue.name_fr;
      if (formValue.name_en) name_i18n['en'] = formValue.name_en;
      if (formValue.name_es) name_i18n['es'] = formValue.name_es;

      const description_i18n: Record<string, string> = {};
      if (formValue.description_fr)
        description_i18n['fr'] = formValue.description_fr;
      if (formValue.description_en)
        description_i18n['en'] = formValue.description_en;
      if (formValue.description_es)
        description_i18n['es'] = formValue.description_es;

      const journeyData: Partial<SoundJourney> = {
        name: formValue.name,
        name_i18n: Object.keys(name_i18n).length > 0 ? name_i18n : undefined,
        description: formValue.description,
        description_i18n:
          Object.keys(description_i18n).length > 0
            ? description_i18n
            : undefined,
        slug: formValue.slug,
        color: formValue.color,
        isPublic: formValue.isPublic,
        sortOrder: formValue.sortOrder,
      };

      if (this.isEditMode()) {
        await this.journeyService.updateJourney(this.data.journey!.id!, journeyData);
        this.snackBar.open(
          this.translate.instant('admin.journeys.dialog.updateSuccess'),
          '',
          { duration: 3000 }
        );
      } else {
        await this.journeyService.createJourney(journeyData);
        this.snackBar.open(
          this.translate.instant('admin.journeys.dialog.createSuccess'),
          '',
          { duration: 3000 }
        );
      }

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Error saving journey:', error);
      this.snackBar.open(
        this.translate.instant('admin.journeys.dialog.saveError'),
        '',
        { duration: 3000 }
      );
    } finally {
      this.saving.set(false);
    }
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
