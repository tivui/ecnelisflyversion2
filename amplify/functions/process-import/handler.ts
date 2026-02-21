import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/process-import';
import type { Schema } from '../../data/resource';
import { CategoryKey } from '../../data/categories';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Handler } from 'aws-lambda';

const s3 = new S3Client();
const PREFIX = '[PROCESS-IMPORT]';
const PROGRESS_BATCH_SIZE = 5;

interface ImportEvent {
  jobId: string;
  s3Key: string;
}

export const handler: Handler<ImportEvent> = async (event) => {
  const { jobId, s3Key } = event;

  // Configure Amplify
  const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  const client = generateClient<Schema>();

  // Helper: update the ImportJob record
  const updateJob = async (fields: Record<string, unknown>) => {
    try {
      await client.models.ImportJob.update({ id: jobId, ...fields });
    } catch (err) {
      console.error(`${PREFIX} Failed to update ImportJob ${jobId}:`, err);
    }
  };

  try {
    // 1. Read JSON from S3
    const bucketName = process.env.ECNELISFLY_STORAGE_BUCKET_NAME;
    if (!bucketName) {
      await updateJob({
        status: 'FAILED',
        errorMessage: 'S3 bucket not configured',
        completedAt: new Date().toISOString(),
      });
      return;
    }

    console.log(`${PREFIX} Reading s3://${bucketName}/${s3Key}`);
    const s3Response = await s3.send(
      new GetObjectCommand({ Bucket: bucketName, Key: s3Key }),
    );
    const bodyString = await s3Response.Body!.transformToString('utf-8');
    const content = JSON.parse(bodyString);

    // Accept both formats: plain array [...] or { sounds: [...] }
    const sounds = Array.isArray(content) ? content : content.sounds;

    if (!sounds || !Array.isArray(sounds)) {
      await updateJob({
        status: 'FAILED',
        errorMessage: 'Invalid JSON: expected an array or { sounds: [...] }',
        completedAt: new Date().toISOString(),
      });
      return;
    }
    const totalSounds = sounds.length;

    // 2. Update job: PROCESSING
    await updateJob({ status: 'PROCESSING', totalSounds });

    // 3. Process each sound
    const stats = {
      processedCount: 0,
      importedCount: 0,
      skippedCount: 0,
      invalidCategoryCount: 0,
      invalidDatesCount: 0,
      emptyHashtagsCount: 0,
    };

    for (const sound of sounds) {
      // === User lookup/creation ===
      const users = await client.models.User.list({
        filter: { username: { eq: sound.username } },
      });

      let user;
      if (users.data.length > 0) {
        user = users.data[0];
      } else {
        try {
          const countryCode = sound.flag
            ? sound.flag.replace(/\.png$/i, '')
            : undefined;

          // Use a unique placeholder email per author to avoid OAuth merge
          // conflicts (the old DB stored the admin's email for all sounds)
          const safeEmail = `imported_${sound.username.toLowerCase().replace(/[^a-z0-9]/g, '_')}@imported.local`;

          const created = await client.models.User.create({
            username: sound.username,
            email: safeEmail,
            country: countryCode,
            language: 'fr',
            theme: 'light',
          });

          if (created.errors && created.errors.length > 0) {
            console.error(
              `${PREFIX} Failed to create user "${sound.username}":`,
              created.errors,
            );
            stats.skippedCount++;
            stats.processedCount++;
            if (stats.processedCount % PROGRESS_BATCH_SIZE === 0) {
              await updateJob({ ...stats });
            }
            continue;
          }

          user = created.data;
          console.info(
            `${PREFIX} Created user "${sound.username}" id=${user!.id}`,
          );
        } catch (err) {
          console.error(
            `${PREFIX} Exception creating user "${sound.username}":`,
            err,
          );
          stats.skippedCount++;
          stats.processedCount++;
          if (stats.processedCount % PROGRESS_BATCH_SIZE === 0) {
            await updateJob({ ...stats });
          }
          continue;
        }
      }

      // === Date parsing ===
      let dateTime: string | undefined;
      if (sound.date_min) {
        const parsed = new Date(sound.date_min);
        if (isNaN(parsed.getTime())) {
          console.warn(
            `${PREFIX} Invalid date_min for "${sound.title}": ${sound.date_min}`,
          );
          stats.invalidDatesCount++;
        } else {
          dateTime = parsed.toISOString();
        }
      }

      let recordDateTime: string | undefined;
      if (sound.record_date_min) {
        const parsed = new Date(sound.record_date_min);
        if (isNaN(parsed.getTime())) {
          console.warn(
            `${PREFIX} Invalid record_date_min for "${sound.title}": ${sound.record_date_min}`,
          );
          stats.invalidDatesCount++;
        } else {
          recordDateTime = parsed.toISOString().split('T')[0];
        }
      }

      // === Category validation ===
      let category: CategoryKey | undefined;
      if (
        sound.category &&
        Object.values(CategoryKey).includes(sound.category as CategoryKey)
      ) {
        category = sound.category as CategoryKey;
      } else if (sound.category) {
        console.warn(
          `${PREFIX} Invalid category for "${sound.title}": ${sound.category}`,
        );
        stats.invalidCategoryCount++;
      }

      // === Hashtags ===
      const hashtags = sound.hashtags
        ? sound.hashtags.split(/\s+/).filter(Boolean).join(',')
        : undefined;

      if (!hashtags) {
        console.warn(`${PREFIX} Empty hashtags for "${sound.title}"`);
        stats.emptyHashtagsCount++;
      }

      const shortHashtags = sound.hashtags_min
        ? sound.hashtags_min.split(/\s+/).filter(Boolean).join(',')
        : undefined;

      // === Create Sound record ===
      try {
        const result = await client.models.Sound.create({
          userId: user!.id,
          title: sound.title,
          title_i18n: sound.title_i18n
            ? JSON.stringify(sound.title_i18n)
            : '{}',
          shortStory: sound.short_story,
          shortStory_i18n: sound.short_story_i18n
            ? JSON.stringify(sound.short_story_i18n)
            : '{}',
          filename: sound.filename || 'unknown.mp3',
          status: sound.status === 'public' ? 'public' : 'private',
          latitude: sound.lat ? Number(sound.lat) : undefined,
          longitude: sound.lg ? Number(sound.lg) : undefined,
          category,
          secondaryCategory: sound.category2 || undefined,
          dateTime,
          recordDateTime,
          equipment: sound.matos,
          layer: sound.calque,
          license: sound.license,
          likesCount: typeof sound.nb_likes === 'number' ? sound.nb_likes : 0,
          url: sound.url || undefined,
          urlTitle: sound.url_title || undefined,
          secondaryUrl: sound.url_2 || undefined,
          secondaryUrlTitle: sound.url_title_2 || undefined,
          hashtags,
          shortHashtags,
          city: sound.ville,
        });

        if (result.errors && result.errors.length > 0) {
          console.error(
            `${PREFIX} Failed to create sound "${sound.title}":`,
            JSON.stringify(result.errors, null, 2),
          );
          stats.skippedCount++;
        } else {
          console.info(
            `${PREFIX} Created sound "${sound.title}" (id=${result.data?.id})`,
          );
          stats.importedCount++;
        }
      } catch (err) {
        console.error(
          `${PREFIX} Exception creating sound "${sound.title}":`,
          err,
        );
        stats.skippedCount++;
      }

      stats.processedCount++;

      // Batch progress update
      if (stats.processedCount % PROGRESS_BATCH_SIZE === 0) {
        await updateJob({ ...stats });
        console.log(
          `${PREFIX} Progress: ${stats.processedCount}/${totalSounds}`,
        );
      }
    }

    // 4. Final update: COMPLETED
    await updateJob({
      status: 'COMPLETED',
      ...stats,
      completedAt: new Date().toISOString(),
    });

    console.log(`${PREFIX} Import completed:`, stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`${PREFIX} Fatal error:`, err);
    await updateJob({
      status: 'FAILED',
      errorMessage: message,
      completedAt: new Date().toISOString(),
    });
  }
};
