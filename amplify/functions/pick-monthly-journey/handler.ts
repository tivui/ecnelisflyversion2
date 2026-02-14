import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/pick-monthly-journey';
import type { Schema } from '../../data/resource';

const PREFIX = '[PICK-MONTHLY-JOURNEY]';

export const handler = async () => {
  console.log(`${PREFIX} Lambda invoked`);

  // --- Configure Amplify Data Client ---
  const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  const client = generateClient<Schema>();

  // --- 1. Get current month (UTC) ---
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  console.log(`${PREFIX} Current month: ${month}`);

  // --- 2. Check if already picked for this month ---
  const existingResult = await (
    client.models.MonthlyJourney as any
  ).getMonthlyJourneyByMonth({ month });

  const activeEntries = (existingResult.data ?? []).filter(
    (m: any) => m.active,
  );

  if (activeEntries.length > 0) {
    console.log(
      `${PREFIX} Already have an active monthly journey for ${month}, skipping.`,
    );
    return { status: 'already_picked', month, journeyId: activeEntries[0].journeyId };
  }

  // --- 3. List all public journeys ---
  const journeysResult = await client.models.SoundJourney.list();
  const publicJourneys = (journeysResult.data ?? []).filter(
    (j: any) => j.isPublic,
  );
  console.log(`${PREFIX} Public journeys: ${publicJourneys.length}`);

  if (publicJourneys.length === 0) {
    console.log(`${PREFIX} No public journeys, nothing to pick.`);
    return { status: 'no_journeys', month };
  }

  // --- 4. If only 1 public journey, use it unconditionally ---
  if (publicJourneys.length === 1) {
    const picked = publicJourneys[0];
    console.log(`${PREFIX} Only 1 public journey, using: ${picked.id}`);
    return await createMonthlyJourney(client, month, picked, activeEntries);
  }

  // --- 5. Get ALL past MonthlyJourney entries to know which have been featured ---
  let allMonthlyJourneys: any[] = [];
  let mjNextToken: string | null | undefined = undefined;

  do {
    const page: any = await client.models.MonthlyJourney.list({
      limit: 100,
      nextToken: mjNextToken ?? undefined,
    });
    if (page.data) {
      allMonthlyJourneys.push(...page.data);
    }
    mjNextToken = page.nextToken;
  } while (mjNextToken);

  const alreadyFeaturedJourneyIds = new Set(
    allMonthlyJourneys.map((mj: any) => mj.journeyId),
  );
  console.log(`${PREFIX} Already featured journey IDs: ${alreadyFeaturedJourneyIds.size}`);

  // --- 6. Find last month's featured journeyId ---
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const lastMonthResult = await (
    client.models.MonthlyJourney as any
  ).getMonthlyJourneyByMonth({ month: lastMonth });

  const lastMonthActives = (lastMonthResult.data ?? []).filter(
    (m: any) => m.active,
  );
  const lastMonthJourneyId = lastMonthActives.length > 0
    ? lastMonthActives[0].journeyId
    : null;

  console.log(`${PREFIX} Last month (${lastMonth}) journey: ${lastMonthJourneyId ?? 'none'}`);

  // --- 7. Filter to never-featured journeys, sorted by sortOrder ASC ---
  let eligible = publicJourneys
    .filter((j: any) => !alreadyFeaturedJourneyIds.has(j.id))
    .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // --- 8. If all have been featured, reset cycle ---
  if (eligible.length === 0) {
    console.log(`${PREFIX} All journeys already featured, resetting cycle.`);
    eligible = [...publicJourneys].sort(
      (a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
  }

  // --- 9. Exclude last month's journey (if more than 1 eligible) ---
  if (lastMonthJourneyId && eligible.length > 1) {
    eligible = eligible.filter((j: any) => j.id !== lastMonthJourneyId);
  }

  // --- 10. Pick the first eligible ---
  const picked = eligible[0];
  console.log(
    `${PREFIX} Picked journey: ${picked.id} (${picked.name})`,
  );

  return await createMonthlyJourney(client, month, picked, activeEntries);
};

async function createMonthlyJourney(
  client: any,
  month: string,
  picked: any,
  activeEntries: any[],
) {
  // --- Deactivate any leftover active entries for this month ---
  for (const entry of activeEntries) {
    await client.models.MonthlyJourney.update({
      id: entry.id,
      active: false,
    } as any);
  }

  // --- Create new MonthlyJourney entry with denormalized data ---
  const createResult = await client.models.MonthlyJourney.create({
    id: crypto.randomUUID(),
    journeyId: picked.id,
    month,
    active: true,
    journeyName: picked.name ?? undefined,
    journeyName_i18n: picked.name_i18n ?? undefined,
    journeyDescription: picked.description ?? undefined,
    journeyDescription_i18n: picked.description_i18n ?? undefined,
    journeySlug: picked.slug ?? undefined,
    journeyColor: picked.color ?? undefined,
    journeyCoverImage: picked.coverImage ?? undefined,
  } as any);

  if (createResult.errors) {
    console.error(
      `${PREFIX} Error creating MonthlyJourney:`,
      createResult.errors,
    );
    return { status: 'error', month, errors: createResult.errors };
  }

  console.log(
    `${PREFIX} Successfully set monthly journey: ${createResult.data?.id}`,
  );

  return {
    status: 'success',
    month,
    journeyId: picked.id,
    journeyName: picked.name,
  };
}
