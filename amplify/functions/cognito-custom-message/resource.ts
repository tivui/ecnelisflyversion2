import { defineFunction } from '@aws-amplify/backend';

export const cognitoCustomMessage = defineFunction({
  name: 'cognito-custom-message',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 10,
  memoryMB: 128,
});
