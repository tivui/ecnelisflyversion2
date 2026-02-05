import { defineFunction } from '@aws-amplify/backend';

export const deleteSoundFile = defineFunction({
  name: 'delete-sound-file',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 128,
});
