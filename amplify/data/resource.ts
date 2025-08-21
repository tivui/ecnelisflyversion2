import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/**
 * Single-table schema definition (DynamoDB)
 * Each "model" represents an entity type. Amplify will handle
 * single-table design + required GSIs under the hood.
 */
const schema = a.schema({
  /**
   * Users of the application
   */
  User: a
    .model({
      username: a.string().required(),       // Display name
      email: a.string().required(),          // Email (unique)
      password: a.string(),                  // Hashed password (if not using Cognito)
      country: a.string(),                   // Country code (FR, AR, etc.)
      firstName: a.string(),                 // Previously: prenom
      lastName: a.string(),                  // Previously: nom
      confirmed: a.boolean().default(false), // Account confirmation
      flag: a.string(),                      // Flag image filename (ex: FR.png)
      language: a.string(),                  // Preferred language

      // Relations
      sounds: a.hasMany("Sound", "userId"),    // List of sounds uploaded by user
      comments: a.hasMany("Comment", "userId"),// List of comments posted by user

      likedSoundIds: a.string(),             // IDs of liked sounds
      favoriteSoundIds: a.string(),          // IDs of favorite sounds
      reportedSoundIds: a.string(),          // IDs of reported sounds

      notifications: a.json(),               // Full JSON object for notifications
      newNotificationCount: a.integer().default(0), // Count of new notifications
      flashNew: a.boolean().default(false),  // Flag for new notifications
    })
    .authorization((allow) => [allow.owner()]), // Each user can manage their own profile

  /**
   * Sounds uploaded by users
   */
  Sound: a
    .model({
      // Relation to User
      userId: a.id().required(),                // Foreign key to User
      user: a.belongsTo("User", "userId"),     // Owner of the sound

      title: a.string().required(),             // Title of the sound
      shortTitle: a.string(),                   // Short version of the title
      filename: a.string().required(),          // File name of the uploaded sound
      username: a.string(),                     // Owner display name
      email: a.string(),                        // Owner email
      status: a.enum(["public", "private"]),   // Visibility status

      latitude: a.float(),                      // Recording location latitude
      longitude: a.float(),                     // Recording location longitude
      city: a.string(),                         // Recording city
      shortStory: a.string(),                   // Short description

      category: a.string(),                     // Main category
      secondaryCategory: a.string(),            // Secondary category
      tertiaryCategory: a.string(),             // Tertiary category
      secondaryCategoryCount: a.integer(),      // Count of secondary category usage

      dateString: a.string(),                   // Human-readable date
      dateTime: a.datetime(),                   // Exact datetime of creation
      recordDate: a.string(),                   // Original recording date as string
      recordDateTime: a.date(),                 // Original recording date as date object

      equipment: a.string(),                    // Recording equipment
      layer: a.string(),                        // Layer info (calque)
      license: a.string().default("CC_BY"),    // License type

      likesCount: a.integer().default(0),      // Number of likes
      reportsCount: a.integer().default(0),    // Number of reports
      usersReported: a.json(),                  // Users who reported this sound

      quizScore: a.integer().default(0),       // Quiz score associated with the sound

      url: a.url(),                             // External URL
      urlTitle: a.string(),                     // URL title
      secondaryUrl: a.url(),                    // Secondary URL
      secondaryUrlTitle: a.string(),            // Secondary URL title

      hashtags: a.string(),                     // Full hashtags string
      shortHashtags: a.string(),                // Short hashtags string

      // Relation to comments
      comments: a.hasMany("Comment", "soundId"), // Comments associated with the sound
    })
    .authorization((allow) => [
      allow.owner(),                       // Owner can manage their own sounds
      allow.publicApiKey().to(["read"]),   // Public read-only access
    ]),

  /**
   * Comments posted by users on sounds
   */
  Comment: a
    .model({
      // Relation to Sound
      soundId: a.id().required(),             // Foreign key to Sound
      sound: a.belongsTo("Sound", "soundId"), // Associated sound

      // Relation to User
      userId: a.id().required(),              // Foreign key to User
      user: a.belongsTo("User", "userId"),    // Author of the comment

      content: a.string().required(),         // Comment text
      dateTime: a.datetime().required(),      // Date and time of posting
      status: a.enum(["published", "reported"]), // Moderation status
    })
    .authorization((allow) => [
      allow.owner(),                        // Owner of comment can manage it
      allow.publicApiKey().to(["read"]),    // Public read-only access
    ]),
});

export type Schema = ClientSchema<typeof schema>;

/**
 * Define the data object with authorization modes
 * Using both Cognito User Pool (authenticated users)
 * and API Key (public read access)
 */
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",       // Authenticated users via Cognito
    apiKeyAuthorizationMode: { expiresInDays: 30 }, // API key for public read access
  },
});
