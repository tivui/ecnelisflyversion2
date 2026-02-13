import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { QuizService } from '../../../../quiz/services/quiz.service';
import {
  QuizQuestion,
  QuizChoice,
  QuestionType,
} from '../../../../quiz/models/quiz.model';
import { AmplifyService } from '../../../../../core/services/amplify.service';
import { SoundsService } from '../../../../../core/services/sounds.service';
import { Sound } from '../../../../../core/models/sound.model';

interface DialogData {
  quizId: string;
  question: QuizQuestion | null;
  order: number;
}

@Component({
  selector: 'app-question-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatAutocompleteModule,
    TranslateModule,
  ],
  templateUrl: './question-edit-dialog.component.html',
  styleUrl: './question-edit-dialog.component.scss',
})
export class QuestionEditDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<QuestionEditDialogComponent>);
  private readonly data: DialogData = inject(MAT_DIALOG_DATA);
  private readonly quizService = inject(QuizService);
  private readonly amplifyService = inject(AmplifyService);
  private readonly soundsService = inject(SoundsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  form!: FormGroup;
  saving = signal(false);
  isEditMode = signal(false);

  // Sound search
  soundSearchControl = new FormControl('');
  filteredSounds = signal<Sound[]>([]);
  selectedSound = signal<Sound | null>(null);
  allSounds = signal<Sound[]>([]);

  questionTypes: QuestionType[] = [
    'listen_identify',
    'listen_choose_category',
    'listen_choose_location',
    'odd_one_out',
    'true_false',
  ];

  get choicesArray(): FormArray {
    return this.form.get('choices') as FormArray;
  }

  ngOnInit() {
    this.isEditMode.set(!!this.data.question);

    const q = this.data.question;
    this.form = this.fb.group({
      type: [q?.type ?? 'listen_identify', Validators.required],
      prompt: [q?.prompt ?? '', Validators.required],
      prompt_fr: [q?.prompt_i18n?.['fr'] ?? ''],
      prompt_en: [q?.prompt_i18n?.['en'] ?? ''],
      prompt_es: [q?.prompt_i18n?.['es'] ?? ''],
      explanation: [q?.explanation ?? ''],
      explanation_fr: [q?.explanation_i18n?.['fr'] ?? ''],
      explanation_en: [q?.explanation_i18n?.['en'] ?? ''],
      explanation_es: [q?.explanation_i18n?.['es'] ?? ''],
      timeLimitOverride: [q?.timeLimitOverride ?? null],
      choices: this.fb.array([]),
    });

    // Initialize choices
    if (q?.choices && q.choices.length > 0) {
      for (const choice of q.choices) {
        this.addChoiceRow(choice);
      }
    } else {
      // Default: 4 empty choices for non true/false, 2 for true/false
      const count = q?.type === 'true_false' ? 2 : 4;
      for (let i = 0; i < count; i++) {
        this.addChoiceRow();
      }
    }

    // Load sounds for autocomplete
    this.loadSounds();

    // If editing, load the selected sound
    if (q?.soundId) {
      this.loadSelectedSound(q.soundId);
    }

    // Setup sound search
    this.soundSearchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((val) => {
        const search = (val ?? '').toLowerCase();
        this.filteredSounds.set(
          this.allSounds()
            .filter(
              (s) =>
                s.title.toLowerCase().includes(search) ||
                s.city?.toLowerCase().includes(search),
            )
            .slice(0, 20),
        );
      });

    // When type changes, adjust number of choices
    this.form.get('type')?.valueChanges.subscribe((type: QuestionType) => {
      if (type === 'true_false') {
        while (this.choicesArray.length > 2) {
          this.choicesArray.removeAt(this.choicesArray.length - 1);
        }
        while (this.choicesArray.length < 2) {
          this.addChoiceRow();
        }
      } else if (this.choicesArray.length < 4) {
        while (this.choicesArray.length < 4) {
          this.addChoiceRow();
        }
      }
    });
  }

  private async loadSounds() {
    try {
      const sounds = await this.soundsService.fetchAllPublicSounds();
      this.allSounds.set(sounds);
      this.filteredSounds.set(sounds.slice(0, 20));
    } catch (error) {
      console.error('Error loading sounds:', error);
    }
  }

  private async loadSelectedSound(soundId: string) {
    try {
      const result = await this.amplifyService.client.models.Sound.get(
        { id: soundId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { selectionSet: ['id', 'title', 'city', 'filename', 'category'] } as any,
      );
      if (result.data) {
        this.selectedSound.set(this.soundsService.map(result.data));
        this.soundSearchControl.setValue(result.data.title);
      }
    } catch {
      // ignore
    }
  }

  selectSound(sound: Sound) {
    this.selectedSound.set(sound);
    this.soundSearchControl.setValue(sound.title);
  }

  clearSound() {
    this.selectedSound.set(null);
    this.soundSearchControl.setValue('');
  }

  addChoiceRow(choice?: QuizChoice) {
    this.choicesArray.push(
      this.fb.group({
        label: [choice?.label ?? '', Validators.required],
        label_fr: [choice?.label_i18n?.['fr'] ?? ''],
        label_en: [choice?.label_i18n?.['en'] ?? ''],
        label_es: [choice?.label_i18n?.['es'] ?? ''],
        isCorrect: [choice?.isCorrect ?? false],
        soundId: [choice?.soundId ?? ''],
      }),
    );
  }

  removeChoice(index: number) {
    this.choicesArray.removeAt(index);
  }

  async save() {
    if (!this.form.valid) return;

    this.saving.set(true);

    try {
      const v = this.form.value;

      const prompt_i18n: Record<string, string> = {};
      if (v.prompt_fr) prompt_i18n['fr'] = v.prompt_fr;
      if (v.prompt_en) prompt_i18n['en'] = v.prompt_en;
      if (v.prompt_es) prompt_i18n['es'] = v.prompt_es;

      const explanation_i18n: Record<string, string> = {};
      if (v.explanation_fr) explanation_i18n['fr'] = v.explanation_fr;
      if (v.explanation_en) explanation_i18n['en'] = v.explanation_en;
      if (v.explanation_es) explanation_i18n['es'] = v.explanation_es;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const choices: QuizChoice[] = v.choices.map((c: any) => {
        const choice: QuizChoice = {
          label: c.label,
          isCorrect: c.isCorrect,
        };
        const label_i18n: Record<string, string> = {};
        if (c.label_fr) label_i18n['fr'] = c.label_fr;
        if (c.label_en) label_i18n['en'] = c.label_en;
        if (c.label_es) label_i18n['es'] = c.label_es;
        if (Object.keys(label_i18n).length > 0) choice.label_i18n = label_i18n;
        if (c.soundId) choice.soundId = c.soundId;
        return choice;
      });

      const payload = {
        quizId: this.data.quizId,
        order: this.data.order,
        type: v.type as QuestionType,
        prompt: v.prompt,
        prompt_i18n:
          Object.keys(prompt_i18n).length > 0 ? prompt_i18n : undefined,
        soundId: this.selectedSound()?.id ?? undefined,
        choices,
        explanation: v.explanation || undefined,
        explanation_i18n:
          Object.keys(explanation_i18n).length > 0
            ? explanation_i18n
            : undefined,
        timeLimitOverride: v.timeLimitOverride || undefined,
      };

      if (this.isEditMode()) {
        await this.quizService.updateQuestion(this.data.question!.id, payload);
        this.snackBar.open(
          this.translate.instant('admin.quiz.questions.updateSuccess'),
          '',
          { duration: 3000 },
        );
      } else {
        await this.quizService.createQuestion(payload);
        this.snackBar.open(
          this.translate.instant('admin.quiz.questions.createSuccess'),
          '',
          { duration: 3000 },
        );
      }

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Error saving question:', error);
      this.snackBar.open(
        this.translate.instant('admin.quiz.questions.saveError'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.saving.set(false);
    }
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
