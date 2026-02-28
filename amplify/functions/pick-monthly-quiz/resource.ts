import { defineFunction } from '@aws-amplify/backend';

export const pickMonthlyQuiz = defineFunction({
  name: 'pick-monthly-quiz',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
  schedule: 'every day',
});
