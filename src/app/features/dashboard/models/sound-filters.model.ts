import { CategoryKey } from '../../../../../amplify/data/categories';
import { SoundStatus } from '../../../core/models/sound.model';

export interface SoundFilters {
  searchQuery: string;
  category: CategoryKey | null;
  secondaryCategory: string | null;
  status: SoundStatus | null;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

export const DEFAULT_FILTERS: SoundFilters = {
  searchQuery: '',
  category: null,
  secondaryCategory: null,
  status: null,
  dateRange: {
    start: null,
    end: null,
  },
};

export type SortField = 'title' | 'category' | 'status' | 'city' | 'date' | 'user';
export type SortDirection = 'asc' | 'desc';

export interface SoundSort {
  field: SortField;
  direction: SortDirection;
}

export const DEFAULT_SORT: SoundSort = {
  field: 'date',
  direction: 'desc',
};
