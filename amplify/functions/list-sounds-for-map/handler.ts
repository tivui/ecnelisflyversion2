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
  console.log('Lambda invoked with arguments:', JSON.stringify(event.arguments));

  // --- Configure Amplify Data Client ---
  const { resourceConfig, libraryOptions } =
    await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);

  const client = generateClient<Schema>();
  const { userId, category, secondaryCategory } = event.arguments;

  // --- Identity info ---
  const identity = context.identity as any;
  const claims = identity?.claims ?? {};
  const groups: string[] = claims['cognito:groups'] || [];
  const isAdmin = groups.includes('ADMIN');
  const currentUserId = identity?.sub ?? null;

  console.log('Identity info:', { isAdmin, currentUserId, groups });

  // --- Determine which status values to fetch ---
  const statuses: ('public' | 'private')[] = isAdmin || currentUserId
    ? ['public', 'private']
    : ['public'];

  const allItems: any[] = [];

  // Helper pour paginer avec try/catch pour logging
  const fetchAllPages = async <
    T extends keyof typeof client.models.Sound
  >(
    query: T,
    variables: Parameters<(typeof client.models.Sound)[T]>[0],
  ) => {
    let nextToken: string | null | undefined = undefined;
    do {
      try {
        console.log(`Fetching ${query} with variables:`, JSON.stringify({ ...variables, nextToken }));

        const pageResult = await (client.models.Sound[query] as any)({
          ...variables,
          limit: 100,
          nextToken,
        });

        if (pageResult.errors?.length) {
          console.error(`Errors in ${query}:`, JSON.stringify(pageResult.errors, null, 2));
          // Ne pas throw pour continuer le reste
          break;
        }

        const data = pageResult.data as typeof allItems;
        allItems.push(...(data ?? []));
        nextToken = pageResult.nextToken as string | null | undefined;

        console.log(`${query} fetched ${data?.length ?? 0} items, nextToken:`, nextToken);

      } catch (err: any) {
        console.error(`Exception in ${query} with variables ${JSON.stringify(variables)}:`, err);
        // On continue malgré l'erreur
        break;
      }
    } while (nextToken);
  };

  // --- Choose correct index based on filters ---
  if (userId) {
    console.log('Fetching by userId');
    for (const status of statuses) {
      await fetchAllPages('listSoundsByUserAndStatus', { userId, status: { eq: status } });
    }

  } else if (secondaryCategory && !userId) {
    console.log('Fetching by secondaryCategory');
    for (const status of statuses) {
      await fetchAllPages('listSoundsBySecondaryCategoryAndStatus', {
        secondaryCategory,
        status: { eq: status },
      });
    }

  } else if (category && !userId) {
    console.log('Fetching by category');
    for (const status of statuses) {
      await fetchAllPages('listSoundsByCategoryAndStatus', {
        category: category as CategoryKey,
        status: { eq: status },
      });
    }

  } else {
    console.log('Fetching all by status only');
    for (const status of statuses) {
      await fetchAllPages('listSoundsByStatus', { status });
    }
  }

  console.log('Total sounds fetched:', allItems.length);

  // --- Ensure proper GraphQL shape for AppSync resolvers ---
  return allItems.map((sound) => ({
    ...sound,
    __typename: 'Sound',
    userId: sound.userId,
  }));
};
