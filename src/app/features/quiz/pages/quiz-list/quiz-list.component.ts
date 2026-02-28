import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { QuizService } from '../../services/quiz.service';
import { Quiz, MonthlyQuiz } from '../../models/quiz.model';

@Component({
    selector: 'app-quiz-list',
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        TranslateModule,
    ],
    templateUrl: './quiz-list.component.html',
    styleUrl: './quiz-list.component.scss'
})
export class QuizListComponent implements OnInit {
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  quizzes = signal<Quiz[]>([]);
  monthlyQuizId = signal<string | null>(null);
  loading = signal(true);

  ngOnInit() {
    this.loadQuizzes();
  }

  async loadQuizzes() {
    this.loading.set(true);
    try {
      const [quizzes, monthly] = await Promise.all([
        this.quizService.listPublishedQuizzes(),
        this.quizService.getMonthlyQuiz(),
      ]);

      if (monthly) {
        this.monthlyQuizId.set(monthly.quiz.id);
      }

      // Sort: monthly quiz first, then by creation date
      const sorted = quizzes.sort((a, b) => {
        if (a.id === this.monthlyQuizId()) return -1;
        if (b.id === this.monthlyQuizId()) return 1;
        return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
      });

      this.quizzes.set(sorted);
    } catch (error) {
      console.error('Error loading quizzes:', error);
    } finally {
      this.loading.set(false);
    }
  }

  openQuiz(quiz: Quiz) {
    this.router.navigate(['/quiz', quiz.id]);
  }

  getLocalizedTitle(quiz: Quiz): string {
    const lang = this.translate.currentLang;
    if (quiz.title_i18n && quiz.title_i18n[lang]) return quiz.title_i18n[lang];
    return quiz.title;
  }

  getLocalizedDescription(quiz: Quiz): string {
    if (!quiz.description) return '';
    const lang = this.translate.currentLang;
    if (quiz.description_i18n && quiz.description_i18n[lang])
      return quiz.description_i18n[lang];
    return quiz.description;
  }

  isMonthly(quiz: Quiz): boolean {
    return quiz.id === this.monthlyQuizId();
  }
}
