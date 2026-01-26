import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AmplifyService } from '../../../../../../core/services/amplify.service';
import { LanguageDetectionService } from '../../../../../../core/services/language-detection.service';

@Component({
  selector: 'app-sound-data-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './sound-data-step.component.html',
})
export class SoundDataStepComponent {
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private languageDetectionService = inject(LanguageDetectionService);

  private readonly amplifyService = inject(AmplifyService);

  @Output() completed = new EventEmitter<{
    title_i18n: Record<string, string>;
  }>();

  form: FormGroup;

  translated: Record<string, string> = { fr: '', en: '', es: '' };
  translating = false;

  constructor() {
    this.form = this.fb.group({
      title: [''],
    });
  }

  async translate() {
    const text = this.form.value.title;
    if (!text) return;

    const sourceLanguage = this.languageDetectionService.detect(text);

    // Stop if language is not supported by Amazon Translate
    if (!sourceLanguage) {
      this.snackBar.open('Langue non supportée pour la traduction', 'Fermer', {
        duration: 3000,
      });
      return;
    }

    this.translating = true;

    try {
      const targets = ['fr', 'en', 'es'];

      for (const lang of targets) {
        const result = await this.amplifyService.client.queries.translate({
          sourceLanguage,
          targetLanguage: lang,
          text,
        });

        this.translated[lang] = result.data ?? '';
      }

      this.completed.emit({ title_i18n: this.translated });
    } catch (err) {
      console.error(err);
      this.snackBar.open('Erreur de traduction', 'Fermer', {
        duration: 3000,
      });
    } finally {
      this.translating = false;
    }
  }
}
