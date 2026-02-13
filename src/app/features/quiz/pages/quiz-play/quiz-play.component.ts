import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { QuizService } from '../../services/quiz.service';
import { StorageService } from '../../../../core/services/storage.service';
import { AppUserService } from '../../../../core/services/app-user.service';
import {
  Quiz,
  QuizQuestion,
  QuizAnswer,
  QuizChoice,
  QUIZ_TIME_LIMITS,
  calculatePoints,
} from '../../models/quiz.model';

type GameState = 'loading' | 'countdown' | 'playing' | 'feedback' | 'finished';

@Component({
  selector: 'app-quiz-play',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './quiz-play.component.html',
  styleUrl: './quiz-play.component.scss',
})
export class QuizPlayComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly storageService = inject(StorageService);
  private readonly appUserService = inject(AppUserService);
  private readonly translate = inject(TranslateService);

  // State
  gameState = signal<GameState>('loading');
  quiz = signal<Quiz | null>(null);
  questions = signal<QuizQuestion[]>([]);
  currentIndex = signal(0);
  answers = signal<QuizAnswer[]>([]);
  countdownValue = signal(3);

  // Timer
  timeRemaining = signal(0);
  timeLimit = signal(0);
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private questionStartTime = 0;

  // Audio
  private audio: HTMLAudioElement | null = null;
  isPlaying = signal(false);

  // Feedback
  lastAnswerCorrect = signal(false);
  lastChosenIndex = signal(-1);

  // Auth
  isAuthenticated = computed(() => !!this.appUserService.currentUser);

  // Computed
  currentQuestion = computed(() => {
    const qs = this.questions();
    const idx = this.currentIndex();
    return idx < qs.length ? qs[idx] : null;
  });

  progress = computed(() => {
    const total = this.questions().length;
    return total > 0 ? ((this.currentIndex()) / total) * 100 : 0;
  });

  timerPercent = computed(() => {
    const limit = this.timeLimit();
    return limit > 0 ? (this.timeRemaining() / limit) * 100 : 100;
  });

  timerColor = computed(() => {
    const pct = this.timerPercent();
    if (pct > 50) return 'primary';
    if (pct > 25) return 'accent';
    return 'warn';
  });

  totalScore = computed(() =>
    this.answers().reduce((sum, a) => sum + a.points, 0),
  );

  ngOnInit() {
    const quizId = this.route.snapshot.params['id'];
    this.loadQuiz(quizId);
  }

  ngOnDestroy() {
    this.stopTimer();
    this.stopAudio();
  }

  private async loadQuiz(quizId: string) {
    try {
      const [quiz, questions] = await Promise.all([
        this.quizService.getQuiz(quizId),
        this.quizService.getQuizQuestions(quizId),
      ]);

      if (!quiz || questions.length === 0) {
        this.router.navigate(['/quiz']);
        return;
      }

      this.quiz.set(quiz);
      this.questions.set(questions);
      this.startCountdown();
    } catch (error) {
      console.error('Error loading quiz:', error);
      this.router.navigate(['/quiz']);
    }
  }

  private startCountdown() {
    this.gameState.set('countdown');
    this.countdownValue.set(3);

    const interval = setInterval(() => {
      const v = this.countdownValue() - 1;
      if (v <= 0) {
        clearInterval(interval);
        this.startQuestion();
      } else {
        this.countdownValue.set(v);
      }
    }, 1000);
  }

  private startQuestion() {
    this.gameState.set('playing');
    this.lastChosenIndex.set(-1);

    const q = this.currentQuestion();
    if (!q) return;

    const limit =
      (q.timeLimitOverride ?? QUIZ_TIME_LIMITS[this.quiz()!.difficulty]) * 1000;
    this.timeLimit.set(limit);
    this.timeRemaining.set(limit);
    this.questionStartTime = Date.now();

    // Load and play the sound if question has one
    if (q.soundId) {
      this.loadAndPlaySound(q.soundId);
    }

    // Start timer
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.questionStartTime;
      const remaining = Math.max(0, limit - elapsed);
      this.timeRemaining.set(remaining);

      if (remaining <= 0) {
        this.onTimeUp();
      }
    }, 50);
  }

  private async loadAndPlaySound(soundId: string) {
    try {
      const filename = await this.quizService.getSoundFilename(soundId);
      if (filename) {
        const url = await this.storageService.getSoundUrl(filename);
        this.playAudioUrl(url);
      }
    } catch {
      // Sound loading failed, game continues
    }
  }

  private playAudioUrl(url: string) {
    this.stopAudio();
    this.audio = new Audio(url);
    this.audio.onplay = () => this.isPlaying.set(true);
    this.audio.onended = () => this.isPlaying.set(false);
    this.audio.onpause = () => this.isPlaying.set(false);
    this.audio.play().catch(() => {});
  }

  toggleAudio() {
    if (!this.audio) return;
    if (this.audio.paused) {
      this.audio.play().catch(() => {});
    } else {
      this.audio.pause();
    }
  }

  /** Play a sound by choice soundId (for odd_one_out type) */
  async playChoiceSound(choice: QuizChoice) {
    if (!choice.soundId) return;
    await this.loadAndPlaySound(choice.soundId);
  }

  selectAnswer(choiceIndex: number) {
    if (this.gameState() !== 'playing') return;

    this.stopTimer();
    this.stopAudio();

    const q = this.currentQuestion()!;
    const choice = q.choices[choiceIndex];
    const correct = choice.isCorrect;
    const timeMs = Date.now() - this.questionStartTime;
    const points = calculatePoints(correct, this.timeLimit() - timeMs, this.timeLimit());

    const answer: QuizAnswer = {
      questionId: q.id,
      chosenIndex: choiceIndex,
      correct,
      timeMs,
      points,
    };

    this.answers.update((a) => [...a, answer]);
    this.lastAnswerCorrect.set(correct);
    this.lastChosenIndex.set(choiceIndex);
    this.gameState.set('feedback');

    // Auto-advance after feedback delay
    setTimeout(() => this.nextQuestion(), 2000);
  }

  private onTimeUp() {
    this.stopTimer();
    this.stopAudio();

    const q = this.currentQuestion()!;
    const answer: QuizAnswer = {
      questionId: q.id,
      chosenIndex: -1,
      correct: false,
      timeMs: this.timeLimit(),
      points: 0,
    };

    this.answers.update((a) => [...a, answer]);
    this.lastAnswerCorrect.set(false);
    this.lastChosenIndex.set(-1);
    this.gameState.set('feedback');

    setTimeout(() => this.nextQuestion(), 2000);
  }

  private nextQuestion() {
    const nextIdx = this.currentIndex() + 1;
    if (nextIdx >= this.questions().length) {
      this.finishQuiz();
    } else {
      this.currentIndex.set(nextIdx);
      this.startQuestion();
    }
  }

  private async finishQuiz() {
    this.gameState.set('finished');
    const quiz = this.quiz()!;
    const maxScore = this.questions().length * 150;

    if (this.isAuthenticated()) {
      try {
        const attempt = await this.quizService.submitAttempt(
          quiz.id,
          this.answers(),
          maxScore,
        );
        this.router.navigate(['/quiz', quiz.id, 'results', attempt.id]);
      } catch (error) {
        console.error('Error submitting attempt:', error);
        // Navigate to results anyway, pass data via state
        this.router.navigate(['/quiz', quiz.id, 'results', 'local'], {
          state: {
            answers: this.answers(),
            score: this.totalScore(),
            maxScore,
            questions: this.questions(),
          },
        });
      }
    } else {
      // Guest mode: navigate with local data
      this.router.navigate(['/quiz', quiz.id, 'results', 'local'], {
        state: {
          answers: this.answers(),
          score: this.totalScore(),
          maxScore,
          questions: this.questions(),
          guest: true,
        },
      });
    }
  }

  getCorrectIndex(): number {
    const q = this.currentQuestion();
    if (!q) return -1;
    return q.choices.findIndex((c) => c.isCorrect);
  }

  getLocalizedPrompt(): string {
    const q = this.currentQuestion();
    if (!q) return '';
    const lang = this.translate.currentLang;
    if (q.prompt_i18n && q.prompt_i18n[lang]) return q.prompt_i18n[lang];
    return q.prompt;
  }

  getLocalizedChoice(choice: QuizChoice): string {
    const lang = this.translate.currentLang;
    if (choice.label_i18n && choice.label_i18n[lang]) return choice.label_i18n[lang];
    return choice.label;
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private stopAudio() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.isPlaying.set(false);
  }
}
