import { Component, EventEmitter, Output, inject } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { AmplifyService } from '../../../../../../core/services/amplify.service';
import { LanguageDetectionService } from '../../../../../../core/services/language-detection.service';
import { SoundDataStepDialogComponent } from '../sound-data-step-dialog/sound-data-step-dialog.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-sound-data-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    AsyncPipe,
    TranslateModule,
  ],
  templateUrl: './sound-data-step.component.html',
  styleUrls: ['./sound-data-step.component.scss'],
})
export class SoundDataStepComponent {
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private languageDetectionService = inject(LanguageDetectionService);
  private dialog = inject(MatDialog);
  private amplifyService = inject(AmplifyService);

  @Output() completed = new EventEmitter<{
    title_i18n: Record<string, string>;
    shortStory_i18n: Record<string, string>;
  }>();

  form: FormGroup;
  translatingTitle = false;
  translatingStory = false;

  translatedTitle: Record<string, string> = { fr: '', en: '', es: '' };
  translatedStory: Record<string, string> = { fr: '', en: '', es: '' };

  private lastTranslatedSource: {
    title?: string;
    shortStory?: string;
  } = {};

  constructor() {
    this.form = this.fb.group({
      title: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(100),
        ],
      ],
      shortStory: ['', [Validators.minLength(10), Validators.maxLength(500)]],
    });
  }

  /** Trigger translation when the user leaves the input */
  async onFieldBlur(field: 'title' | 'shortStory') {
    await this.translateField(field);
  }

  /** Translate a single field using Amazon Translate */
  async translateField(field: 'title' | 'shortStory') {
    const control = this.form.get(field);
    if (!control || control.invalid) return;

    const text = control.value?.trim();
    if (!text) return;

    // 🔒 Si le texte n'a pas changé → on ne retraduit PAS
    if (this.lastTranslatedSource[field] === text) {
      return;
    }

    const sourceLanguage = this.languageDetectionService.detect(text);
    if (!sourceLanguage) {
      this.snackBar.open('Langue non supportée pour la traduction', 'Fermer', {
        duration: 3000,
      });
      return;
    }

    const targets = ['fr', 'en', 'es'];
    const translated =
      field === 'title' ? this.translatedTitle : this.translatedStory;

    if (field === 'title') {
      this.translatingTitle = true;
    } else {
      this.translatingStory = true;
    }

    try {
      for (const lang of targets) {
        const result = await this.amplifyService.client.queries.translate({
          sourceLanguage,
          targetLanguage: lang,
          text,
        });
        translated[lang] = result.data ?? '';
      }

      // Memorize last translated source
      this.lastTranslatedSource[field] = text;

      this.emitCompleted();
    } catch (err) {
      console.error(err);
      this.snackBar.open('Erreur de traduction', 'Fermer', { duration: 3000 });
    } finally {
      if (field === 'title') {
        this.translatingTitle = false;
      } else {
        this.translatingStory = false;
      }
    }
  }

  /** Open dialog to edit translations */
  async openTranslationDialog(field: 'title' | 'shortStory') {
    // Ensure the field is translated first
    await this.translateField(field);

    const translated =
      field === 'title' ? this.translatedTitle : this.translatedStory;

    const dialogRef = this.dialog.open(SoundDataStepDialogComponent, {
      width: '400px',
      data: { translations: { ...translated }, fieldName: field },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;

      if (field === 'title') {
        this.translatedTitle = result;
      } else {
        this.translatedStory = result;
      }

      this.emitCompleted();
    });
  }

  private emitCompleted() {
    this.completed.emit({
      title_i18n: this.translatedTitle,
      shortStory_i18n: this.translatedStory,
    });
  }
}
