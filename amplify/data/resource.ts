import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { categories, CategoryKey, getSubCategoryKeys } from './categories';
import { importSounds } from '../functions/import-sounds/resource';

// Generate an array containing all valid category and subcategory keys
const allCategoryKeys = Object.values(categories).flatMap((cat) => [
  cat.key,
  ...cat.subcategories.map((sub) => sub.key),
]);

// Define an Amplify enum with all valid keys
const CategoryEnum = a.enum(allCategoryKeys);

/**
 * Single-table schema definition (DynamoDB)
 */
const schema = a
  .schema({
    Language: a.enum(['fr', 'en', 'es']),
    Theme: a.enum(['light', 'dark']),
    LicenseType: a.enum(['READ_ONLY', 'PUBLIC_DOMAIN', 'CC_BY', 'CC_BY_NC']),

    User: a
      .model({
        id: a.id().required(),
        username: a.string().required(),
        email: a.string(),
        country: a.string(),
        firstName: a.string(),
        lastName: a.string(),
        flag: a.string(),
        language: a.ref('Language'),
        theme: a.ref('Theme'),

        sounds: a.hasMany('Sound', 'userId'),

        likedSoundIds: a.string(),
        favoriteSoundIds: a.string(),
        reportedSoundIds: a.string(),

        newNotificationCount: a.integer().default(0),
        flashNew: a.boolean().default(false),
      })
      .authorization((allow) => [allow.owner()]),

    Sound: a
      .model({
        userId: a.id().required(),
        user: a.belongsTo('User', 'userId'),

        title: a.string().required(),
        title_i18n: a.json(),

        shortStory: a.string(),
        shortStory_i18n: a.json(),

        filename: a.string().required(),
        status: a.enum(['public', 'private']),

        latitude: a.float(),
        longitude: a.float(),
        city: a.string(),

        category: a.enum(Object.values(CategoryKey)),
        secondaryCategory: a.string(),

        dateTime: a.datetime(),
        recordDateTime: a.date(),

        equipment: a.string(),
        layer: a.string(),
        license: a.string().default('CC_BY'),

        likesCount: a.integer().default(0),

        url: a.url(),
        urlTitle: a.string(),
        secondaryUrl: a.url(),
        secondaryUrlTitle: a.string(),

        hashtags: a.string(),
        shortHashtags: a.string(),
      })
      .authorization((allow) => [
        allow.owner(),
        allow.publicApiKey().to(['read']),
      ]),

    importSounds: a
      .mutation()
      .arguments({ fileContent: a.json() })
      .returns(a.json())
      .authorization((allow) => [allow.groups(['ADMIN'])])
      .handler(a.handler.function(importSounds)),
  })
  .authorization((allow) => [
    allow.resource(importSounds), // permet à la fonction d’accéder aux opérations Data
  ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});
