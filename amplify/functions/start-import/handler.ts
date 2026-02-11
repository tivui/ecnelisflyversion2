import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/start-import';
import type { Schema } from '../../data/resource';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient();

export const handler: Schema['startImport']['functionHandler'] = async (
  event,
) => {
  const PREFIX = '[START-IMPORT]';

  const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  const client = generateClient<Schema>();

  const { s3Key } = event.arguments;

  if (!s3Key) {
    return { success: false, error: 'Missing s3Key argument' };
  }

  try {
    // 1. Create ImportJob record
    const jobResult = await client.models.ImportJob.create({
      status: 'PENDING',
      s3Key,
      totalSounds: 0,
      processedCount: 0,
      importedCount: 0,
      skippedCount: 0,
      invalidCategoryCount: 0,
      invalidDatesCount: 0,
      emptyHashtagsCount: 0,
      startedAt: new Date().toISOString(),
    });

    if (jobResult.errors && jobResult.errors.length > 0) {
      console.error(
        `${PREFIX} Failed to create ImportJob:`,
        jobResult.errors,
      );
      return { success: false, error: 'Failed to create import job' };
    }

    const jobId = jobResult.data!.id;
    console.log(`${PREFIX} Created ImportJob: ${jobId}`);

    // 2. Invoke process-import Lambda asynchronously
    const processLambdaName = process.env.PROCESS_IMPORT_FUNCTION_NAME;
    if (!processLambdaName) {
      console.error(`${PREFIX} PROCESS_IMPORT_FUNCTION_NAME not set`);
      return { success: false, error: 'Process function not configured' };
    }

    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: processLambdaName,
        InvocationType: 'Event', // Fire-and-forget async invocation
        Payload: Buffer.from(JSON.stringify({ jobId, s3Key })),
      }),
    );

    console.log(
      `${PREFIX} Async invocation of process-import sent for job ${jobId}`,
    );

    // 3. Return immediately
    return { success: true, jobId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`${PREFIX} Exception:`, err);
    return { success: false, error: message };
  }
};
