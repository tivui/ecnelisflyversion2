import { defineFunction } from '@aws-amplify/backend';

export const pickMonthlyZone = defineFunction({
  name: 'pick-monthly-zone',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
  schedule: 'every day',
});
