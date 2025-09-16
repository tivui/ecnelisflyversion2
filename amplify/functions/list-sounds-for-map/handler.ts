import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/list-sounds-for-map';
import type { Schema } from '../../data/resource';
import { CategoryKey } from '../../data/categories';

export const handler: Schema['listSoundsForMap']['functionHandler'] = async (
  event,
  context,
) => {
  // --- Configure Amplify Data Client ---
  const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);

  const client = generateClient<Schema>();
  const { userId, category } = event.arguments;

  // --- Identity info ---
  const identity = context.identity as any;
  const claims = identity?.claims ?? {};
  const groups: string[] = claims['cognito:groups'] || [];
  const isAdmin = groups.includes('ADMIN');
  const currentUserId = identity?.sub ?? null;

  // --- Determine which status values to fetch ---
  let statuses: ('public' | 'private')[] = ['public'];
  if (isAdmin || currentUserId) {
    statuses = ['public', 'private'];
  }

  const allItems: any[] = [];

  // Helper pour paginer
  const fetchAllPages = async <
    T extends keyof typeof client.models.Sound
  >(
    query: T,
    variables: Parameters<(typeof client.models.Sound)[T]>[0],
  ) => {
    let nextToken: string | null | undefined = undefined;
    do {
      const pageResult = await (client.models.Sound[query] as any)({
        ...variables,
        limit: 100,
        nextToken,
      });

      const data = pageResult.data as typeof allItems;
      const errors = pageResult.errors as any[] | undefined;
      const newToken = pageResult.nextToken as string | null | undefined;

      if (errors?.length) {
        console.error(
          `listSoundsForMap errors in ${query}:`,
          JSON.stringify(errors, null, 2),
        );
        throw new Error('Failed to fetch sounds');
      }

      allItems.push(...(data ?? []));
      nextToken = newToken;
    } while (nextToken);
  };

  // --- Use secondary index queries correctly ---
  if (userId && !category) {
    for (const status of statuses) {
      await fetchAllPages('listSoundsByUserAndStatus', {
        userId,
        status: { eq: status },
      });
    }
  } else if (category && !userId) {
    for (const status of statuses) {
      await fetchAllPages('listSoundsByCategoryAndStatus', {
        category: category as CategoryKey,
        status: { eq: status },
      });
    }
  } else {
    for (const status of statuses) {
      await fetchAllPages('listSoundsByStatus', {
        status
      });
    }
  }

  // --- Ensure proper GraphQL shape for AppSync resolvers ---
  return allItems.map((sound) => ({
    ...sound,
    __typename: 'Sound',
    userId: sound.userId, // must be explicit for relation to resolve
  }));
};
