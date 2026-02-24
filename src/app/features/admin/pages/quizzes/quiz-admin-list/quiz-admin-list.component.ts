import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';

import { QuizService } from '../../../../quiz/services/quiz.service';
import { Quiz, QuizAttempt } from '../../../../quiz/models/quiz.model';
import { QuizEditDialogComponent } from '../quiz-edit-dialog/quiz-edit-dialog.component';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-quiz-admin-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    TranslateModule,
  ],
  templateUrl: './quiz-admin-list.component.html',
  styleUrl: './quiz-admin-list.component.scss',
})
export class QuizAdminListComponent implements OnInit {
  private readonly quizService = inject(QuizService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  quizzes = signal<Quiz[]>([]);
  loading = signal(true);
  displayedColumns = ['title', 'difficulty', 'status', 'questionCount', 'totalPlays', 'actions'];

  // Leaderboard management
  expandedQuizId = signal<string | null>(null);
  expandedQuiz = computed(() => {
    const id = this.expandedQuizId();
    return id ? this.quizzes().find(q => q.id === id) ?? null : null;
  });
  leaderboardAttempts = signal<QuizAttempt[]>([]);
  leaderboardLoading = signal(false);
  deletingAttemptId = signal<string | null>(null);

  ngOnInit() {
    this.loadQuizzes();
  }

  async loadQuizzes() {
    this.loading.set(true);
    try {
      const quizzes = await this.quizService.listQuizzes();
      this.quizzes.set(quizzes.sort((a, b) => {
        const statusOrder: Record<string, number> = { draft: 0, published: 1, archived: 2 };
        return (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0);
      }));
    } catch (error) {
      console.error('Error loading quizzes:', error);
      this.snackBar.open(
        this.translate.instant('admin.quiz.loadError'),
        this.translate.instant('common.action.cancel'),
        { duration: 3000 },
      );
    } finally {
      this.loading.set(false);
    }
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(QuizEditDialogComponent, {
      width: '90vw',
      maxWidth: '700px',
      maxHeight: '90vh',
      data: { quiz: null },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadQuizzes();
      }
    });
  }

  openEditDialog(quiz: Quiz) {
    const dialogRef = this.dialog.open(QuizEditDialogComponent, {
      width: '90vw',
      maxWidth: '700px',
      maxHeight: '90vh',
      data: { quiz },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadQuizzes();
      }
    });
  }

  openQuestions(quiz: Quiz) {
    this.router.navigate(['/admin/database/quizzes', quiz.id, 'questions']);
  }

  async deleteQuiz(quiz: Quiz) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.quiz.delete.title'),
        message: this.translate.instant('admin.quiz.delete.message', {
          name: quiz.title,
        }),
        confirmText: this.translate.instant('admin.quiz.delete.confirm'),
        cancelText: this.translate.instant('common.action.cancel'),
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.quizService.deleteQuiz(quiz.id);
          this.snackBar.open(
            this.translate.instant('admin.quiz.delete.success'),
            '',
            { duration: 3000 },
          );
          this.loadQuizzes();
        } catch (error) {
          console.error('Error deleting quiz:', error);
          this.snackBar.open(
            this.translate.instant('admin.quiz.delete.error'),
            '',
            { duration: 3000 },
          );
        }
      }
    });
  }

  async setAsMonthly(quiz: Quiz) {
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await this.quizService.setMonthlyQuiz(quiz.id, month);
      this.snackBar.open(
        this.translate.instant('admin.quiz.monthlySet'),
        '',
        { duration: 3000 },
      );
    } catch (error) {
      console.error('Error setting monthly quiz:', error);
    }
  }

  async toggleLeaderboard(quiz: Quiz) {
    if (this.expandedQuizId() === quiz.id) {
      this.expandedQuizId.set(null);
      this.leaderboardAttempts.set([]);
      return;
    }
    this.expandedQuizId.set(quiz.id);
    this.leaderboardLoading.set(true);
    try {
      const attempts = await this.quizService.getQuizAttempts(quiz.id);
      this.leaderboardAttempts.set(attempts);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      this.snackBar.open(
        this.translate.instant('admin.quiz.leaderboard.loadError'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.leaderboardLoading.set(false);
    }
  }

  async deleteAttempt(attempt: QuizAttempt) {
    this.deletingAttemptId.set(attempt.id);
    try {
      await this.quizService.deleteAttempt(attempt.id);
      this.leaderboardAttempts.update(list => list.filter(a => a.id !== attempt.id));
      this.snackBar.open(
        this.translate.instant('admin.quiz.leaderboard.deleteSuccess'),
        '',
        { duration: 2500 },
      );
    } catch (error) {
      console.error('Error deleting attempt:', error);
      this.snackBar.open(
        this.translate.instant('admin.quiz.leaderboard.deleteError'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.deletingAttemptId.set(null);
    }
  }

  async deleteAllAttempts(quiz: Quiz) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.quiz.leaderboard.deleteAllTitle'),
        message: this.translate.instant('admin.quiz.leaderboard.deleteAllMessage', {
          name: this.getLocalizedTitle(quiz),
        }),
        confirmText: this.translate.instant('admin.quiz.leaderboard.deleteAllConfirm'),
        cancelText: this.translate.instant('common.action.cancel'),
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        this.leaderboardLoading.set(true);
        try {
          const count = await this.quizService.deleteAllAttempts(quiz.id);
          this.leaderboardAttempts.set([]);
          this.snackBar.open(
            this.translate.instant('admin.quiz.leaderboard.deleteAllSuccess', { count }),
            '',
            { duration: 3000 },
          );
        } catch (error) {
          console.error('Error deleting all attempts:', error);
          this.snackBar.open(
            this.translate.instant('admin.quiz.leaderboard.deleteError'),
            '',
            { duration: 3000 },
          );
        } finally {
          this.leaderboardLoading.set(false);
        }
      }
    });
  }

  getLocalizedTitle(quiz: Quiz): string {
    const lang = this.translate.currentLang;
    if (quiz.title_i18n && quiz.title_i18n[lang]) {
      return quiz.title_i18n[lang];
    }
    return quiz.title;
  }
}
