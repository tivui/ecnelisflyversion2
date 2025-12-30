import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/list-sounds-for-map';
import type { Schema } from '../../data/resource';
import { CategoryKey } from '../../data/categories';

export const handler: Schema['listSoundsForMap']['functionHandler'] = async (
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

  const { userId: queryUserId, category, secondaryCategory } = event.arguments;

  // --- Identity info ---
  const identity = event.identity as any;
  const claims = identity?.claims ?? {};
  const groups: string[] = claims['cognito:groups'] ?? identity?.groups ?? [];
  const isAdmin = groups.includes('ADMIN');
  const currentUserCognitoSub = identity?.sub ?? null;

  console.log('Identity info:', { isAdmin, currentUserCognitoSub, groups });

  // --------------------------------------------------------------------
  // ✅ Récupérer l'ID de la table User correspondant au currentUser
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
  // 🧠 Définir ce que l'utilisateur peut voir
  // --------------------------------------------------------------------
  const fetchPublic = true; // Toujours visible
  const fetchAllPrivate = isAdmin; // Admin = tout voir
  const fetchPrivateForUser = !!currentUserTableId; // Normal user = seulement ses privés
  const allItems: any[] = [];

  // --- Pagination utilitaire ---
  const fetchAllPages = async <T extends keyof typeof client.models.Sound>(
    query: T,
    variables: Parameters<(typeof client.models.Sound)[T]>[0],
  ) => {
    let nextToken: string | null | undefined = undefined;
    do {
      try {
        console.log(
          `Fetching ${query} with variables:`,
          JSON.stringify({ ...variables, nextToken }),
        );
        const pageResult = await (client.models.Sound[query] as any)({
          ...variables,
          limit: 100,
          nextToken,
        });
        if (pageResult.errors?.length) {
          console.error(
            `Errors in ${query}:`,
            JSON.stringify(pageResult.errors, null, 2),
          );
          break;
        }
        const data = pageResult.data as typeof allItems;
        allItems.push(...(data ?? []));
        nextToken = pageResult.nextToken as string | null | undefined;
        console.log(
          `${query} fetched ${data?.length ?? 0} items, nextToken:`,
          nextToken,
        );
      } catch (err: any) {
        console.error(`Exception in ${query}:`, err);
        break;
      }
    } while (nextToken);
  };

  // --- Sélection de l’index selon les paramètres envoyés ---
  const fetchWithStatuses = async (
    query: keyof typeof client.models.Sound,
    base: any,
  ) => {
    if (fetchPublic)
      await fetchAllPages(query, { ...base, status: { eq: 'public' } });
    if (fetchAllPrivate)
      await fetchAllPages(query, { ...base, status: { eq: 'private' } });
  };

  // --------------------------------------------------------------------
  // 🔍 Logique principale
  // --------------------------------------------------------------------
  if (queryUserId) {
    console.log('Fetching by queryUserId');

    // PUBLIC always
    await fetchAllPages('listSoundsByUserAndStatus', {
      userId: queryUserId,
      status: { eq: 'public' },
    });

    // PRIVATE only if owner (currentUser) or admin
    if (
      fetchAllPrivate ||
      (fetchPrivateForUser &&
        currentUserTableId &&
        queryUserId === currentUserTableId)
    ) {
      await fetchAllPages('listSoundsByUserAndStatus', {
        userId: queryUserId,
        status: { eq: 'private' },
      });
    }
  } else if (secondaryCategory) {
    console.log('Fetching by secondaryCategory');
    await fetchWithStatuses('listSoundsBySecondaryCategoryAndStatus', {
      secondaryCategory,
    });
  } else if (category) {
    console.log('Fetching by category');
    await fetchWithStatuses('listSoundsByCategoryAndStatus', {
      category: category as CategoryKey,
    });
  } else {
    console.log('Fetching all sounds (public + my private)');

    // Tous les sons publics
    await fetchAllPages('listSoundsByStatus', { status: 'public' });

    // Privés de l'utilisateur courant
    if (fetchPrivateForUser && !isAdmin && currentUserTableId) {
      await fetchAllPages('listSoundsByUserAndStatus', {
        userId: currentUserTableId,
        status: { eq: 'private' },
      });
    }

    // Admin = tout voir
    if (fetchAllPrivate) {
      await fetchAllPages('listSoundsByStatus', { status: 'private' });
    }
  }

  console.log('Fetched before filtering:', allItems.length);

  // --------------------------------------------------------------------
  // 🧹 Filtre final de sécurité
  // --------------------------------------------------------------------
  const filtered = allItems.filter((sound) => {
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
