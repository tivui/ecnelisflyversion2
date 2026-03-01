import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
} from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-sound-data-step-dialog',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatLabel,
        TranslateModule,
    ],
    templateUrl: './sound-data-step-dialog.component.html',
    styleUrls: ['./sound-data-step-dialog.component.scss']
})
export class SoundDataStepDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<SoundDataStepDialogComponent>,
  );
  readonly data = inject(MAT_DIALOG_DATA) as {
    translations: Record<string, string>;
    fieldName: string;
  };
  private readonly fb = inject(FormBuilder);

  // Languages to edit
  readonly langs = ['fr', 'en', 'es'];

  // Reactive form for the translations
  form = this.fb.group({
    fr: [this.data.translations['fr'] || ''],
    en: [this.data.translations['en'] || ''],
    es: [this.data.translations['es'] || ''],
  });

  /** Save updated translations and close dialog */
  save() {
    this.dialogRef.close(this.form.value);
  }

  /** Cancel without saving */
  cancel() {
    this.dialogRef.close();
  }

  /** Check if field is shortStory */
  get isShortStory() {
    return this.data.fieldName === 'shortStory';
  }
}
