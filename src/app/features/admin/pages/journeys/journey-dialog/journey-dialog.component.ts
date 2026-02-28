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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { SoundJourneyService } from '../../../../../core/services/sound-journey.service';
import { SoundJourney } from '../../../../../core/models/sound-journey.model';

interface DialogData {
  journey: SoundJourney | null;
}

@Component({
    selector: 'app-journey-dialog',
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
        MatProgressBarModule,
        MatTabsModule,
        TranslateModule,
    ],
    templateUrl: './journey-dialog.component.html',
    styleUrl: './journey-dialog.component.scss'
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

  // Media signals
  coverImagePosition = signal('50%');
  coverImageKey = signal<string | null>(null);
  coverImagePreviewUrl = signal<string | null>(null);
  imageUploadProgress = signal(0);
  isDraggingImage = signal(false);
  coverImageZoom = signal(100);
  private dragStartY = 0;
  private dragStartPercent = 50;

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

    // Load existing cover image
    if (this.data.journey?.coverImagePosition) {
      const pos = this.data.journey.coverImagePosition;
      if (pos === 'top') this.coverImagePosition.set('0%');
      else if (pos === 'bottom') this.coverImagePosition.set('100%');
      else if (pos === 'center') this.coverImagePosition.set('50%');
      else this.coverImagePosition.set(pos);
    }
    if (this.data.journey?.coverImageZoom) {
      this.coverImageZoom.set(this.data.journey.coverImageZoom);
    }
    if (this.data.journey?.coverImage) {
      this.coverImageKey.set(this.data.journey.coverImage);
      this.journeyService
        .getJourneyFileUrl(this.data.journey.coverImage)
        .then((url) => this.coverImagePreviewUrl.set(url));
    }

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
        coverImage: this.coverImageKey() ?? undefined,
        coverImagePosition: this.coverImagePosition(),
        coverImageZoom: this.coverImageZoom(),
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

  // ============ MEDIA UPLOAD METHODS ============

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDropImage(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.uploadCoverImage(file);
    }
  }

  onCoverImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.uploadCoverImage(file);
  }

  private uploadCoverImage(file: File) {
    this.imageUploadProgress.set(1);
    const { progress$, result } = this.journeyService.uploadJourneyImage(file);

    progress$.subscribe((p) => this.imageUploadProgress.set(p));

    result
      .then(async ({ key }) => {
        this.coverImageKey.set(key);
        const url = await this.journeyService.getJourneyFileUrl(key);
        this.coverImagePreviewUrl.set(url);
        this.imageUploadProgress.set(100);
      })
      .catch((err) => {
        console.error('Image upload error:', err);
        this.snackBar.open(
          this.translate.instant('admin.journeys.dialog.uploadError'),
          '',
          { duration: 3000 }
        );
        this.imageUploadProgress.set(0);
      });
  }

  removeCoverImage() {
    this.coverImageKey.set(null);
    this.coverImagePreviewUrl.set(null);
    this.imageUploadProgress.set(0);
  }

  // --- Image drag-to-frame ---
  onImageDragStart(event: MouseEvent) {
    event.preventDefault();
    this.isDraggingImage.set(true);
    this.dragStartY = event.clientY;
    this.dragStartPercent = parseFloat(this.coverImagePosition()) || 50;
  }

  onImageTouchStart(event: TouchEvent) {
    this.isDraggingImage.set(true);
    this.dragStartY = event.touches[0].clientY;
    this.dragStartPercent = parseFloat(this.coverImagePosition()) || 50;
  }

  onImageDragMove(event: MouseEvent) {
    if (!this.isDraggingImage()) return;
    event.preventDefault();
    this.updateDragPosition(event.clientY);
  }

  onImageTouchMove(event: TouchEvent) {
    if (!this.isDraggingImage()) return;
    this.updateDragPosition(event.touches[0].clientY);
  }

  onImageDragEnd() {
    this.isDraggingImage.set(false);
  }

  onImageWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -5 : 5;
    this.adjustZoom(delta);
  }

  zoomIn() {
    this.adjustZoom(10);
  }

  zoomOut() {
    this.adjustZoom(-10);
  }

  resetZoom() {
    this.coverImageZoom.set(100);
  }

  private adjustZoom(delta: number) {
    const current = this.coverImageZoom();
    const newZoom = Math.min(200, Math.max(100, current + delta));
    this.coverImageZoom.set(newZoom);
  }

  private updateDragPosition(clientY: number) {
    const delta = clientY - this.dragStartY;
    const percentDelta = (delta / 200) * 100;
    const newPercent = Math.min(100, Math.max(0, this.dragStartPercent + percentDelta));
    this.coverImagePosition.set(`${Math.round(newPercent)}%`);
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
