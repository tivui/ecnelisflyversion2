
export const ListSoundsForMapWithAppUser = /* GraphQL */ `
  query ListSoundsForMapWithAppUser($category: String, $userId: ID) {
    listSoundsForMap(category: $category, userId: $userId) {
      user {
        username
        country
      }
      title
      category
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
    }
  }
`;
