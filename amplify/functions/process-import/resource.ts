import { defineFunction } from '@aws-amplify/backend';

export const processImport = defineFunction({
  name: 'process-import',
  entry: './handler.ts',
  timeoutSeconds: 900, // 15 minutes
  memoryMB: 1024,
});
