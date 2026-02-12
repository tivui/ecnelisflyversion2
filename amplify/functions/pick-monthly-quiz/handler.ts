import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/pick-monthly-quiz';
import type { Schema } from '../../data/resource';

const PREFIX = '[PICK-MONTHLY-QUIZ]';

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
    client.models.MonthlyQuiz as any
  ).getMonthlyQuizByMonth({ month });

  const activeEntries = (existingResult.data ?? []).filter(
    (m: any) => m.active,
  );

  if (activeEntries.length > 0) {
    console.log(
      `${PREFIX} Already have an active monthly quiz for ${month}, skipping.`,
    );
    return { status: 'already_picked', month, quizId: activeEntries[0].quizId };
  }

  // --- 3. List all published quizzes ---
  const publishedResult = await (
    client.models.Quiz as any
  ).listQuizzesByStatus({ status: 'published' });

  const publishedQuizzes = publishedResult.data ?? [];
  console.log(`${PREFIX} Published quizzes: ${publishedQuizzes.length}`);

  if (publishedQuizzes.length === 0) {
    console.log(`${PREFIX} No published quizzes, nothing to pick.`);
    return { status: 'no_quizzes', month };
  }

  // --- 4. Get all past MonthlyQuiz entries to know which quizzes have already been featured ---
  let allMonthlyQuizzes: any[] = [];
  let mqNextToken: string | null | undefined = undefined;

  do {
    const page: any = await client.models.MonthlyQuiz.list({
      limit: 100,
      nextToken: mqNextToken ?? undefined,
    });
    if (page.data) {
      allMonthlyQuizzes.push(...page.data);
    }
    mqNextToken = page.nextToken;
  } while (mqNextToken);

  const alreadyFeaturedQuizIds = new Set(
    allMonthlyQuizzes.map((mq: any) => mq.quizId),
  );
  console.log(`${PREFIX} Already featured quiz IDs: ${alreadyFeaturedQuizIds.size}`);

  // --- 5. Filter to quizzes never featured, sorted by most recently created ---
  let eligible = publishedQuizzes
    .filter((q: any) => !alreadyFeaturedQuizIds.has(q.id))
    .sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  // If all quizzes have been featured, reset: use all published, most recent first
  if (eligible.length === 0) {
    console.log(`${PREFIX} All quizzes already featured, resetting cycle.`);
    eligible = [...publishedQuizzes].sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  // --- 6. Pick the most recently created quiz that hasn't been featured ---
  const picked = eligible[0];

  console.log(
    `${PREFIX} Picked quiz: ${picked.id} (${picked.title}, ${picked.questionCount} questions)`,
  );

  // --- 7. Deactivate any leftover active entries for this month ---
  for (const entry of activeEntries) {
    await client.models.MonthlyQuiz.update({
      id: entry.id,
      active: false,
    } as any);
  }

  // --- 8. Create new MonthlyQuiz entry ---
  const createResult = await client.models.MonthlyQuiz.create({
    id: crypto.randomUUID(),
    quizId: picked.id,
    month,
    active: true,
  } as any);

  if (createResult.errors) {
    console.error(
      `${PREFIX} Error creating MonthlyQuiz:`,
      createResult.errors,
    );
    return { status: 'error', month, errors: createResult.errors };
  }

  console.log(
    `${PREFIX} Successfully set monthly quiz: ${createResult.data?.id}`,
  );

  return {
    status: 'success',
    month,
    quizId: picked.id,
    quizTitle: picked.title,
  };
};
