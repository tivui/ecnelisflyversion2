import { defineFunction } from '@aws-amplify/backend';

export const deleteSoundFile = defineFunction({
  name: 'delete-sound-file',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 10,
  memoryMB: 128,
});
