import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/list-sounds-by-zone';
import type { Schema } from '../../data/resource';

export const handler: Schema['listSoundsByZone']['functionHandler'] = async (
  event,
) => {
  console.log(
    'Lambda invoked with arguments:',
    JSON.stringify(event.arguments),
  );

  // --- Configure Amplify Data Client ---
  const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);
  const client = generateClient<Schema>();

  const { zoneId } = event.arguments;

  // --- Identity info ---
  const identity = event.identity as any;
  const claims = identity?.claims ?? {};
  const groups: string[] = claims['cognito:groups'] ?? identity?.groups ?? [];
  const isAdmin = groups.includes('ADMIN');
  const currentUserCognitoSub = identity?.sub ?? null;

  console.log('Identity info:', { isAdmin, currentUserCognitoSub, groups });

  // --------------------------------------------------------------------
  // Get current user's table ID
  // --------------------------------------------------------------------
  let currentUserTableId: string | null = null;
  if (currentUserCognitoSub) {
    const result = await client.models.User.getUserByCognitoSub({
      cognitoSub: currentUserCognitoSub,
    });

    if (result.data.length > 0) {
      currentUserTableId = result.data[0].id;
    }
  }

  console.log('currentUserTableId:', currentUserTableId);

  // --------------------------------------------------------------------
  // Fetch all ZoneSound entries for the given zone
  // --------------------------------------------------------------------
  const zoneSounds: any[] = [];
  let nextToken: string | null | undefined = undefined;

  do {
    try {
      console.log('Fetching ZoneSounds for zone:', zoneId);
      const pageResult = await (client.models.ZoneSound.listZoneSoundsByZone as any)({
        zoneId,
        limit: 100,
        nextToken,
      });

      if (pageResult.errors?.length) {
        console.error(
          'Errors fetching ZoneSounds:',
          JSON.stringify(pageResult.errors, null, 2),
        );
        break;
      }

      const data = pageResult.data as typeof zoneSounds;
      zoneSounds.push(...(data ?? []));
      nextToken = pageResult.nextToken as string | null | undefined;
      console.log(
        `Fetched ${data?.length ?? 0} ZoneSound items, nextToken:`,
        nextToken,
      );
    } catch (err: any) {
      console.error('Exception fetching ZoneSounds:', err);
      break;
    }
  } while (nextToken);

  console.log('Total ZoneSounds found:', zoneSounds.length);

  if (zoneSounds.length === 0) {
    return [];
  }

  // --------------------------------------------------------------------
  // Fetch all sounds by their IDs
  // --------------------------------------------------------------------
  const soundIds = zoneSounds.map((zs) => zs.soundId);
  const sounds: any[] = [];

  for (const soundId of soundIds) {
    try {
      const soundResult = await client.models.Sound.get({ id: soundId });
      if (soundResult.data) {
        sounds.push(soundResult.data);
      }
    } catch (err: any) {
      console.error(`Error fetching sound ${soundId}:`, err);
    }
  }

  console.log('Fetched sounds before filtering:', sounds.length);

  // --------------------------------------------------------------------
  // Security filter - same logic as listSoundsForMap
  // --------------------------------------------------------------------
  const fetchAllPrivate = isAdmin;
  const fetchPrivateForUser = !!currentUserTableId;

  const filtered = sounds.filter((sound) => {
    if (sound.status === 'public') return true;
    if (fetchAllPrivate) return true;
    if (fetchPrivateForUser && sound.userId === currentUserTableId) return true;
    return false;
  });

  console.log('Returned sounds after filtering:', filtered.length);

  // --------------------------------------------------------------------
  // Return in GraphQL shape
  // --------------------------------------------------------------------
  return filtered.map((sound) => ({
    ...sound,
    __typename: 'Sound',
    userId: sound.userId,
  }));
};
