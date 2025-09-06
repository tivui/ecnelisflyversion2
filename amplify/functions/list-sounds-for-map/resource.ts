import { defineFunction } from '@aws-amplify/backend';

export const listSoundsForMap = defineFunction({
  name: 'list-sounds-for-map',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 1024
});
