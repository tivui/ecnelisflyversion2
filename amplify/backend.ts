import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { deleteSoundFile } from './functions/delete-sound-file/resource';
import { pickDailyFeaturedSound } from './functions/pick-daily-featured-sound/resource';
import { pickMonthlyQuiz } from './functions/pick-monthly-quiz/resource';
import { pickMonthlyArticle } from './functions/pick-monthly-article/resource';
import { pickMonthlyZone } from './functions/pick-monthly-zone/resource';
import { startImport } from './functions/start-import/resource';
import { processImport } from './functions/process-import/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  deleteSoundFile,
  pickDailyFeaturedSound,
  pickMonthlyQuiz,
  pickMonthlyArticle,
  pickMonthlyZone,
  startImport,
  processImport,
});

// TODO: Configurer SES quand le domaine ecnelisfly.com sera rattaché
// const { cfnUserPool } = backend.auth.resources.cfnResources;
// const region = Stack.of(backend.auth.resources.userPool).region;
// const accountId = Stack.of(backend.auth.resources.userPool).account;
// cfnUserPool.emailConfiguration = {
//   emailSendingAccount: 'DEVELOPER',
//   sourceArn: `arn:aws:ses:${region}:${accountId}:identity/noreply@ecnelisfly.com`,
//   from: 'Ecnelis FLY <noreply@ecnelisfly.com>',
// };

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

// ➡ Permissions pour start-import : invoquer process-import de manière asynchrone
const startImportLambda = backend.startImport.resources.lambda as LambdaFunction;
const processImportLambda = backend.processImport.resources.lambda as LambdaFunction;

startImportLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: [processImportLambda.functionArn],
  }),
);

startImportLambda.addEnvironment(
  'PROCESS_IMPORT_FUNCTION_NAME',
  processImportLambda.functionName,
);

// ➡ Permissions pour process-import : lire les fichiers JSON depuis S3
processImportLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:GetObject'],
    resources: [`${storageBucket.bucketArn}/imports/*`],
  }),
);

processImportLambda.addEnvironment(
  'ECNELISFLY_STORAGE_BUCKET_NAME',
  storageBucket.bucketName,
);
