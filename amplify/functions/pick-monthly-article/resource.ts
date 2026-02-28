import { defineFunction } from '@aws-amplify/backend';

export const pickMonthlyArticle = defineFunction({
  name: 'pick-monthly-article',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
  schedule: 'every day',
});
