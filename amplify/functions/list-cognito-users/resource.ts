import { defineFunction } from '@aws-amplify/backend';

export const listCognitoUsers = defineFunction({
  name: 'list-cognito-users',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 256,
});
