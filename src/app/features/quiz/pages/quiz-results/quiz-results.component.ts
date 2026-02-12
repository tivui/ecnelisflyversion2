import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { QuizService } from '../../services/quiz.service';
import { AppUserService } from '../../../../core/services/app-user.service';
import {
  Quiz,
  QuizAttempt,
  QuizAnswer,
  QuizQuestion,
  calculateStars,
} from '../../models/quiz.model';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';

@Component({
  selector: 'app-quiz-results',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    UserAvatarComponent,
  ],
  templateUrl: './quiz-results.component.html',
  styleUrl: './quiz-results.component.scss',
})
export class QuizResultsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly appUserService = inject(AppUserService);
  private readonly translate = inject(TranslateService);

  loading = signal(true);
  quiz = signal<Quiz | null>(null);
  attempt = signal<QuizAttempt | null>(null);
  leaderboard = signal<QuizAttempt[]>([]);
  isGuest = signal(false);

  // Local data for guest or fallback
  localScore = signal(0);
  localMaxScore = signal(0);
  localAnswers = signal<QuizAnswer[]>([]);
  localQuestions = signal<QuizQuestion[]>([]);

  score = computed(() => this.attempt()?.score ?? this.localScore());
  maxScore = computed(() => this.attempt()?.maxScore ?? this.localMaxScore());
  stars = computed(() => {
    if (this.attempt()) return this.attempt()!.stars;
    return calculateStars(this.localScore(), this.localMaxScore());
  });
  percentage = computed(() => {
    const max = this.maxScore();
    return max > 0 ? Math.round((this.score() / max) * 100) : 0;
  });

  isAuthenticated = computed(() => !!this.appUserService.currentUser);

  private quizId = '';

  ngOnInit() {
    this.quizId = this.route.snapshot.params['id'];
    const attemptId = this.route.snapshot.params['attemptId'];

    // Check for local state data (guest mode or fallback)
    const nav = this.router.getCurrentNavigation()?.extras?.state
      ?? history.state;

    if (attemptId === 'local' && nav) {
      this.isGuest.set(!!nav['guest']);
      this.localScore.set(nav['score'] ?? 0);
      this.localMaxScore.set(nav['maxScore'] ?? 0);
      this.localAnswers.set(nav['answers'] ?? []);
      this.localQuestions.set(nav['questions'] ?? []);
      this.loadQuizAndLeaderboard();
    } else {
      this.loadAttemptData(attemptId);
    }
  }

  private async loadAttemptData(attemptId: string) {
    try {
      const [quiz, attempt, leaderboard] = await Promise.all([
        this.quizService.getQuiz(this.quizId),
        this.quizService.getAttempt(attemptId),
        this.quizService.getLeaderboard(this.quizId, 10),
      ]);
      this.quiz.set(quiz);
      this.attempt.set(attempt);
      this.leaderboard.set(leaderboard);
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadQuizAndLeaderboard() {
    try {
      const [quiz, leaderboard] = await Promise.all([
        this.quizService.getQuiz(this.quizId),
        this.quizService.getLeaderboard(this.quizId, 10),
      ]);
      this.quiz.set(quiz);
      this.leaderboard.set(leaderboard);
    } catch (error) {
      console.error('Error loading quiz:', error);
    } finally {
      this.loading.set(false);
    }
  }

  goToReview() {
    const attemptId = this.route.snapshot.params['attemptId'];
    if (attemptId === 'local') {
      this.router.navigate(['/quiz', this.quizId, 'review', 'local'], {
        state: {
          answers: this.localAnswers(),
          questions: this.localQuestions(),
        },
      });
    } else {
      this.router.navigate(['/quiz', this.quizId, 'review', attemptId]);
    }
  }

  replay() {
    this.router.navigate(['/quiz', this.quizId, 'play']);
  }

  goToQuizList() {
    this.router.navigate(['/quiz']);
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  starsArray = computed(() => Array.from({ length: 3 }, (_, i) => i < this.stars()));
}
