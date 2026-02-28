import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { CdkDropList, CdkDrag, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { QuizService } from '../../../../quiz/services/quiz.service';
import { Quiz, QuizQuestion } from '../../../../quiz/models/quiz.model';
import { QuestionEditDialogComponent } from '../question-edit-dialog/question-edit-dialog.component';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
    selector: 'app-quiz-questions-editor',
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatChipsModule,
        TranslateModule,
        CdkDropList,
        CdkDrag,
    ],
    templateUrl: './quiz-questions-editor.component.html',
    styleUrl: './quiz-questions-editor.component.scss'
})
export class QuizQuestionsEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  quiz = signal<Quiz | null>(null);
  questions = signal<QuizQuestion[]>([]);
  loading = signal(true);

  private quizId = '';

  ngOnInit() {
    this.quizId = this.route.snapshot.params['id'];
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const [quiz, questions] = await Promise.all([
        this.quizService.getQuiz(this.quizId),
        this.quizService.getQuizQuestions(this.quizId),
      ]);
      this.quiz.set(quiz);
      this.questions.set(questions);

      // Auto-sync questionCount if stale
      if (quiz && quiz.questionCount !== questions.length) {
        await this.updateQuestionCount();
      }
    } catch (error) {
      console.error('Error loading quiz questions:', error);
    } finally {
      this.loading.set(false);
    }
  }

  openAddDialog() {
    const nextOrder = this.questions().length + 1;
    const dialogRef = this.dialog.open(QuestionEditDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      data: { quizId: this.quizId, question: null, order: nextOrder },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.loadData();
        await this.updateQuestionCount();
      }
    });
  }

  openEditDialog(question: QuizQuestion) {
    const dialogRef = this.dialog.open(QuestionEditDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      data: { quizId: this.quizId, question, order: question.order },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadData();
      }
    });
  }

  async deleteQuestion(question: QuizQuestion) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.quiz.questions.delete.title'),
        message: this.translate.instant('admin.quiz.questions.delete.message'),
        confirmText: this.translate.instant('admin.quiz.questions.delete.confirm'),
        cancelText: this.translate.instant('common.action.cancel'),
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.quizService.deleteQuestion(question.id);
          // Reorder remaining
          const remaining = this.questions()
            .filter((q) => q.id !== question.id)
            .map((q, i) => ({ id: q.id, order: i + 1 }));
          await this.quizService.reorderQuestions(remaining);
          await this.loadData();
          await this.updateQuestionCount();
          this.snackBar.open(
            this.translate.instant('admin.quiz.questions.delete.success'),
            '',
            { duration: 3000 },
          );
        } catch (error) {
          console.error('Error deleting question:', error);
        }
      }
    });
  }

  async onDrop(event: CdkDragDrop<QuizQuestion[]>) {
    if (event.previousIndex === event.currentIndex) return;

    const items = [...this.questions()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.questions.set(items);

    try {
      const updates = items.map((q, i) => ({ id: q.id, order: i + 1 }));
      await this.quizService.reorderQuestions(updates);
    } catch (error) {
      console.error('Error reordering questions:', error);
      await this.loadData();
    }
  }

  private async updateQuestionCount() {
    try {
      const count = this.questions().length;
      await this.quizService.updateQuiz(this.quizId, { questionCount: count });
    } catch {
      // non-critical
    }
  }

  goBack() {
    this.router.navigate(['/admin/database/quizzes']);
  }

  getQuestionTypeLabel(type: string): string {
    return this.translate.instant('admin.quiz.questions.type.' + type);
  }
}
