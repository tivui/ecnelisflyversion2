import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { QuizService } from '../../services/quiz.service';
import { AppUserService } from '../../../../core/services/app-user.service';
import { Quiz, QuizAttempt, QUIZ_TIME_LIMITS } from '../../models/quiz.model';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';

@Component({
    selector: 'app-quiz-lobby',
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        TranslateModule,
        UserAvatarComponent,
    ],
    templateUrl: './quiz-lobby.component.html',
    styleUrl: './quiz-lobby.component.scss'
})
export class QuizLobbyComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly appUserService = inject(AppUserService);
  private readonly translate = inject(TranslateService);

  loading = signal(true);
  quiz = signal<Quiz | null>(null);
  bestAttempt = signal<QuizAttempt | null>(null);
  topPlayers = signal<QuizAttempt[]>([]);

  isAuthenticated = computed(() => !!this.appUserService.currentUser);

  estimatedTime = computed(() => {
    const q = this.quiz();
    if (!q) return '';
    const seconds = q.questionsPerPlay * QUIZ_TIME_LIMITS[q.difficulty];
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes} min`;
  });

  private quizId = '';

  ngOnInit() {
    this.quizId = this.route.snapshot.params['id'];
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const [quiz, topPlayers] = await Promise.all([
        this.quizService.getQuiz(this.quizId),
        this.quizService.getLeaderboard(this.quizId, 3),
      ]);

      this.quiz.set(quiz);
      this.topPlayers.set(topPlayers);

      if (this.isAuthenticated()) {
        const best = await this.quizService.getMyBestScore(this.quizId);
        this.bestAttempt.set(best);
      }
    } catch (error) {
      console.error('Error loading quiz lobby:', error);
    } finally {
      this.loading.set(false);
    }
  }

  startQuiz() {
    this.router.navigate(['/quiz', this.quizId, 'play']);
  }

  goBack() {
    this.router.navigate(['/quiz']);
  }

  getLocalizedTitle(): string {
    const q = this.quiz();
    if (!q) return '';
    const lang = this.translate.currentLang;
    if (q.title_i18n && q.title_i18n[lang]) return q.title_i18n[lang];
    return q.title;
  }

  getLocalizedDescription(): string {
    const q = this.quiz();
    if (!q?.description) return '';
    const lang = this.translate.currentLang;
    if (q.description_i18n && q.description_i18n[lang]) return q.description_i18n[lang];
    return q.description;
  }
}
