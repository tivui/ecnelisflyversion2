import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { categories, CategoryKey, getSubCategoryKeys } from './categories';
import { importSounds } from '../functions/import-sounds/resource';
import { listSoundsForMap } from '../functions/list-sounds-for-map/resource';

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
        email: a.string().required(),
        owner: a.string(),
        cognitoSub: a.string(),
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
      .secondaryIndexes((index) => [
        index('cognitoSub').queryField('getUserByCognitoSub'),
        index('email').queryField('getUserByEmail'),
      ])
      .authorization((allow) => [
        allow.owner(),
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read', 'update']),
        allow.guest().to(['read']),
      ]),

    Sound: a
      .model({
        userId: a.id().required(),
        user: a.belongsTo('User', 'userId'),

        title: a.string().required(),
        title_i18n: a.json(),

        shortStory: a.string(),
        shortStory_i18n: a.json(),

        filename: a.string().required(),
        status: a.enum(['private', 'public_to_be_approved', 'public']),

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
      .secondaryIndexes((index) => [
        index('userId')
          .sortKeys(['status'])
          .queryField('listSoundsByUserAndStatus'),
        index('category')
          .sortKeys(['status'])
          .queryField('listSoundsByCategoryAndStatus'),
        index('secondaryCategory')
          .sortKeys(['status'])
          .queryField('listSoundsBySecondaryCategoryAndStatus'),
        index('status').queryField('listSoundsByStatus'),
      ])
      .authorization((allow) => [
        allow.owner(),
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['read']),
      ]),

    importSounds: a
      .mutation()
      .arguments({ fileContent: a.json() })
      .returns(a.json())
      .authorization((allow) => [allow.groups(['ADMIN'])])
      .handler(a.handler.function(importSounds)),

    listSoundsForMap: a
      .query()
      .arguments({
        userId: a.id(), // optional
        category: a.string(), // optional
        secondaryCategory: a.string(), // optional
      })
      .returns(a.ref('Sound').array())
      .authorization((allow) => [
        allow.publicApiKey(),
        allow.authenticated(),
        allow.groups(['ADMIN']),
        allow.guest(),
      ])
      .handler(a.handler.function(listSoundsForMap)),

    translate: a
      .query()
      .arguments({
        sourceLanguage: a.string().required(),
        targetLanguage: a.string().required(),
        text: a.string().required(),
      })
      .returns(a.string())
      .authorization((allow) => [
        allow.authenticated(),
        allow.publicApiKey(),
      ])
      .handler(
        a.handler.custom({
          dataSource: 'TranslateDataSource',
          entry: './translate.js',
        }),
      ),
  })

  .authorization((allow) => [
    allow.resource(importSounds),
    allow.resource(listSoundsForMap),
  ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});
