import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler = async () => {
  const userPoolId = process.env['USER_POOL_ID'];
  if (!userPoolId) throw new Error('USER_POOL_ID not set');

  const allUsers: Array<{ createdAt: Date; provider: string; email: string; name: string }> = [];
  let paginationToken: string | undefined;

  // Paginate through all Cognito users
  do {
    const response = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        PaginationToken: paginationToken,
        Limit: 60,
      }),
    );

    for (const user of response.Users ?? []) {
      const attrs = user.Attributes ?? [];
      const getAttr = (name: string) => attrs.find((a) => a.Name === name)?.Value ?? '';

      const identitiesAttr = getAttr('identities');

      let provider = 'EMAIL';
      if (identitiesAttr) {
        try {
          const identities = JSON.parse(identitiesAttr);
          if (Array.isArray(identities) && identities.length > 0) {
            provider = identities[0].providerName ?? 'UNKNOWN';
          }
        } catch {
          // malformed attribute — default to EMAIL
        }
      }

      const email = getAttr('email');
      const name = getAttr('name') || getAttr('preferred_username') || user.Username || '';

      allUsers.push({
        createdAt: user.UserCreateDate ?? new Date(0),
        provider,
        email,
        name,
      });
    }

    paginationToken = response.PaginationToken;
  } while (paginationToken);

  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Build time series: registrations per month for the last 12 months
  const months: { label: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    const count = allUsers.filter(
      (u) => u.createdAt >= start && u.createdAt <= end,
    ).length;
    months.push({ label, count });
  }

  // Build user details list (sorted by most recent first)
  const userDetails = allUsers
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((u) => ({
      name: u.name,
      email: u.email,
      provider: u.provider,
      createdAt: u.createdAt.toISOString(),
    }));

  return {
    totalUsers: allUsers.length,
    newThisWeek: allUsers.filter((u) => u.createdAt >= weekStart).length,
    newThisMonth: allUsers.filter((u) => u.createdAt >= monthStart).length,
    emailCount: allUsers.filter((u) => u.provider === 'EMAIL').length,
    oauthCount: allUsers.filter((u) => u.provider !== 'EMAIL').length,
    timeSeriesJson: JSON.stringify(months),
    usersJson: JSON.stringify(userDetails),
  };
};
