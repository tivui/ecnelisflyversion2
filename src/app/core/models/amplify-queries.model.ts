export const ListSoundsForMapWithAppUser = /* GraphQL */ `
  query ListSoundsForMapWithAppUser($category: String, $userId: ID, $secondaryCategory: String) {
    listSoundsForMap(category: $category, userId: $userId, secondaryCategory: $secondaryCategory) {
      id
      userId
      user {
        username
        country
      }
      title
      category
      secondaryCategory
      city
      dateTime
      equipment
      filename
      latitude
      license
      longitude
      recordDateTime
      secondaryCategory
      secondaryUrl
      secondaryUrlTitle
      shortStory
      shortStory_i18n
      title_i18n
      url
      urlTitle
      hashtags
      likesCount
      createdAt
    }
  }
`;

export const ListSoundsByZoneWithUser = /* GraphQL */ `
  query ListSoundsByZoneWithUser($zoneId: ID!) {
    listSoundsByZone(zoneId: $zoneId) {
      id
      userId
      user {
        username
        country
      }
      title
      category
      secondaryCategory
      city
      dateTime
      equipment
      filename
      latitude
      license
      longitude
      recordDateTime
      secondaryCategory
      secondaryUrl
      secondaryUrlTitle
      shortStory
      shortStory_i18n
      title_i18n
      url
      urlTitle
      hashtags
      likesCount
      createdAt
    }
  }
`;
