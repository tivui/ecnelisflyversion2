import { defineFunction } from '@aws-amplify/backend';

export const manageCognitoUser = defineFunction({
  name: 'manage-cognito-user',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 256,
});
