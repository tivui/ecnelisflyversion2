import { defineFunction } from '@aws-amplify/backend';

export const startImport = defineFunction({
  name: 'start-import',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 10,
  memoryMB: 256,
});
