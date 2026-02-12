import { defineFunction } from '@aws-amplify/backend';

export const pickMonthlyQuiz = defineFunction({
  name: 'pick-monthly-quiz',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  schedule: 'every day',
});
