import { defineFunction } from '@aws-amplify/backend';

export const importSounds = defineFunction({
  name: 'import-sounds',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 1024
});
