import { defineFunction } from '@aws-amplify/backend';

export const pickMonthlyZone = defineFunction({
  name: 'pick-monthly-zone',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
  schedule: 'every day',
});
