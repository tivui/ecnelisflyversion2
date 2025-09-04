import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'ecnelisFlyStorage',
  access: (allow) => ({
    'sounds/*': [
      allow.authenticated.to(['read']),
      allow.guest.to(['read']),
      allow.groups(['ADMIN']).to(['read', 'write']),
    ],
  }),
});
