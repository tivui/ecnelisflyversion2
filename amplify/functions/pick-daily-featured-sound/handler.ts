import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/pick-daily-featured-sound';
import type { Schema } from '../../data/resource';

const PREFIX = '[PICK-DAILY-FEATURED]';

export const handler = async () => {
  console.log(`${PREFIX} Lambda invoked`);

  // --- Configure Amplify Data Client ---
  const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  const client = generateClient<Schema>();

  // --- 1. Get today's date (UTC) ---
  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  console.log(`${PREFIX} Today: ${today}`);

  // --- 2. Check if already picked for today ---
  const existingResult =
    await client.models.DailyFeaturedSound.getDailyFeaturedByDate({
      date: today,
    });

  if (existingResult.data && existingResult.data.length > 0) {
    console.log(`${PREFIX} Already picked for today, skipping.`);
    return { status: 'already_picked', date: today };
  }

  // --- 3. List all active candidates ---
  let allCandidates: any[] = [];
  let nextToken: string | null | undefined = undefined;

  do {
    const page: any = await client.models.FeaturedSoundCandidate.list({
      filter: { isActive: { eq: true } },
      limit: 100,
      nextToken: nextToken ?? undefined,
    });
    if (page.data) {
      allCandidates.push(...page.data);
    }
    nextToken = page.nextToken;
  } while (nextToken);

  console.log(`${PREFIX} Active candidates: ${allCandidates.length}`);

  if (allCandidates.length === 0) {
    console.log(`${PREFIX} No active candidates, nothing to pick.`);
    return { status: 'no_candidates', date: today };
  }

  // --- 4. Get yesterday's pick to avoid repetition ---
  const yesterday = new Date(Date.now() - 86400000)
    .toISOString()
    .split('T')[0];
  const yesterdayResult =
    await client.models.DailyFeaturedSound.getDailyFeaturedByDate({
      date: yesterday,
    });

  const yesterdayCandidateId =
    yesterdayResult.data?.[0]?.featuredCandidateId ?? null;

  // --- 5. Filter out yesterday's pick (if more than 1 candidate) ---
  let eligibleCandidates = allCandidates;
  if (yesterdayCandidateId && allCandidates.length > 1) {
    eligibleCandidates = allCandidates.filter(
      (c) => c.id !== yesterdayCandidateId,
    );
  }

  // --- 6. Random pick ---
  const randomIndex = Math.floor(Math.random() * eligibleCandidates.length);
  const picked = eligibleCandidates[randomIndex];
  console.log(`${PREFIX} Picked candidate: ${picked.id}`);

  // --- 7. Fetch the full Sound record ---
  const soundResult = await client.models.Sound.get({ id: picked.soundId });
  const sound = soundResult.data;

  if (!sound) {
    console.error(
      `${PREFIX} Sound not found for id: ${picked.soundId}, skipping.`,
    );
    return { status: 'sound_not_found', date: today };
  }

  // --- 8. Create DailyFeaturedSound with denormalized data ---
  const dailyResult = await client.models.DailyFeaturedSound.create({
    date: today,
    featuredCandidateId: picked.id,
    soundId: picked.soundId,
    teasing: picked.teasing,
    teasing_i18n: picked.teasing_i18n ?? undefined,
    soundTitle: sound.title,
    soundCity: sound.city ?? undefined,
    soundLatitude: sound.latitude ?? undefined,
    soundLongitude: sound.longitude ?? undefined,
    soundCategory: sound.category ?? undefined,
    soundSecondaryCategory: sound.secondaryCategory ?? undefined,
    soundFilename: sound.filename,
  });

  if (dailyResult.errors) {
    console.error(
      `${PREFIX} Error creating DailyFeaturedSound:`,
      dailyResult.errors,
    );
    return { status: 'error', date: today, errors: dailyResult.errors };
  }

  console.log(
    `${PREFIX} Successfully created DailyFeaturedSound: ${dailyResult.data?.id}`,
  );
  return {
    status: 'success',
    date: today,
    soundTitle: sound.title,
    candidateId: picked.id,
  };
};
