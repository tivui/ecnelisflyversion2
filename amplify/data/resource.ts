import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { CategoryKey } from './categories';
import { importSounds } from '../functions/import-sounds/resource';
import { listSoundsForMap } from '../functions/list-sounds-for-map/resource';
import { deleteSoundFile } from '../functions/delete-sound-file/resource';
import { listSoundsByZone } from '../functions/list-sounds-by-zone/resource';
import { pickDailyFeaturedSound } from '../functions/pick-daily-featured-sound/resource';
import { pickMonthlyQuiz } from '../functions/pick-monthly-quiz/resource';
import { startImport } from '../functions/start-import/resource';
import { processImport } from '../functions/process-import/resource';

/**
 * Single-table schema definition (DynamoDB)
 */
const schema = a
  .schema({
    Language: a.enum(['fr', 'en', 'es']),
    Theme: a.enum(['light', 'dark']),
    LicenseType: a.enum(['READ_ONLY', 'PUBLIC_DOMAIN', 'CC_BY', 'CC_BY_NC']),
    ImportJobStatus: a.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
    QuizDifficulty: a.enum(['easy', 'medium', 'hard']),
    QuizStatus: a.enum(['draft', 'published', 'archived']),
    QuestionType: a.enum([
      'listen_identify',
      'listen_choose_category',
      'listen_choose_location',
      'odd_one_out',
      'true_false',
    ]),
    ArticleStatus: a.enum(['draft', 'published', 'archived']),
    ArticleBlockType: a.enum([
      'heading',
      'paragraph',
      'sound',
      'image',
      'quote',
      'callout',
    ]),

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

        avatarStyle: a.string(),
        avatarSeed: a.string(),
        avatarBgColor: a.string(),
        avatarOptions: a.string(),
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

        zoneSounds: a.hasMany('ZoneSound', 'soundId'),
        featuredSoundCandidates: a.hasMany('FeaturedSoundCandidate', 'soundId'),
        dailyFeaturedSounds: a.hasMany('DailyFeaturedSound', 'soundId'),
        journeySteps: a.hasMany('SoundJourneyStep', 'soundId'),
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
        allow.authenticated().to(['read', 'update']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['read']),
      ]),

    Zone: a
      .model({
        id: a.id().required(),
        name: a.string().required(),
        name_i18n: a.json(),
        description: a.string(),
        description_i18n: a.json(),
        slug: a.string().required(),
        polygon: a.json().required(),
        center: a.json(),
        defaultZoom: a.integer().default(12),
        coverImage: a.string(),
        color: a.string().default('#1976d2'),
        isPublic: a.boolean().default(true),
        sortOrder: a.integer().default(0),
        createdBy: a.id(),

        zoneSounds: a.hasMany('ZoneSound', 'zoneId'),
      })
      .secondaryIndexes((index) => [
        index('slug').queryField('getZoneBySlug'),
      ])
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
      ]),

    ZoneSound: a
      .model({
        id: a.id().required(),
        zoneId: a.id().required(),
        soundId: a.id().required(),
        zone: a.belongsTo('Zone', 'zoneId'),
        sound: a.belongsTo('Sound', 'soundId'),
        sortOrder: a.integer().default(0),
      })
      .secondaryIndexes((index) => [
        index('zoneId')
          .sortKeys(['sortOrder'])
          .queryField('listZoneSoundsByZone'),
        index('soundId').queryField('listZoneSoundsBySound'),
      ])
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
      ]),

    FeaturedSoundCandidate: a
      .model({
        id: a.id().required(),
        soundId: a.id().required(),
        sound: a.belongsTo('Sound', 'soundId'),
        teasing: a.string().required(),
        teasing_i18n: a.json(),
        isActive: a.boolean().default(true),
        sortOrder: a.integer().default(0),
      })
      .secondaryIndexes((index) => [
        index('soundId').queryField('listFeaturedCandidatesBySound'),
      ])
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
      ]),

    DailyFeaturedSound: a
      .model({
        id: a.id().required(),
        date: a.string().required(),
        featuredCandidateId: a.id().required(),
        soundId: a.id().required(),
        sound: a.belongsTo('Sound', 'soundId'),
        teasing: a.string(),
        teasing_i18n: a.json(),
        soundTitle: a.string(),
        soundCity: a.string(),
        soundLatitude: a.float(),
        soundLongitude: a.float(),
        soundCategory: a.string(),
        soundSecondaryCategory: a.string(),
        soundFilename: a.string(),
      })
      .secondaryIndexes((index) => [
        index('date').queryField('getDailyFeaturedByDate'),
      ])
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
      ]),

    SoundJourney: a
      .model({
        id: a.id().required(),
        name: a.string().required(),
        name_i18n: a.json(),
        description: a.string(),
        description_i18n: a.json(),
        slug: a.string().required(),
        color: a.string().default('#1976d2'),
        coverImage: a.string(),
        isPublic: a.boolean().default(true),
        sortOrder: a.integer().default(0),
        createdBy: a.id(),

        journeySteps: a.hasMany('SoundJourneyStep', 'journeyId'),
      })
      .secondaryIndexes((index) => [
        index('slug').queryField('getJourneyBySlug'),
      ])
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
      ]),

    SoundJourneyStep: a
      .model({
        id: a.id().required(),
        journeyId: a.id().required(),
        soundId: a.id().required(),
        journey: a.belongsTo('SoundJourney', 'journeyId'),
        sound: a.belongsTo('Sound', 'soundId'),
        stepOrder: a.integer().required(),
        themeText: a.string(),
        themeText_i18n: a.json(),
      })
      .secondaryIndexes((index) => [
        index('journeyId')
          .sortKeys(['stepOrder'])
          .queryField('listJourneyStepsByJourney'),
        index('soundId').queryField('listJourneyStepsBySound'),
      ])
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
      ]),

    // ============ QUIZ ============

    Quiz: a
      .model({
        id: a.id().required(),
        title: a.string().required(),
        title_i18n: a.json(),
        description: a.string(),
        description_i18n: a.json(),
        difficulty: a.ref('QuizDifficulty').required(),
        category: a.string(),
        imageKey: a.string(),
        status: a.ref('QuizStatus').required(),
        questionCount: a.integer().default(0),
        totalPlays: a.integer().default(0),
        createdAt: a.datetime(),
        updatedAt: a.datetime(),

        questions: a.hasMany('QuizQuestion', 'quizId'),
        attempts: a.hasMany('QuizAttempt', 'quizId'),
        monthlyQuizzes: a.hasMany('MonthlyQuiz', 'quizId'),
      })
      .secondaryIndexes((index) => [
        index('status').queryField('listQuizzesByStatus'),
      ])
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
      ]),

    QuizQuestion: a
      .model({
        id: a.id().required(),
        quizId: a.id().required(),
        quiz: a.belongsTo('Quiz', 'quizId'),
        order: a.integer().required(),
        type: a.ref('QuestionType').required(),
        prompt: a.string().required(),
        prompt_i18n: a.json(),
        soundId: a.id(),
        choices: a.json().required(),
        explanation: a.string(),
        explanation_i18n: a.json(),
        timeLimitOverride: a.integer(),
      })
      .secondaryIndexes((index) => [
        index('quizId')
          .sortKeys(['order'])
          .queryField('listQuestionsByQuiz'),
      ])
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
      ]),

    QuizAttempt: a
      .model({
        id: a.id().required(),
        quizId: a.id().required(),
        quiz: a.belongsTo('Quiz', 'quizId'),
        userId: a.id().required(),
        username: a.string(),
        avatarStyle: a.string(),
        avatarSeed: a.string(),
        avatarBgColor: a.string(),
        score: a.integer().required(),
        maxScore: a.integer().required(),
        stars: a.integer().default(0),
        answers: a.json(),
        completedAt: a.datetime(),
      })
      .secondaryIndexes((index) => [
        index('quizId')
          .sortKeys(['score'])
          .queryField('listAttemptsByQuizAndScore'),
        index('userId')
          .sortKeys(['completedAt'])
          .queryField('listAttemptsByUser'),
      ])
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['create', 'read']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
      ]),

    MonthlyQuiz: a
      .model({
        id: a.id().required(),
        quizId: a.id().required(),
        quiz: a.belongsTo('Quiz', 'quizId'),
        month: a.string().required(),
        active: a.boolean().default(true),
      })
      .secondaryIndexes((index) => [
        index('month').queryField('getMonthlyQuizByMonth'),
      ])
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
      ]),

    // ============ ARTICLES ============

    SoundArticle: a
      .model({
        id: a.id().required(),
        title: a.string().required(),
        title_i18n: a.json(),
        description: a.string(),
        description_i18n: a.json(),
        slug: a.string().required(),
        coverImageKey: a.string(),
        tags: a.json(),
        status: a.ref('ArticleStatus').required(),
        authorName: a.string(),
        readingTimeMinutes: a.integer(),
        blockCount: a.integer().default(0),
        publishedAt: a.datetime(),
        sortOrder: a.integer().default(0),
        createdAt: a.datetime(),
        updatedAt: a.datetime(),

        blocks: a.hasMany('ArticleBlock', 'articleId'),
      })
      .secondaryIndexes((index) => [
        index('slug').queryField('getArticleBySlug'),
        index('status').queryField('listArticlesByStatus'),
      ])
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
      ]),

    ArticleBlock: a
      .model({
        id: a.id().required(),
        articleId: a.id().required(),
        article: a.belongsTo('SoundArticle', 'articleId'),
        order: a.integer().required(),
        type: a.ref('ArticleBlockType').required(),

        // Text content (heading, paragraph, quote, callout)
        content: a.string(),
        content_i18n: a.json(),

        // Sound media
        soundId: a.id(),
        soundCaption: a.string(),
        soundCaption_i18n: a.json(),

        // Image media
        imageKey: a.string(),
        imageAlt: a.string(),
        imageAlt_i18n: a.json(),
        imageCaption: a.string(),
        imageCaption_i18n: a.json(),

        // Style options (JSON: { level?, align?, size? })
        settings: a.json(),
      })
      .secondaryIndexes((index) => [
        index('articleId')
          .sortKeys(['order'])
          .queryField('listBlocksByArticle'),
      ])
      .authorization((allow) => [
        allow.publicApiKey().to(['read']),
        allow.authenticated().to(['read']),
        allow.guest().to(['read']),
        allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
      ]),

    // ============ IMPORT ============

    ImportJob: a
      .model({
        id: a.id().required(),
        status: a.ref('ImportJobStatus'),
        s3Key: a.string().required(),
        totalSounds: a.integer().default(0),
        processedCount: a.integer().default(0),
        importedCount: a.integer().default(0),
        skippedCount: a.integer().default(0),
        invalidCategoryCount: a.integer().default(0),
        invalidDatesCount: a.integer().default(0),
        emptyHashtagsCount: a.integer().default(0),
        errorMessage: a.string(),
        startedAt: a.datetime(),
        completedAt: a.datetime(),
      })
      .authorization((allow) => [
        allow.groups(['ADMIN']).to(['create', 'read', 'update', 'delete']),
      ]),

    importSounds: a
      .mutation()
      .arguments({ fileContent: a.json() })
      .returns(a.json())
      .authorization((allow) => [allow.groups(['ADMIN'])])
      .handler(a.handler.function(importSounds)),

    startImport: a
      .mutation()
      .arguments({ s3Key: a.string().required() })
      .returns(a.json())
      .authorization((allow) => [allow.groups(['ADMIN'])])
      .handler(a.handler.function(startImport)),

    deleteSoundFile: a
      .mutation()
      .arguments({ filename: a.string().required() })
      .returns(a.json())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(deleteSoundFile)),

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

    listSoundsByZone: a
      .query()
      .arguments({
        zoneId: a.id().required(),
      })
      .returns(a.ref('Sound').array())
      .authorization((allow) => [
        allow.publicApiKey(),
        allow.authenticated(),
        allow.groups(['ADMIN']),
        allow.guest(),
      ])
      .handler(a.handler.function(listSoundsByZone)),

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
    allow.resource(deleteSoundFile),
    allow.resource(listSoundsByZone),
    allow.resource(pickDailyFeaturedSound),
    allow.resource(pickMonthlyQuiz),
    allow.resource(startImport),
    allow.resource(processImport),
  ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});
