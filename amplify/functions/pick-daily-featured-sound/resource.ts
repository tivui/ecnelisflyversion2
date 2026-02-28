import { defineFunction } from '@aws-amplify/backend';

export const pickDailyFeaturedSound = defineFunction({
  name: 'pick-daily-featured-sound',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
  schedule: 'every day',
});
