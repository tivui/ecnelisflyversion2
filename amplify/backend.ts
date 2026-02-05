import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { deleteSoundFile } from './functions/delete-sound-file/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  deleteSoundFile,
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

// ➡ Donner les permissions S3 delete au Lambda delete-sound-file
const storageBucket = backend.storage.resources.bucket;
const deleteSoundFileLambda = backend.deleteSoundFile.resources.lambda as LambdaFunction;

deleteSoundFileLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:DeleteObject'],
    resources: [`${storageBucket.bucketArn}/sounds/*`],
  }),
);

deleteSoundFileLambda.addEnvironment(
  'ECNELISFLY_STORAGE_BUCKET_NAME',
  storageBucket.bucketName,
);
