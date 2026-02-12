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
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { QuizService } from '../../../../quiz/services/quiz.service';
import { Quiz, QuizDifficulty, QuizStatus } from '../../../../quiz/models/quiz.model';

interface DialogData {
  quiz: Quiz | null;
}

@Component({
  selector: 'app-quiz-edit-dialog',
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
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslateModule,
  ],
  templateUrl: './quiz-edit-dialog.component.html',
  styleUrl: './quiz-edit-dialog.component.scss',
})
export class QuizEditDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<QuizEditDialogComponent>);
  private readonly data: DialogData = inject(MAT_DIALOG_DATA);
  private readonly quizService = inject(QuizService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  form!: FormGroup;
  saving = signal(false);
  isEditMode = signal(false);

  difficulties: QuizDifficulty[] = ['easy', 'medium', 'hard'];
  statuses: QuizStatus[] = ['draft', 'published', 'archived'];

  ngOnInit() {
    this.isEditMode.set(!!this.data.quiz);

    this.form = this.fb.group({
      title: [this.data.quiz?.title ?? '', Validators.required],
      title_fr: [this.data.quiz?.title_i18n?.['fr'] ?? ''],
      title_en: [this.data.quiz?.title_i18n?.['en'] ?? ''],
      title_es: [this.data.quiz?.title_i18n?.['es'] ?? ''],
      description: [this.data.quiz?.description ?? ''],
      description_fr: [this.data.quiz?.description_i18n?.['fr'] ?? ''],
      description_en: [this.data.quiz?.description_i18n?.['en'] ?? ''],
      description_es: [this.data.quiz?.description_i18n?.['es'] ?? ''],
      difficulty: [this.data.quiz?.difficulty ?? 'medium', Validators.required],
      category: [this.data.quiz?.category ?? ''],
      status: [this.data.quiz?.status ?? 'draft', Validators.required],
    });
  }

  async save() {
    if (!this.form.valid) return;

    this.saving.set(true);

    try {
      const v = this.form.value;

      const title_i18n: Record<string, string> = {};
      if (v.title_fr) title_i18n['fr'] = v.title_fr;
      if (v.title_en) title_i18n['en'] = v.title_en;
      if (v.title_es) title_i18n['es'] = v.title_es;

      const description_i18n: Record<string, string> = {};
      if (v.description_fr) description_i18n['fr'] = v.description_fr;
      if (v.description_en) description_i18n['en'] = v.description_en;
      if (v.description_es) description_i18n['es'] = v.description_es;

      const payload = {
        title: v.title,
        title_i18n: Object.keys(title_i18n).length > 0 ? title_i18n : undefined,
        description: v.description || undefined,
        description_i18n:
          Object.keys(description_i18n).length > 0 ? description_i18n : undefined,
        difficulty: v.difficulty as QuizDifficulty,
        category: v.category || undefined,
        status: v.status as QuizStatus,
      };

      if (this.isEditMode()) {
        await this.quizService.updateQuiz(this.data.quiz!.id, payload);
        this.snackBar.open(
          this.translate.instant('admin.quiz.dialog.updateSuccess'),
          '',
          { duration: 3000 },
        );
      } else {
        await this.quizService.createQuiz(payload);
        this.snackBar.open(
          this.translate.instant('admin.quiz.dialog.createSuccess'),
          '',
          { duration: 3000 },
        );
      }

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Error saving quiz:', error);
      this.snackBar.open(
        this.translate.instant('admin.quiz.dialog.saveError'),
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
