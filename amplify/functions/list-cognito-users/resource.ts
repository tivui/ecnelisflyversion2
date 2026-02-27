import { defineFunction } from '@aws-amplify/backend';

export const listCognitoUsers = defineFunction({
  name: 'list-cognito-users',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 256,
});
