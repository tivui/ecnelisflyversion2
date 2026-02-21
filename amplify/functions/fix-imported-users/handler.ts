import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/fix-imported-users';
import type { Schema } from '../../data/resource';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Handler } from 'aws-lambda';

const s3 = new S3Client();
const PREFIX = '[FIX-IMPORTED-USERS]';

export const handler: Handler = async (event) => {
  // Support both direct Lambda invocation and AppSync mutation
  const s3Key: string = event.arguments?.s3Key ?? event.s3Key;

  // Configure Amplify
  const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  const client = generateClient<Schema>();

  const bucketName = process.env.ECNELISFLY_STORAGE_BUCKET_NAME;
  if (!bucketName) {
    console.error(`${PREFIX} S3 bucket not configured`);
    return { error: 'S3 bucket not configured' };
  }

  // 1. Read JSON from S3
  console.log(`${PREFIX} Reading s3://${bucketName}/${s3Key}`);
  const s3Response = await s3.send(
    new GetObjectCommand({ Bucket: bucketName, Key: s3Key }),
  );
  const bodyString = await s3Response.Body!.transformToString('utf-8');
  const content = JSON.parse(bodyString);
  const sounds = Array.isArray(content) ? content : content.sounds;

  if (!sounds || !Array.isArray(sounds)) {
    return { error: 'Invalid JSON format' };
  }

  // 2. Build import map: filename -> { username, country }
  const importMap = new Map<string, { username: string; country?: string }>();
  for (const s of sounds) {
    if (s.filename && s.username) {
      const countryCode = s.flag
        ? s.flag.replace(/\.png$/i, '')
        : undefined;
      importMap.set(s.filename, { username: s.username, country: countryCode });
    }
  }
  console.log(`${PREFIX} Import map built: ${importMap.size} entries`);

  // 3. Load ALL sounds from DynamoDB (paginate through entire table)
  const allSounds: any[] = [];
  let nextToken: string | null = null;

  do {
    const page: { data: any[]; nextToken?: string | null } =
      await client.models.Sound.list({
        limit: 1000,
        ...(nextToken ? { nextToken } : {}),
      });
    allSounds.push(...page.data);
    nextToken = page.nextToken ?? null;
    console.log(`${PREFIX} Loaded ${allSounds.length} sounds so far...`);
  } while (nextToken);

  console.log(`${PREFIX} Total sounds in DB: ${allSounds.length}`);

  // 4. Index sounds by filename
  const soundsByFilename = new Map<string, any>();
  for (const sound of allSounds) {
    if (sound.filename) {
      soundsByFilename.set(sound.filename, sound);
    }
  }

  // 5. Cache of created/found users by username
  const userCache = new Map<string, string>(); // username -> userId

  const stats = {
    totalSounds: importMap.size,
    checked: 0,
    fixed: 0,
    alreadyCorrect: 0,
    soundNotFound: 0,
    errors: 0,
  };

  // 6. Process each imported sound
  for (const [filename, { username, country }] of importMap) {
    stats.checked++;

    try {
      const soundRecord = soundsByFilename.get(filename);

      if (!soundRecord) {
        console.warn(`${PREFIX} Sound not found for filename: ${filename}`);
        stats.soundNotFound++;
        continue;
      }

      // Check if the sound's user already has the correct username
      const currentUser = await client.models.User.get({ id: soundRecord.userId });
      if (currentUser.data?.username === username) {
        // Still fix country if wrong case (e.g. "de" → "DE")
        if (country && currentUser.data?.country !== country) {
          await client.models.User.update({
            id: currentUser.data!.id,
            country,
          });
          console.log(`${PREFIX} Fixed country for user "${username}": "${currentUser.data?.country}" → "${country}"`);
        }
        stats.alreadyCorrect++;
        continue;
      }

      console.log(
        `${PREFIX} Sound "${filename}" owned by "${currentUser.data?.username}" → should be "${username}"`,
      );

      // Find or create the correct user
      let correctUserId = userCache.get(username);
      if (!correctUserId) {
        // Search for existing user with this username
        const existingUsers = await client.models.User.list({
          filter: { username: { eq: username } },
        });

        if (existingUsers.data.length > 0) {
          const existing = existingUsers.data[0];
          correctUserId = existing.id;

          // Fix country if missing or wrong case
          if (country && existing.country !== country) {
            await client.models.User.update({
              id: existing.id,
              country,
            });
            console.log(`${PREFIX} Updated country for user "${username}" → ${country}`);
          }
        } else {
          // Create a new user for this original author
          const safeEmail = `imported_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}@imported.local`;
          const created = await client.models.User.create({
            username,
            email: safeEmail,
            country,
            language: 'fr',
            theme: 'light',
          });

          if (created.errors?.length) {
            console.error(`${PREFIX} Failed to create user "${username}":`, created.errors);
            stats.errors++;
            continue;
          }

          correctUserId = created.data!.id;
          console.log(`${PREFIX} Created user "${username}" id=${correctUserId}`);
        }

        userCache.set(username, correctUserId);
      }

      // Update the Sound's userId
      await client.models.Sound.update({
        id: soundRecord.id,
        userId: correctUserId,
      });

      console.log(
        `${PREFIX} Fixed sound "${filename}" → userId=${correctUserId} (${username})`,
      );
      stats.fixed++;
    } catch (err) {
      console.error(`${PREFIX} Error processing "${filename}":`, err);
      stats.errors++;
    }

    if (stats.checked % 50 === 0) {
      console.log(`${PREFIX} Progress: ${stats.checked}/${stats.totalSounds}`);
    }
  }

  console.log(`${PREFIX} Migration completed:`, stats);
  return stats;
};
