import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Single-table schema definition (DynamoDB)
 */
const schema = a.schema({
  /**
   * Enum pour les langues supportées
   */
  Language: a.enum(['fr', 'en', 'es']),

  /**
   * Enum pour les types de notifications
   */
  NotificationType: a.enum(['like', 'comment', 'report', 'system']),

  /**
   * Users of the application (lié à Cognito)
   */
  User: a
    .model({
      // ⚡️ ID = Cognito sub (UUID)
      id: a.id().required(),

      // Infos importées depuis Cognito
      username: a.string().required(),
      email: a.string().required(),

      // Métadonnées applicatives
      country: a.string(),
      firstName: a.string(),
      lastName: a.string(),
      flag: a.string(),
      language: a.ref('Language'),

      // Relations
      sounds: a.hasMany('Sound', 'userId'),
      comments: a.hasMany('Comment', 'userId'),
      notifications: a.hasMany('Notification', 'userId'),
      reports: a.hasMany('Report', 'userId'),

      // Champs applicatifs enrichis
      likedSoundIds: a.string(),
      favoriteSoundIds: a.string(),
      reportedSoundIds: a.string(),

      newNotificationCount: a.integer().default(0),
      flashNew: a.boolean().default(false),
    })
    .authorization((allow) => [
      allow.owner(),
    ]),


  /**
   * Sounds uploaded by users
   */
  Sound: a
    .model({
      userId: a.id().required(),
      user: a.belongsTo('User', 'userId'),

      title: a.string().required(),
      title_i18n: a.json(),

      description: a.string(),
      description_i18n: a.json(),

      shortTitle: a.string(),
      shortTitle_i18n: a.json(),

      shortStory: a.string(),
      shortStory_i18n: a.json(),

      filename: a.string().required(),
      username: a.string(),
      email: a.string(),
      status: a.enum(['public', 'private']),

      latitude: a.float(),
      longitude: a.float(),
      city: a.string(),

      category: a.string(),
      secondaryCategory: a.string(),
      tertiaryCategory: a.string(),
      secondaryCategoryCount: a.integer(),

      dateString: a.string(),
      dateTime: a.datetime(),
      recordDate: a.string(),
      recordDateTime: a.date(),

      equipment: a.string(),
      layer: a.string(),
      license: a.string().default('CC_BY'),

      likesCount: a.integer().default(0),
      reportsCount: a.integer().default(0),

      quizScore: a.integer().default(0),

      url: a.url(),
      urlTitle: a.string(),
      secondaryUrl: a.url(),
      secondaryUrlTitle: a.string(),

      hashtags: a.string(),
      shortHashtags: a.string(),

      comments: a.hasMany('Comment', 'soundId'),
      reports: a.hasMany('Report', 'soundId'),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.publicApiKey().to(['read']),
    ]),

  /**
   * Comments
   */
  Comment: a
    .model({
      soundId: a.id().required(),
      sound: a.belongsTo('Sound', 'soundId'),

      userId: a.id().required(),
      user: a.belongsTo('User', 'userId'),

      content: a.string().required(),
      content_i18n: a.json(),

      dateTime: a.datetime().required(),
      status: a.enum(['published', 'reported']),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.publicApiKey().to(['read']),
    ]),

  /**
   * Notifications
   */
  Notification: a
    .model({
      userId: a.id().required(),
      user: a.belongsTo('User', 'userId'),

      type: a.ref('NotificationType').required(),
      payload: a.json(),
      isRead: a.boolean().default(false),
    })
    .authorization((allow) => [allow.owner()]),

  /**
   * Reports
   */
  Report: a
    .model({
      soundId: a.id().required(),
      sound: a.belongsTo('Sound', 'soundId'),

      userId: a.id().required(),
      user: a.belongsTo('User', 'userId'),

      reason: a.string(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});
