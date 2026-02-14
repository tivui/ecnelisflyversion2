import { defineFunction } from '@aws-amplify/backend';

export const pickMonthlyJourney = defineFunction({
  name: 'pick-monthly-journey',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  schedule: 'every day',
});
