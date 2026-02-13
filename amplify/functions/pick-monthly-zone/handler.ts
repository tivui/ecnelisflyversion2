import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/pick-monthly-zone';
import type { Schema } from '../../data/resource';

const PREFIX = '[PICK-MONTHLY-ZONE]';

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
    client.models.MonthlyZone as any
  ).getMonthlyZoneByMonth({ month });

  const activeEntries = (existingResult.data ?? []).filter(
    (m: any) => m.active,
  );

  if (activeEntries.length > 0) {
    console.log(
      `${PREFIX} Already have an active monthly zone for ${month}, skipping.`,
    );
    return { status: 'already_picked', month, zoneId: activeEntries[0].zoneId };
  }

  // --- 3. List all public zones ---
  const zonesResult = await client.models.Zone.list();
  const publicZones = (zonesResult.data ?? []).filter(
    (z: any) => z.isPublic,
  );
  console.log(`${PREFIX} Public zones: ${publicZones.length}`);

  if (publicZones.length === 0) {
    console.log(`${PREFIX} No public zones, nothing to pick.`);
    return { status: 'no_zones', month };
  }

  // --- 4. If only 1 public zone, use it unconditionally ---
  if (publicZones.length === 1) {
    const picked = publicZones[0];
    console.log(`${PREFIX} Only 1 public zone, using: ${picked.id}`);
    return await createMonthlyZone(client, month, picked, activeEntries);
  }

  // --- 5. Get ALL past MonthlyZone entries to know which have been featured ---
  let allMonthlyZones: any[] = [];
  let mzNextToken: string | null | undefined = undefined;

  do {
    const page: any = await client.models.MonthlyZone.list({
      limit: 100,
      nextToken: mzNextToken ?? undefined,
    });
    if (page.data) {
      allMonthlyZones.push(...page.data);
    }
    mzNextToken = page.nextToken;
  } while (mzNextToken);

  const alreadyFeaturedZoneIds = new Set(
    allMonthlyZones.map((mz: any) => mz.zoneId),
  );
  console.log(`${PREFIX} Already featured zone IDs: ${alreadyFeaturedZoneIds.size}`);

  // --- 6. Find last month's featured zoneId ---
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const lastMonthResult = await (
    client.models.MonthlyZone as any
  ).getMonthlyZoneByMonth({ month: lastMonth });

  const lastMonthActives = (lastMonthResult.data ?? []).filter(
    (m: any) => m.active,
  );
  const lastMonthZoneId = lastMonthActives.length > 0
    ? lastMonthActives[0].zoneId
    : null;

  console.log(`${PREFIX} Last month (${lastMonth}) zone: ${lastMonthZoneId ?? 'none'}`);

  // --- 7. Filter to never-featured zones, sorted by sortOrder ASC ---
  let eligible = publicZones
    .filter((z: any) => !alreadyFeaturedZoneIds.has(z.id))
    .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // --- 8. If all have been featured, reset cycle ---
  if (eligible.length === 0) {
    console.log(`${PREFIX} All zones already featured, resetting cycle.`);
    eligible = [...publicZones].sort(
      (a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
  }

  // --- 9. Exclude last month's zone (if more than 1 eligible) ---
  if (lastMonthZoneId && eligible.length > 1) {
    eligible = eligible.filter((z: any) => z.id !== lastMonthZoneId);
  }

  // --- 10. Pick the first eligible ---
  const picked = eligible[0];
  console.log(
    `${PREFIX} Picked zone: ${picked.id} (${picked.name})`,
  );

  return await createMonthlyZone(client, month, picked, activeEntries);
};

async function createMonthlyZone(
  client: any,
  month: string,
  picked: any,
  activeEntries: any[],
) {
  // --- Deactivate any leftover active entries for this month ---
  for (const entry of activeEntries) {
    await client.models.MonthlyZone.update({
      id: entry.id,
      active: false,
    } as any);
  }

  // --- Create new MonthlyZone entry with denormalized data ---
  const createResult = await client.models.MonthlyZone.create({
    id: crypto.randomUUID(),
    zoneId: picked.id,
    month,
    active: true,
    zoneName: picked.name ?? undefined,
    zoneName_i18n: picked.name_i18n ?? undefined,
    zoneDescription: picked.description ?? undefined,
    zoneDescription_i18n: picked.description_i18n ?? undefined,
    zoneSlug: picked.slug ?? undefined,
    zoneCoverImage: picked.coverImage ?? undefined,
    zoneIcon: picked.icon ?? undefined,
    zoneColor: picked.color ?? undefined,
  } as any);

  if (createResult.errors) {
    console.error(
      `${PREFIX} Error creating MonthlyZone:`,
      createResult.errors,
    );
    return { status: 'error', month, errors: createResult.errors };
  }

  console.log(
    `${PREFIX} Successfully set monthly zone: ${createResult.data?.id}`,
  );

  return {
    status: 'success',
    month,
    zoneId: picked.id,
    zoneName: picked.name,
  };
}
