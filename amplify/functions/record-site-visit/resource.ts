import { defineFunction } from '@aws-amplify/backend';

export const recordSiteVisit = defineFunction({
  name: 'record-site-visit',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 10,
  memoryMB: 128,
  resourceGroupName: 'data',
});
