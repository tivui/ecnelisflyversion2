import {
  CognitoIdentityProviderClient,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminDeleteUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});

type Action =
  | 'listUserStatuses'
  | 'disableUser'
  | 'enableUser'
  | 'deleteUser'
  | 'addToGroup'
  | 'removeFromGroup';

interface ManageUserEvent {
  arguments: {
    action: Action;
    username?: string;
    groupName?: string;
  };
}

export const handler = async (event: ManageUserEvent) => {
  const userPoolId = process.env['USER_POOL_ID'];
  if (!userPoolId) throw new Error('USER_POOL_ID not set');

  const { action, username, groupName } = event.arguments;

  switch (action) {
    case 'disableUser':
      await client.send(
        new AdminDisableUserCommand({ UserPoolId: userPoolId, Username: username! }),
      );
      return { success: true };

    case 'enableUser':
      await client.send(
        new AdminEnableUserCommand({ UserPoolId: userPoolId, Username: username! }),
      );
      return { success: true };

    case 'deleteUser':
      await client.send(
        new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username! }),
      );
      return { success: true };

    case 'addToGroup':
      await client.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: username!,
          GroupName: groupName!,
        }),
      );
      return { success: true };

    case 'removeFromGroup':
      await client.send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: userPoolId,
          Username: username!,
          GroupName: groupName!,
        }),
      );
      return { success: true };

    case 'listUserStatuses': {
      const allUsers: Array<{
        sub: string;
        email: string;
        username: string;
        enabled: boolean;
        status: string;
        createdAt: string;
        provider: string;
      }> = [];
      let paginationToken: string | undefined;

      do {
        const response = await client.send(
          new ListUsersCommand({
            UserPoolId: userPoolId,
            PaginationToken: paginationToken,
            Limit: 60,
          }),
        );

        for (const user of response.Users ?? []) {
          const sub = user.Attributes?.find((a) => a.Name === 'sub')?.Value ?? '';
          const email = user.Attributes?.find((a) => a.Name === 'email')?.Value ?? '';
          const identitiesAttr = user.Attributes?.find(
            (a) => a.Name === 'identities',
          )?.Value;

          let provider = 'EMAIL';
          if (identitiesAttr) {
            try {
              const ids = JSON.parse(identitiesAttr);
              if (Array.isArray(ids) && ids.length > 0) {
                provider = ids[0].providerName ?? 'UNKNOWN';
              }
            } catch {
              // malformed — default EMAIL
            }
          }

          allUsers.push({
            sub,
            email,
            username: user.Username ?? '',
            enabled: user.Enabled ?? true,
            status: user.UserStatus ?? 'UNKNOWN',
            createdAt: user.UserCreateDate?.toISOString() ?? '',
            provider,
          });
        }

        paginationToken = response.PaginationToken;
      } while (paginationToken);

      // Fetch groups for each user
      const results = [];
      for (const u of allUsers) {
        let groups: string[] = [];
        try {
          const groupResp = await client.send(
            new AdminListGroupsForUserCommand({
              UserPoolId: userPoolId,
              Username: u.username,
            }),
          );
          groups = (groupResp.Groups ?? []).map((g) => g.GroupName ?? '');
        } catch {
          // user may not belong to any group
        }
        results.push({ ...u, groups });
      }

      return { success: true, users: JSON.stringify(results) };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
