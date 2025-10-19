export interface MapQueryParams {
  userId?: string;
  category?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
  basemap?: string;
}

export const MAP_QUERY_KEYS = {
  userId: 'userId',
  category: 'category',
  lat: 'lat',
  lng: 'lng',
  zoom: 'zoom',
  basemap: 'basemap',
} as const;

export const ALL_GROUP_KEYS = ['TOUT', 'ALL', 'TODO'] as const;


