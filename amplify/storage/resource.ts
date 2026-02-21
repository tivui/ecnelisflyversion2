import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'ecnelisFlyStorage',
  access: (allow) => ({
    'sounds/*': [
      allow.authenticated.to(['read', 'write']),
      allow.guest.to(['read']),
      allow.groups(['ADMIN']).to(['read', 'write', 'delete']),
    ],
    'imports/*': [
      allow.groups(['ADMIN']).to(['read', 'write']),
    ],
    'articles/*': [
      allow.authenticated.to(['read']),
      allow.guest.to(['read']),
      allow.groups(['ADMIN']).to(['read', 'write', 'delete']),
    ],
    'zones/*': [
      allow.authenticated.to(['read']),
      allow.guest.to(['read']),
      allow.groups(['ADMIN']).to(['read', 'write', 'delete']),
    ],
    'journeys/*': [
      allow.authenticated.to(['read']),
      allow.guest.to(['read']),
      allow.groups(['ADMIN']).to(['read', 'write', 'delete']),
    ],
  }),
});
