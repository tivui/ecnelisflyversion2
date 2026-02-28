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
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        TranslateModule,
        UserAvatarComponent,
    ],
    templateUrl: './quiz-results.component.html',
    styleUrl: './quiz-results.component.scss'
})
export class QuizResultsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly appUserService = inject(AppUserService);
  private readonly translate = inject(TranslateService);

  loading = signal(true);
  quiz = signal<Quiz | null>(null);
  leaderboard = signal<QuizAttempt[]>([]);
  isGuest = signal(false);

  // Local data (always used now)
  localScore = signal(0);
  localMaxScore = signal(0);
  localAnswers = signal<QuizAnswer[]>([]);
  localQuestions = signal<QuizQuestion[]>([]);

  // Publish state
  published = signal(false);
  publishing = signal(false);
  publishedAttemptId = signal<string | null>(null);
  publishedRank = signal<number | null>(null);

  // Full leaderboard
  showFullLeaderboard = signal(false);
  fullLeaderboard = signal<QuizAttempt[]>([]);
  loadingFull = signal(false);

  score = computed(() => this.localScore());
  maxScore = computed(() => this.localMaxScore());
  stars = computed(() => calculateStars(this.localScore(), this.localMaxScore()));
  percentage = computed(() => {
    const max = this.maxScore();
    return max > 0 ? Math.round((this.score() / max) * 100) : 0;
  });

  isAuthenticated = computed(() => !!this.appUserService.currentUser);
  starsArray = computed(() => Array.from({ length: 3 }, (_, i) => i < this.stars()));

  // Estimated rank: where user would land in the current leaderboard
  estimatedRank = computed(() => {
    const s = this.score();
    const lb = this.leaderboard();
    if (lb.length === 0) return 1;
    const idx = lb.findIndex((entry) => s >= entry.score);
    return idx === -1 ? lb.length + 1 : idx + 1;
  });

  // Display leaderboard (top 10 or full)
  displayLeaderboard = computed(() =>
    this.showFullLeaderboard() ? this.fullLeaderboard() : this.leaderboard(),
  );

  // Whether there might be more entries beyond the top 10
  hasMoreEntries = computed(() => this.leaderboard().length >= 10);

  // After publish: check if user is visible in displayed leaderboard
  userInDisplayedList = computed(() => {
    const id = this.publishedAttemptId();
    if (!id) return false;
    return this.displayLeaderboard().some((e) => e.id === id);
  });

  // The user's published entry (for showing below separator when outside top 10)
  publishedEntry = computed(() => {
    const id = this.publishedAttemptId();
    if (!id) return null;
    const inFull = this.fullLeaderboard().find((e) => e.id === id);
    if (inFull) return inFull;
    return this.leaderboard().find((e) => e.id === id) ?? null;
  });

  private quizId = '';

  ngOnInit() {
    this.quizId = this.route.snapshot.params['id'];

    const nav = this.router.getCurrentNavigation()?.extras?.state ?? history.state;

    this.isGuest.set(!!nav?.['guest']);
    this.localScore.set(nav?.['score'] ?? 0);
    this.localMaxScore.set(nav?.['maxScore'] ?? 0);
    this.localAnswers.set(nav?.['answers'] ?? []);
    this.localQuestions.set(nav?.['questions'] ?? []);

    this.loadQuizAndLeaderboard();
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

  async publishScore() {
    if (this.publishing() || this.published()) return;

    this.publishing.set(true);
    try {
      const attempt = await this.quizService.submitAttempt(
        this.quizId,
        this.localAnswers(),
        this.localMaxScore(),
      );
      this.publishedAttemptId.set(attempt.id);
      this.published.set(true);

      // Refresh leaderboard to include new entry
      const leaderboard = await this.quizService.getLeaderboard(this.quizId, 10);
      this.leaderboard.set(leaderboard);

      // Calculate real rank
      const rank = leaderboard.findIndex((e) => e.id === attempt.id);
      if (rank !== -1) {
        this.publishedRank.set(rank + 1);
      } else {
        // User is outside top 10 — load full leaderboard to find position
        const full = await this.quizService.getLeaderboard(this.quizId, 100);
        this.fullLeaderboard.set(full);
        const fullRank = full.findIndex((e) => e.id === attempt.id);
        this.publishedRank.set(fullRank !== -1 ? fullRank + 1 : null);
      }
    } catch (error) {
      console.error('Error publishing score:', error);
    } finally {
      this.publishing.set(false);
    }
  }

  async loadFullLeaderboard() {
    this.loadingFull.set(true);
    try {
      const full = await this.quizService.getLeaderboard(this.quizId, 100);
      this.fullLeaderboard.set(full);
      this.showFullLeaderboard.set(true);
    } catch (error) {
      console.error('Error loading full leaderboard:', error);
    } finally {
      this.loadingFull.set(false);
    }
  }

  isCurrentUser(entry: QuizAttempt): boolean {
    return this.publishedAttemptId() === entry.id;
  }

  goToReview() {
    this.router.navigate(['/quiz', this.quizId, 'review', 'local'], {
      state: {
        answers: this.localAnswers(),
        questions: this.localQuestions(),
      },
    });
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
}
