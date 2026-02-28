import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { CfnTable } from 'aws-cdk-lib/aws-dynamodb';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { listCognitoUsers } from './functions/list-cognito-users/resource';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { deleteSoundFile } from './functions/delete-sound-file/resource';
import { pickDailyFeaturedSound } from './functions/pick-daily-featured-sound/resource';
import { pickMonthlyQuiz } from './functions/pick-monthly-quiz/resource';
import { pickMonthlyArticle } from './functions/pick-monthly-article/resource';
import { pickMonthlyZone } from './functions/pick-monthly-zone/resource';
import { pickMonthlyJourney } from './functions/pick-monthly-journey/resource';
import { startImport } from './functions/start-import/resource';
import { processImport } from './functions/process-import/resource';
import { fixImportedUsers } from './functions/fix-imported-users/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  deleteSoundFile,
  pickDailyFeaturedSound,
  pickMonthlyQuiz,
  pickMonthlyArticle,
  pickMonthlyZone,
  pickMonthlyJourney,
  startImport,
  processImport,
  fixImportedUsers,
  listCognitoUsers,
});

// ➡ Templates email Cognito (verification + reset password)
const { cfnUserPool } = backend.auth.resources.cfnResources;

cfnUserPool.emailVerificationSubject = 'Vérifiez votre compte Ecnelis FLY 🎧';
cfnUserPool.emailVerificationMessage = `
<html><head><meta charset="UTF-8"><style>
body{font-family:sans-serif;background:#f1f2f6;margin:0;padding:20px}
.card{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
.header{background:linear-gradient(135deg,#1976d2,#3f51b5,#7e57c2);padding:32px 24px;text-align:center}
.logo{height:52px}
.title{color:#fff;font-size:1.3rem;font-weight:800;margin:10px 0 0}
.body{padding:32px 24px;color:#333}
.code{display:block;font-size:2rem;font-weight:900;text-align:center;letter-spacing:10px;color:#1976d2;background:#e3f2fd;border-radius:12px;padding:16px;margin:24px 0}
.note{font-size:.82rem;color:#888}
.footer{background:#f8f9fa;padding:12px 24px;text-align:center;font-size:.75rem;color:#aaa}
a{color:#1976d2;text-decoration:none}
</style></head><body>
<div class="card">
  <div class="header">
    <img src="https://www.ecnelisfly.com/img/logos/logo_blue_orange_left_round.png" alt="Ecnelis FLY" class="logo">
    <div class="title">🎧 Ecnelis FLY</div>
  </div>
  <div class="body">
    <p>Merci de rejoindre <strong>Ecnelis FLY</strong>, la plateforme d'exploration sonore géolocalisée.</p>
    <p>Votre code de vérification est :</p>
    <span class="code">{####}</span>
    <p class="note">Ce code expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.</p>
  </div>
  <div class="footer">© 2025 Ecnelis FLY · <a href="https://www.ecnelisfly.com">ecnelisfly.com</a></div>
</div>
</body></html>
`;

// TODO: Activer SES quand le domaine ecnelisfly.com sera vérifié dans AWS SES Console
// Étapes :
//   1. Vérifier ecnelisfly.com dans SES Console (DNS CNAME + DKIM sur OVH)
//   2. Sortir du sandbox SES (demande AWS support)
//   3. Décommenter le bloc ci-dessous et redéployer
// const { Stack } = require('aws-cdk-lib');
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

// ➡ Permissions pour fix-imported-users : lire les fichiers JSON depuis S3
const fixImportedUsersLambda = backend.fixImportedUsers.resources.lambda as LambdaFunction;

fixImportedUsersLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:GetObject'],
    resources: [`${storageBucket.bucketArn}/imports/*`],
  }),
);

fixImportedUsersLambda.addEnvironment(
  'ECNELISFLY_STORAGE_BUCKET_NAME',
  storageBucket.bucketName,
);

// ➡ Versioning S3 + lifecycle rule (suppression des anciennes versions après 90 jours)
const cfnBucket = storageBucket.node.defaultChild as CfnBucket;

cfnBucket.versioningConfiguration = { status: 'Enabled' };

cfnBucket.addPropertyOverride('LifecycleConfiguration', {
  Rules: [
    {
      Status: 'Enabled',
      NoncurrentVersionExpiration: { NoncurrentDays: 90 },
      AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
    },
  ],
});

// ➡ DynamoDB : Point-in-Time Recovery (35 jours) + Deletion Protection (production uniquement)
// AWS_BRANCH est défini par Amplify Console en CI/CD, absent en sandbox
const isSandbox = !process.env.AWS_BRANCH;

if (!isSandbox) {
  const tables = backend.data.resources.tables;

  Object.values(tables).forEach((table) => {
    const cfnTable = table.node.defaultChild as CfnTable | undefined;
    if (!cfnTable) return;

    cfnTable.pointInTimeRecoverySpecification = {
      pointInTimeRecoveryEnabled: true,
    };

    cfnTable.deletionProtectionEnabled = true;
  });
}

// ➡ Permissions Cognito AdminListUsers pour la Lambda list-cognito-users
const listCognitoUsersLambda = backend.listCognitoUsers.resources.lambda as LambdaFunction;

listCognitoUsersLambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['cognito-idp:ListUsers'],
    resources: [backend.auth.resources.userPool.userPoolArn],
  }),
);

listCognitoUsersLambda.addEnvironment(
  'USER_POOL_ID',
  backend.auth.resources.userPool.userPoolId,
);


