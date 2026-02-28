import { defineFunction } from '@aws-amplify/backend';

export const fixImportedUsers = defineFunction({
  name: 'fix-imported-users',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 900, // 15 minutes
  memoryMB: 1024,
});
