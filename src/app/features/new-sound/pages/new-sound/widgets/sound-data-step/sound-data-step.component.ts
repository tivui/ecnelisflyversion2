import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AmplifyService } from '../../../../../../core/services/amplify.service';

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

  private readonly amplifyService = inject(AmplifyService);

  @Output() completed = new EventEmitter<{ title_i18n: Record<string,string> }>();

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

    this.translating = true;

    try {
      const langs = ['fr', 'en', 'es'];
      for (const lang of langs) {
        const result = await this.amplifyService.client.queries.translate({
          sourceLanguage: 'fr',
          targetLanguage: lang,
          text,
        });
        console.log("result translate:", result);
        this.translated[lang] = result.data ?? '';
      }

      this.completed.emit({ title_i18n: this.translated });
    } catch (err) {
      console.error(err);
      this.snackBar.open('Erreur de traduction', 'Fermer', { duration: 3000 });
    } finally {
      this.translating = false;
    }
  }
}
