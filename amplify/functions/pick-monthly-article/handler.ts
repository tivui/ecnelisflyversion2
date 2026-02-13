import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/pick-monthly-article';
import type { Schema } from '../../data/resource';

const PREFIX = '[PICK-MONTHLY-ARTICLE]';

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
    client.models.MonthlyArticle as any
  ).getMonthlyArticleByMonth({ month });

  const activeEntries = (existingResult.data ?? []).filter(
    (m: any) => m.active,
  );

  if (activeEntries.length > 0) {
    console.log(
      `${PREFIX} Already have an active monthly article for ${month}, skipping.`,
    );
    return { status: 'already_picked', month, articleId: activeEntries[0].articleId };
  }

  // --- 3. List all published articles ---
  const publishedResult = await (
    client.models.SoundArticle as any
  ).listArticlesByStatus({ status: 'published' });

  const publishedArticles = publishedResult.data ?? [];
  console.log(`${PREFIX} Published articles: ${publishedArticles.length}`);

  if (publishedArticles.length === 0) {
    console.log(`${PREFIX} No published articles, nothing to pick.`);
    return { status: 'no_articles', month };
  }

  // --- 4. If only 1 published article, use it unconditionally ---
  if (publishedArticles.length === 1) {
    const picked = publishedArticles[0];
    console.log(`${PREFIX} Only 1 published article, using: ${picked.id}`);
    return await createMonthlyArticle(client, month, picked, activeEntries);
  }

  // --- 5. Get ALL past MonthlyArticle entries to know which have been featured ---
  let allMonthlyArticles: any[] = [];
  let maNextToken: string | null | undefined = undefined;

  do {
    const page: any = await client.models.MonthlyArticle.list({
      limit: 100,
      nextToken: maNextToken ?? undefined,
    });
    if (page.data) {
      allMonthlyArticles.push(...page.data);
    }
    maNextToken = page.nextToken;
  } while (maNextToken);

  const alreadyFeaturedArticleIds = new Set(
    allMonthlyArticles.map((ma: any) => ma.articleId),
  );
  console.log(`${PREFIX} Already featured article IDs: ${alreadyFeaturedArticleIds.size}`);

  // --- 6. Find last month's featured articleId ---
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const lastMonthResult = await (
    client.models.MonthlyArticle as any
  ).getMonthlyArticleByMonth({ month: lastMonth });

  const lastMonthActives = (lastMonthResult.data ?? []).filter(
    (m: any) => m.active,
  );
  const lastMonthArticleId = lastMonthActives.length > 0
    ? lastMonthActives[0].articleId
    : null;

  console.log(`${PREFIX} Last month (${lastMonth}) article: ${lastMonthArticleId ?? 'none'}`);

  // --- 7. Filter to never-featured articles, sorted by createdAt ASC (oldest first) ---
  let eligible = publishedArticles
    .filter((a: any) => !alreadyFeaturedArticleIds.has(a.id))
    .sort((a: any, b: any) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  // --- 8. If all have been featured, reset cycle ---
  if (eligible.length === 0) {
    console.log(`${PREFIX} All articles already featured, resetting cycle.`);
    eligible = [...publishedArticles].sort((a: any, b: any) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  // --- 9. Exclude last month's article (if more than 1 eligible) ---
  if (lastMonthArticleId && eligible.length > 1) {
    eligible = eligible.filter((a: any) => a.id !== lastMonthArticleId);
  }

  // --- 10. Pick the first eligible (oldest never-featured) ---
  const picked = eligible[0];
  console.log(
    `${PREFIX} Picked article: ${picked.id} (${picked.title})`,
  );

  return await createMonthlyArticle(client, month, picked, activeEntries);
};

async function createMonthlyArticle(
  client: any,
  month: string,
  picked: any,
  activeEntries: any[],
) {
  // --- Deactivate any leftover active entries for this month ---
  for (const entry of activeEntries) {
    await client.models.MonthlyArticle.update({
      id: entry.id,
      active: false,
    } as any);
  }

  // --- Create new MonthlyArticle entry with denormalized data ---
  const createResult = await client.models.MonthlyArticle.create({
    id: crypto.randomUUID(),
    articleId: picked.id,
    month,
    active: true,
    articleTitle: picked.title ?? undefined,
    articleTitle_i18n: picked.title_i18n ?? undefined,
    articleSlug: picked.slug ?? undefined,
    articleCoverImageKey: picked.coverImageKey ?? undefined,
    articleAuthorName: picked.authorName ?? undefined,
    articleDescription: picked.description ?? undefined,
    articleDescription_i18n: picked.description_i18n ?? undefined,
  } as any);

  if (createResult.errors) {
    console.error(
      `${PREFIX} Error creating MonthlyArticle:`,
      createResult.errors,
    );
    return { status: 'error', month, errors: createResult.errors };
  }

  console.log(
    `${PREFIX} Successfully set monthly article: ${createResult.data?.id}`,
  );

  return {
    status: 'success',
    month,
    articleId: picked.id,
    articleTitle: picked.title,
  };
}
