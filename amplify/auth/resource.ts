import { defineAuth, secret } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 *
 * Note: Le trigger CustomMessage (cognitoCustomMessage) est intentionnellement
 * désactivé car il créerait une dépendance circulaire CDK :
 * auth → function → data → auth
 * Les emails utilisent le template CDK configuré dans backend.ts.
 * Les templates sauvegardés en DynamoDB via l'UI admin pourront être connectés
 * ultérieurement via une architecture découplée (ex: Step Functions, SSM).
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile', 'openid'],
        attributeMapping: {
          email: 'email',
          givenName: 'given_name',
          familyName: 'family_name',
        },
      },
      callbackUrls: [
        'http://localhost:4200/',
        'https://main.da619w9z089j3.amplifyapp.com/',
        'https://ecnelisfly.com/',
        'https://www.ecnelisfly.com/',
      ],
      logoutUrls: [
        'http://localhost:4200/',
        'https://main.da619w9z089j3.amplifyapp.com/',
        'https://ecnelisfly.com/',
        'https://www.ecnelisfly.com/',
      ],
    },
  },
  groups: ['ADMIN'],
});
