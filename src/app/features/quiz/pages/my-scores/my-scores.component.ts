import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { QuizService } from '../../services/quiz.service';
import { Quiz, QuizAttempt } from '../../models/quiz.model';

interface ScoreEntry {
  attempt: QuizAttempt;
  quiz: Quiz | null;
}

@Component({
    selector: 'app-my-scores',
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        TranslateModule,
    ],
    templateUrl: './my-scores.component.html',
    styleUrl: './my-scores.component.scss'
})
export class MyScoresComponent implements OnInit {
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  loading = signal(true);
  entries = signal<ScoreEntry[]>([]);

  ngOnInit() {
    this.loadScores();
  }

  async loadScores() {
    this.loading.set(true);
    try {
      const attempts = await this.quizService.getMyAttempts();

      // Load quiz info for each unique quizId
      const quizIds = [...new Set(attempts.map((a) => a.quizId))];
      const quizMap = new Map<string, Quiz | null>();
      await Promise.all(
        quizIds.map(async (id) => {
          const quiz = await this.quizService.getQuiz(id);
          quizMap.set(id, quiz);
        }),
      );

      const entries: ScoreEntry[] = attempts.map((a) => ({
        attempt: a,
        quiz: quizMap.get(a.quizId) ?? null,
      }));

      this.entries.set(entries);
    } catch (error) {
      console.error('Error loading scores:', error);
    } finally {
      this.loading.set(false);
    }
  }

  goToReview(entry: ScoreEntry) {
    this.router.navigate(['/quiz', entry.attempt.quizId, 'review', entry.attempt.id]);
  }

  goToQuiz(entry: ScoreEntry) {
    this.router.navigate(['/quiz', entry.attempt.quizId]);
  }

  getLocalizedTitle(quiz: Quiz | null): string {
    if (!quiz) return '?';
    const lang = this.translate.currentLang;
    if (quiz.title_i18n && quiz.title_i18n[lang]) return quiz.title_i18n[lang];
    return quiz.title;
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
  }
}
