import { inject, Injectable } from '@angular/core';
import { AmplifyService } from '../../../core/services/amplify.service';
import { AppUserService } from '../../../core/services/app-user.service';
import {
  Quiz,
  QuizQuestion,
  QuizAttempt,
  QuizAnswer,
  QuizChoice,
  MonthlyQuiz,
  QuizDifficulty,
  QuizStatus,
  QuestionType,
  calculateStars,
} from '../models/quiz.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root',
})
export class QuizService {
  private readonly amplifyService = inject(AmplifyService);
  private readonly appUserService = inject(AppUserService);

  private get client() {
    return this.amplifyService.client;
  }

  // ============ MAPPERS ============

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapQuiz(raw: any): Quiz {
    return {
      id: raw.id,
      title: raw.title,
      title_i18n: raw.title_i18n ? JSON.parse(raw.title_i18n) : undefined,
      description: raw.description ?? undefined,
      description_i18n: raw.description_i18n
        ? JSON.parse(raw.description_i18n)
        : undefined,
      difficulty: raw.difficulty as QuizDifficulty,
      category: raw.category ?? undefined,
      imageKey: raw.imageKey ?? undefined,
      icon: raw.icon ?? undefined,
      status: raw.status as QuizStatus,
      questionCount: raw.questionCount ?? 0,
      questionsPerPlay: raw.questionsPerPlay ?? 5,
      totalPlays: raw.totalPlays ?? 0,
      createdAt: raw.createdAt ?? undefined,
      updatedAt: raw.updatedAt ?? undefined,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapQuestion(raw: any): QuizQuestion {
    let choices: QuizChoice[] = [];
    if (raw.choices) {
      const parsed =
        typeof raw.choices === 'string' ? JSON.parse(raw.choices) : raw.choices;
      choices = Array.isArray(parsed) ? parsed : [];
    }

    return {
      id: raw.id,
      quizId: raw.quizId,
      order: raw.order,
      type: raw.type as QuestionType,
      prompt: raw.prompt,
      prompt_i18n: raw.prompt_i18n
        ? JSON.parse(raw.prompt_i18n)
        : undefined,
      soundId: raw.soundId ?? undefined,
      choices,
      explanation: raw.explanation ?? undefined,
      explanation_i18n: raw.explanation_i18n
        ? JSON.parse(raw.explanation_i18n)
        : undefined,
      timeLimitOverride: raw.timeLimitOverride ?? undefined,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapAttempt(raw: any): QuizAttempt {
    let answers: QuizAnswer[] = [];
    if (raw.answers) {
      const parsed =
        typeof raw.answers === 'string' ? JSON.parse(raw.answers) : raw.answers;
      answers = Array.isArray(parsed) ? parsed : [];
    }

    return {
      id: raw.id,
      quizId: raw.quizId,
      userId: raw.userId,
      username: raw.username ?? undefined,
      avatarStyle: raw.avatarStyle ?? undefined,
      avatarSeed: raw.avatarSeed ?? undefined,
      avatarBgColor: raw.avatarBgColor ?? undefined,
      score: raw.score,
      maxScore: raw.maxScore,
      stars: raw.stars ?? 0,
      answers,
      completedAt: raw.completedAt ?? undefined,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapMonthlyQuiz(raw: any): MonthlyQuiz {
    return {
      id: raw.id,
      quizId: raw.quizId,
      month: raw.month,
      active: raw.active ?? true,
    };
  }

  // ============ SOUND HELPER ============

  async getSoundFilename(soundId: string): Promise<string | null> {
    try {
      const result = await (this.client.models.Sound.get as any)(
        { id: soundId },
        { selectionSet: ['id', 'filename'], authMode: 'apiKey' },
      );
      return result.data?.filename ?? null;
    } catch {
      return null;
    }
  }

  // ============ QUIZ CRUD (Admin) ============

  async listQuizzes(): Promise<Quiz[]> {
    const result = await this.client.models.Quiz.list();
    if (result.errors?.length) {
      console.error('Error listing quizzes:', result.errors);
      throw new Error('Failed to list quizzes');
    }
    return (result.data ?? []).map((q: any) => this.mapQuiz(q));
  }

  async listPublishedQuizzes(): Promise<Quiz[]> {
    const result = await (
      this.client.models.Quiz.listQuizzesByStatus as any
    )({ status: 'published' }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error listing published quizzes:', result.errors);
      throw new Error('Failed to list published quizzes');
    }
    return (result.data ?? []).map((q: any) => this.mapQuiz(q));
  }

  async getQuiz(id: string): Promise<Quiz | null> {
    const result = await (this.client.models.Quiz.get as any)({ id }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error getting quiz:', result.errors);
      throw new Error('Failed to get quiz');
    }
    return result.data ? this.mapQuiz(result.data) : null;
  }

  async createQuiz(data: {
    title: string;
    title_i18n?: Record<string, string>;
    description?: string;
    description_i18n?: Record<string, string>;
    difficulty: QuizDifficulty;
    category?: string;
    imageKey?: string;
    icon?: string;
    status: QuizStatus;
    questionsPerPlay?: number;
  }): Promise<Quiz> {
    const result = await this.client.models.Quiz.create({
      id: uuidv4(),
      title: data.title,
      title_i18n: data.title_i18n
        ? JSON.stringify(data.title_i18n)
        : undefined,
      description: data.description,
      description_i18n: data.description_i18n
        ? JSON.stringify(data.description_i18n)
        : undefined,
      difficulty: data.difficulty,
      category: data.category,
      imageKey: data.imageKey,
      icon: data.icon,
      status: data.status,
      questionCount: 0,
      questionsPerPlay: data.questionsPerPlay ?? 5,
      totalPlays: 0,
    } as any);
    if (result.errors?.length) {
      console.error('Error creating quiz:', result.errors);
      throw new Error('Failed to create quiz');
    }
    return this.mapQuiz(result.data);
  }

  async updateQuiz(
    id: string,
    updates: Partial<{
      title: string;
      title_i18n: Record<string, string>;
      description: string;
      description_i18n: Record<string, string>;
      difficulty: QuizDifficulty;
      category: string;
      imageKey: string;
      icon: string;
      status: QuizStatus;
      questionCount: number;
      questionsPerPlay: number;
      totalPlays: number;
    }>,
  ): Promise<Quiz> {
    const input: Record<string, unknown> = { id };

    if (updates.title !== undefined) input['title'] = updates.title;
    if (updates.title_i18n !== undefined)
      input['title_i18n'] = JSON.stringify(updates.title_i18n);
    if (updates.description !== undefined)
      input['description'] = updates.description;
    if (updates.description_i18n !== undefined)
      input['description_i18n'] = JSON.stringify(updates.description_i18n);
    if (updates.difficulty !== undefined)
      input['difficulty'] = updates.difficulty;
    if (updates.category !== undefined) input['category'] = updates.category;
    if (updates.imageKey !== undefined) input['imageKey'] = updates.imageKey;
    if (updates.icon !== undefined) input['icon'] = updates.icon;
    if (updates.status !== undefined) input['status'] = updates.status;
    if (updates.questionCount !== undefined)
      input['questionCount'] = updates.questionCount;
    if (updates.questionsPerPlay !== undefined)
      input['questionsPerPlay'] = updates.questionsPerPlay;
    if (updates.totalPlays !== undefined)
      input['totalPlays'] = updates.totalPlays;

    const result = await this.client.models.Quiz.update(input as any);
    if (result.errors?.length) {
      console.error('Error updating quiz:', result.errors);
      throw new Error('Failed to update quiz');
    }
    return this.mapQuiz(result.data);
  }

  async deleteQuiz(id: string): Promise<void> {
    // Delete all questions first
    const questions = await this.getQuizQuestions(id);
    for (const q of questions) {
      await this.deleteQuestion(q.id);
    }

    const result = await this.client.models.Quiz.delete({ id });
    if (result.errors?.length) {
      console.error('Error deleting quiz:', result.errors);
      throw new Error('Failed to delete quiz');
    }
  }

  // ============ QUESTION CRUD (Admin) ============

  async getQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
    const result = await (
      this.client.models.QuizQuestion.listQuestionsByQuiz as any
    )({ quizId }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error listing questions:', result.errors);
      throw new Error('Failed to list questions');
    }
    return (result.data ?? [])
      .map((q: any) => this.mapQuestion(q))
      .sort((a: QuizQuestion, b: QuizQuestion) => a.order - b.order);
  }

  async createQuestion(data: {
    quizId: string;
    order: number;
    type: QuestionType;
    prompt: string;
    prompt_i18n?: Record<string, string>;
    soundId?: string;
    choices: QuizChoice[];
    explanation?: string;
    explanation_i18n?: Record<string, string>;
    timeLimitOverride?: number;
  }): Promise<QuizQuestion> {
    const result = await this.client.models.QuizQuestion.create({
      id: uuidv4(),
      quizId: data.quizId,
      order: data.order,
      type: data.type,
      prompt: data.prompt,
      prompt_i18n: data.prompt_i18n
        ? JSON.stringify(data.prompt_i18n)
        : undefined,
      soundId: data.soundId,
      choices: JSON.stringify(data.choices),
      explanation: data.explanation,
      explanation_i18n: data.explanation_i18n
        ? JSON.stringify(data.explanation_i18n)
        : undefined,
      timeLimitOverride: data.timeLimitOverride,
    } as any);
    if (result.errors?.length) {
      console.error('Error creating question:', result.errors);
      throw new Error('Failed to create question');
    }
    return this.mapQuestion(result.data);
  }

  async updateQuestion(
    id: string,
    updates: Partial<{
      order: number;
      type: QuestionType;
      prompt: string;
      prompt_i18n: Record<string, string>;
      soundId: string;
      choices: QuizChoice[];
      explanation: string;
      explanation_i18n: Record<string, string>;
      timeLimitOverride: number;
    }>,
  ): Promise<QuizQuestion> {
    const input: Record<string, unknown> = { id };

    if (updates.order !== undefined) input['order'] = updates.order;
    if (updates.type !== undefined) input['type'] = updates.type;
    if (updates.prompt !== undefined) input['prompt'] = updates.prompt;
    if (updates.prompt_i18n !== undefined)
      input['prompt_i18n'] = JSON.stringify(updates.prompt_i18n);
    if (updates.soundId !== undefined) input['soundId'] = updates.soundId;
    if (updates.choices !== undefined)
      input['choices'] = JSON.stringify(updates.choices);
    if (updates.explanation !== undefined)
      input['explanation'] = updates.explanation;
    if (updates.explanation_i18n !== undefined)
      input['explanation_i18n'] = JSON.stringify(updates.explanation_i18n);
    if (updates.timeLimitOverride !== undefined)
      input['timeLimitOverride'] = updates.timeLimitOverride;

    const result = await this.client.models.QuizQuestion.update(input as any);
    if (result.errors?.length) {
      console.error('Error updating question:', result.errors);
      throw new Error('Failed to update question');
    }
    return this.mapQuestion(result.data);
  }

  async deleteQuestion(id: string): Promise<void> {
    const result = await this.client.models.QuizQuestion.delete({ id });
    if (result.errors?.length) {
      console.error('Error deleting question:', result.errors);
      throw new Error('Failed to delete question');
    }
  }

  async reorderQuestions(
    questions: { id: string; order: number }[],
  ): Promise<void> {
    for (const q of questions) {
      await this.client.models.QuizQuestion.update({
        id: q.id,
        order: q.order,
      } as any);
    }
  }

  // ============ QUIZ ATTEMPTS (Gameplay) ============

  async submitAttempt(
    quizId: string,
    answers: QuizAnswer[],
    maxScore: number,
  ): Promise<QuizAttempt> {
    const user = this.appUserService.currentUser;
    if (!user) throw new Error('User not authenticated');

    const score = answers.reduce((sum, a) => sum + a.points, 0);
    const stars = calculateStars(score, maxScore);

    const result = await this.client.models.QuizAttempt.create({
      id: uuidv4(),
      quizId,
      userId: user.id,
      username: user.username,
      avatarStyle: user.avatarStyle ?? null,
      avatarSeed: user.avatarSeed ?? null,
      avatarBgColor: user.avatarBgColor ?? null,
      score,
      maxScore,
      stars,
      answers: JSON.stringify(answers),
      completedAt: new Date().toISOString(),
    } as any);
    if (result.errors?.length) {
      console.error('Error submitting attempt:', result.errors);
      throw new Error('Failed to submit attempt');
    }

    // Increment totalPlays on the quiz
    try {
      const quiz = await this.getQuiz(quizId);
      if (quiz) {
        await this.updateQuiz(quizId, {
          totalPlays: (quiz.totalPlays ?? 0) + 1,
        });
      }
    } catch {
      // Non-critical, ignore
    }

    return this.mapAttempt(result.data);
  }

  async getAttempt(id: string): Promise<QuizAttempt | null> {
    const result = await (this.client.models.QuizAttempt.get as any)({ id }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error getting attempt:', result.errors);
      throw new Error('Failed to get attempt');
    }
    return result.data ? this.mapAttempt(result.data) : null;
  }

  async getLeaderboard(
    quizId: string,
    limit = 10,
  ): Promise<QuizAttempt[]> {
    const result = await (
      this.client.models.QuizAttempt.listAttemptsByQuizAndScore as any
    )({
      quizId,
      sortDirection: 'DESC',
      limit,
    }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error getting leaderboard:', result.errors);
      throw new Error('Failed to get leaderboard');
    }
    return (result.data ?? []).map((a: any) => this.mapAttempt(a));
  }

  async getMyAttempts(): Promise<QuizAttempt[]> {
    const user = this.appUserService.currentUser;
    if (!user) return [];

    const result = await (
      this.client.models.QuizAttempt.listAttemptsByUser as any
    )({
      userId: user.id,
      sortDirection: 'DESC',
    });
    if (result.errors?.length) {
      console.error('Error getting user attempts:', result.errors);
      throw new Error('Failed to get user attempts');
    }
    return (result.data ?? []).map((a: any) => this.mapAttempt(a));
  }

  async getMyBestScore(quizId: string): Promise<QuizAttempt | null> {
    const attempts = await this.getMyAttempts();
    const quizAttempts = attempts
      .filter((a) => a.quizId === quizId)
      .sort((a, b) => b.score - a.score);
    return quizAttempts.length > 0 ? quizAttempts[0] : null;
  }

  // ============ ADMIN: MANAGE ATTEMPTS ============

  async getQuizAttempts(quizId: string): Promise<QuizAttempt[]> {
    const result = await (
      this.client.models.QuizAttempt.listAttemptsByQuizAndScore as any
    )({
      quizId,
      sortDirection: 'DESC',
      limit: 500,
    });
    if (result.errors?.length) {
      console.error('Error listing quiz attempts:', result.errors);
      throw new Error('Failed to list quiz attempts');
    }
    return (result.data ?? []).map((a: any) => this.mapAttempt(a));
  }

  async deleteAttempt(id: string): Promise<void> {
    const result = await this.client.models.QuizAttempt.delete({ id });
    if (result.errors?.length) {
      console.error('Error deleting attempt:', result.errors);
      throw new Error('Failed to delete attempt');
    }
  }

  async deleteAllAttempts(quizId: string): Promise<number> {
    const attempts = await this.getQuizAttempts(quizId);
    for (const a of attempts) {
      await this.deleteAttempt(a.id);
    }
    return attempts.length;
  }

  // ============ MONTHLY QUIZ ============

  async getMonthlyQuiz(): Promise<{ monthly: MonthlyQuiz; quiz: Quiz } | null> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const result = await (
      this.client.models.MonthlyQuiz.getMonthlyQuizByMonth as any
    )({ month }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error getting monthly quiz:', result.errors);
      return null;
    }

    const actives = (result.data ?? []).filter((m: any) => m.active);
    if (actives.length === 0) return null;

    const monthly = this.mapMonthlyQuiz(actives[0]);
    const quiz = await this.getQuiz(monthly.quizId);
    if (!quiz) return null;

    return { monthly, quiz };
  }

  async setMonthlyQuiz(quizId: string, month: string): Promise<MonthlyQuiz> {
    // Deactivate existing monthly quizzes for this month
    const existing = await (
      this.client.models.MonthlyQuiz.getMonthlyQuizByMonth as any
    )({ month });
    if (existing.data) {
      for (const m of existing.data) {
        if (m.active) {
          await this.client.models.MonthlyQuiz.update({
            id: m.id,
            active: false,
          } as any);
        }
      }
    }

    const result = await this.client.models.MonthlyQuiz.create({
      id: uuidv4(),
      quizId,
      month,
      active: true,
    } as any);
    if (result.errors?.length) {
      console.error('Error setting monthly quiz:', result.errors);
      throw new Error('Failed to set monthly quiz');
    }
    return this.mapMonthlyQuiz(result.data);
  }

  async listMonthlyQuizzes(): Promise<MonthlyQuiz[]> {
    const result = await this.client.models.MonthlyQuiz.list();
    if (result.errors?.length) {
      console.error('Error listing monthly quizzes:', result.errors);
      throw new Error('Failed to list monthly quizzes');
    }
    return (result.data ?? []).map((m: any) => this.mapMonthlyQuiz(m));
  }
}
