import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/import-sounds';
import type { Schema } from '../../data/resource';
import { CategoryKey } from '../../data/categories';

export const handler: Schema['importSounds']['functionHandler'] = async (
  event,
) => {
  // Configure Amplify with proper credentials and endpoint
  const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);

  const client = generateClient<Schema>();
  const { fileContent } = event.arguments;
  const content =
    typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;

  if (!content.sounds || !Array.isArray(content.sounds)) {
    return {
      imported: 0,
      skipped: 0,
      invalidCategory: 0,
      invalidDates: 0,
      emptyHashtags: 0,
    };
  }

  // Stats counters
  const stats = {
    imported: 0,
    skipped: 0,
    invalidCategory: 0,
    invalidDates: 0,
    emptyHashtags: 0,
  };

  for (const sound of content.sounds) {
    // Find user by email
    const users = await client.models.User.list({
      filter: { email: { eq: sound.email } },
    });
    if (!users.data.length) {
      console.warn(`[IMPORT] No user found for email: ${sound.email}`);
      stats.skipped++;
      continue;
    }
    const user = users.data[0];

    // Parse date fields
    let dateTime: string | undefined;
    if (sound.date_min) {
      const parsed = new Date(sound.date_min);
      if (isNaN(parsed.getTime())) {
        console.warn(
          `[IMPORT] Invalid date_min for sound "${sound.title}": ${sound.date_min}`,
        );
        stats.invalidDates++;
      } else {
        dateTime = parsed.toISOString();
      }
    }

    let recordDateTime: string | undefined;
    if (sound.record_date_min) {
      const parsed = new Date(sound.record_date_min);
      if (isNaN(parsed.getTime())) {
        console.warn(
          `[IMPORT] Invalid record_date_min for sound "${sound.title}": ${sound.record_date_min}`,
        );
        stats.invalidDates++;
      } else {
        recordDateTime = parsed.toISOString().split('T')[0];
      }
    }

    // Validate category against CategoryKey enum
    let category: CategoryKey | undefined;
    if (
      sound.category &&
      Object.values(CategoryKey).includes(sound.category as CategoryKey)
    ) {
      category = sound.category as CategoryKey;
    } else if (sound.category) {
      console.warn(
        `[IMPORT] Invalid category for sound "${sound.title}": ${sound.category}`,
      );
      stats.invalidCategory++;
    }

    // Normalize hashtags
    const hashtags = sound.hashtags
      ? sound.hashtags.split(/\s+/).filter(Boolean).join(',')
      : undefined;

    if (!hashtags) {
      console.warn(`[IMPORT] Empty hashtags for sound "${sound.title}"`);
      stats.emptyHashtags++;
    }

    const shortHashtags = sound.hashtags_min
      ? sound.hashtags_min.split(/\s+/).filter(Boolean).join(',')
      : undefined;

    // Create new Sound record with try/catch
    try {
      const result = await client.models.Sound.create({
        userId: user.id,
        title: sound.title,
        title_i18n: sound.title_i18n ? JSON.stringify(sound.title_i18n) : '{}',
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
      });

      if (result.errors && result.errors.length > 0) {
        console.error(
          `[IMPORT] Failed to create sound "${sound.title}" for user ${user.email}:`,
          JSON.stringify(result.errors, null, 2),
        );
        stats.skipped++;
      } else {
        console.info(
          `[IMPORT] Successfully created sound "${sound.title}" for user ${user.email} (id=${result.data?.id})`,
        );
        stats.imported++;
      }
    } catch (err) {
      console.error(
        `[IMPORT] Exception while creating sound "${sound.title}" for user ${user.email}:`,
        err,
      );
      stats.skipped++;
    }
  }

  console.log('Import stats:', stats);
  return stats;
};
