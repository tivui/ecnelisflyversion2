import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async () => {
  const tableName = process.env['SITE_VISIT_TABLE_NAME'];
  if (!tableName) throw new Error('SITE_VISIT_TABLE_NAME not set');

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  const result = await ddbClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { id: today },
      UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :inc',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: { ':zero': 0, ':inc': 1 },
      ReturnValues: 'ALL_NEW',
    }),
  );

  const item = result.Attributes ?? {};
  return { date: item['id'] ?? today, count: item['count'] ?? 1 };
};
