import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';

const backend = defineBackend({
  auth,
  data,
  storage
});

// ➡ Ajouter le data source Amazon Translate
const translateDataSource = backend.data.addHttpDataSource(
  'TranslateDataSource',
  `https://translate.${backend.data.stack.region}.amazonaws.com`,
  {
    authorizationConfig: {
      signingRegion: backend.data.stack.region,
      signingServiceName: 'translate',
    },
  },
);

// ➡ Donner les permissions au data source
translateDataSource.grantPrincipal.addToPrincipalPolicy(
  new PolicyStatement({
    actions: ['translate:TranslateText'],
    resources: ['*'],
  }),
);
