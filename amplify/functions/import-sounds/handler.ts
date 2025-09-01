import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/import-sounds';
import type { Schema } from '../../data/resource';

export const handler: Schema['importSounds']['functionHandler'] = async (event) => {
  // Configure Amplify avec les credentials et endpoint corrects
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);

  const client = generateClient<Schema>();

  const { fileContent } = event.arguments;
  const content = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;

  if (!content.sounds || !Array.isArray(content.sounds)) return false;

  for (const sound of content.sounds) {
    const users = await client.models.User.list({ filter: { email: { eq: sound.email } } });
    if (!users.data.length) continue;
    const user = users.data[0];

    await client.models.Sound.create({
      userId: user.id,
      title: sound.title,
      filename: sound.filename || 'unknown.mp3',
    });
  }

  return true;
};
