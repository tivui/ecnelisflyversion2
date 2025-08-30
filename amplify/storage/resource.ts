import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'ecnelisFlyStorage',
  access: (allow) => ({
    'sounds/*': [
      allow.authenticated.to(['read', 'write']),
      allow.guest.to(['read']),
    ],
  }),
});
