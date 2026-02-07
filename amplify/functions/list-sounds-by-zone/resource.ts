import { defineFunction } from '@aws-amplify/backend';

export const listSoundsByZone = defineFunction({
  name: 'list-sounds-by-zone',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 1024
});
