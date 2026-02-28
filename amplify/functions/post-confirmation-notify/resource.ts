import { defineFunction } from '@aws-amplify/backend';

export const postConfirmationNotify = defineFunction({
  name: 'post-confirmation-notify',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 10,
  memoryMB: 128,
});
