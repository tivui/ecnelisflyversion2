export type QuizDifficulty = 'easy' | 'medium' | 'hard';
export type QuizStatus = 'draft' | 'published' | 'archived';
export type QuestionType =
  | 'listen_identify'
  | 'listen_choose_category'
  | 'listen_choose_location'
  | 'odd_one_out'
  | 'true_false';

export interface QuizChoice {
  label: string;
  label_i18n?: Record<string, string>;
  isCorrect: boolean;
  soundId?: string;
}

export interface Quiz {
  id: string;
  title: string;
  title_i18n?: Record<string, string>;
  description?: string;
  description_i18n?: Record<string, string>;
  difficulty: QuizDifficulty;
  category?: string;
  imageKey?: string;
  icon?: string;
  status: QuizStatus;
  questionCount: number;
  questionsPerPlay: number;
  totalPlays: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuizQuestion {
  id: string;
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
}

export interface QuizAnswer {
  questionId: string;
  chosenIndex: number;
  correct: boolean;
  timeMs: number;
  points: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  username?: string;
  avatarStyle?: string;
  avatarSeed?: string;
  avatarBgColor?: string;
  score: number;
  maxScore: number;
  stars: number;
  answers: QuizAnswer[];
  completedAt?: string;
}

export interface MonthlyQuiz {
  id: string;
  quizId: string;
  month: string;
  active: boolean;
}

/** Default time limits per difficulty (in seconds) */
export const QUIZ_TIME_LIMITS: Record<QuizDifficulty, number> = {
  easy: 30,
  medium: 20,
  hard: 12,
};

/** Calculate stars from score percentage */
export function calculateStars(score: number, maxScore: number): number {
  if (maxScore === 0) return 0;
  const pct = score / maxScore;
  if (pct >= 0.9) return 3;
  if (pct >= 0.75) return 2;
  if (pct >= 0.5) return 1;
  return 0;
}

/** Calculate points for a single answer */
export function calculatePoints(
  correct: boolean,
  timeRemainingMs: number,
  timeLimitMs: number,
): number {
  if (!correct) return 0;
  const speedBonus = Math.round(50 * (timeRemainingMs / timeLimitMs));
  return 100 + Math.max(0, Math.min(50, speedBonus));
}
