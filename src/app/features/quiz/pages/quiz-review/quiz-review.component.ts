import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { QuizService } from '../../services/quiz.service';
import { StorageService } from '../../../../core/services/storage.service';
import {
  Quiz,
  QuizQuestion,
  QuizAttempt,
  QuizAnswer,
  QuizChoice,
} from '../../models/quiz.model';

interface ReviewItem {
  question: QuizQuestion;
  answer: QuizAnswer;
}

@Component({
    selector: 'app-quiz-review',
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        TranslateModule,
    ],
    templateUrl: './quiz-review.component.html',
    styleUrl: './quiz-review.component.scss'
})
export class QuizReviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly storageService = inject(StorageService);
  private readonly translate = inject(TranslateService);

  loading = signal(true);
  quiz = signal<Quiz | null>(null);
  reviewItems = signal<ReviewItem[]>([]);

  private audio: HTMLAudioElement | null = null;
  playingSoundId = signal<string | null>(null);

  private quizId = '';

  ngOnInit() {
    this.quizId = this.route.snapshot.params['id'];
    const attemptId = this.route.snapshot.params['attemptId'];

    const nav = this.router.getCurrentNavigation()?.extras?.state
      ?? history.state;

    if (attemptId === 'local' && nav) {
      this.loadLocalReview(nav);
    } else {
      this.loadAttemptReview(attemptId);
    }
  }

  private async loadLocalReview(state: any) {
    try {
      const quiz = await this.quizService.getQuiz(this.quizId);
      this.quiz.set(quiz);

      const questions: QuizQuestion[] = state['questions'] ?? [];
      const answers: QuizAnswer[] = state['answers'] ?? [];

      const items: ReviewItem[] = questions.map((q) => ({
        question: q,
        answer: answers.find((a) => a.questionId === q.id) ?? {
          questionId: q.id,
          chosenIndex: -1,
          correct: false,
          timeMs: 0,
          points: 0,
        },
      }));

      this.reviewItems.set(items);
    } catch (error) {
      console.error('Error loading local review:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadAttemptReview(attemptId: string) {
    try {
      const [quiz, questions, attempt] = await Promise.all([
        this.quizService.getQuiz(this.quizId),
        this.quizService.getQuizQuestions(this.quizId),
        this.quizService.getAttempt(attemptId),
      ]);

      this.quiz.set(quiz);

      if (attempt && questions.length > 0) {
        const items: ReviewItem[] = questions.map((q) => ({
          question: q,
          answer: attempt.answers.find((a) => a.questionId === q.id) ?? {
            questionId: q.id,
            chosenIndex: -1,
            correct: false,
            timeMs: 0,
            points: 0,
          },
        }));
        this.reviewItems.set(items);
      }
    } catch (error) {
      console.error('Error loading review:', error);
    } finally {
      this.loading.set(false);
    }
  }

  getLocalizedPrompt(q: QuizQuestion): string {
    const lang = this.translate.currentLang;
    if (q.prompt_i18n && q.prompt_i18n[lang]) return q.prompt_i18n[lang];
    return q.prompt;
  }

  getLocalizedChoice(choice: QuizChoice): string {
    const lang = this.translate.currentLang;
    if (choice.label_i18n && choice.label_i18n[lang]) return choice.label_i18n[lang];
    return choice.label;
  }

  getLocalizedExplanation(q: QuizQuestion): string {
    if (!q.explanation) return '';
    const lang = this.translate.currentLang;
    if (q.explanation_i18n && q.explanation_i18n[lang]) return q.explanation_i18n[lang];
    return q.explanation;
  }

  goBack() {
    const attemptId = this.route.snapshot.params['attemptId'];
    this.router.navigate(['/quiz', this.quizId, 'results', attemptId]);
  }

  goToQuizList() {
    this.router.navigate(['/quiz']);
  }
}
