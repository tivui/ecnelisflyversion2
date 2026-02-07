import { Sound } from '../../../core/models/sound.model';
import { SoundFilters, SoundSort } from '../models/sound-filters.model';

/**
 * Filter sounds based on client-side filters
 */
export function filterSounds(sounds: Sound[], filters: SoundFilters, currentLang: string): Sound[] {
  return sounds.filter((sound) => {
    // Text search (case-insensitive)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase().trim();
      const title = (sound.title_i18n?.[currentLang] || sound.title || '').toLowerCase();
      const city = (sound.city || '').toLowerCase();
      const hashtags = (sound.hashtags || '').toLowerCase();

      if (!title.includes(query) && !city.includes(query) && !hashtags.includes(query)) {
        return false;
      }
    }

    // Category filter
    if (filters.category && sound.category !== filters.category) {
      return false;
    }

    // Secondary category filter
    if (filters.secondaryCategory && sound.secondaryCategory !== filters.secondaryCategory) {
      return false;
    }

    // Status filter
    if (filters.status && sound.status !== filters.status) {
      return false;
    }

    // Date range filter - compare using timestamps for accuracy
    if (filters.dateRange.start || filters.dateRange.end) {
      // If date filter is set but sound has no recordDateTime, exclude it
      if (!sound.recordDateTime) {
        return false;
      }

      // Normalize sound date to start of day (midnight)
      const soundDate = new Date(sound.recordDateTime);
      soundDate.setHours(0, 0, 0, 0);
      const soundTime = soundDate.getTime();

      if (filters.dateRange.start) {
        const startDate = new Date(filters.dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        if (soundTime < startDate.getTime()) {
          return false;
        }
      }

      if (filters.dateRange.end) {
        const endDate = new Date(filters.dateRange.end);
        endDate.setHours(23, 59, 59, 999); // End of the day
        if (soundTime > endDate.getTime()) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Sort sounds based on sort configuration
 */
export function sortSounds(sounds: Sound[], sort: SoundSort, currentLang: string): Sound[] {
  const sorted = [...sounds];

  sorted.sort((a, b) => {
    let valueA: string | number | Date | undefined;
    let valueB: string | number | Date | undefined;

    switch (sort.field) {
      case 'title':
        valueA = a.title_i18n?.[currentLang] || a.title || '';
        valueB = b.title_i18n?.[currentLang] || b.title || '';
        break;
      case 'category':
        valueA = a.secondaryCategory || a.category || '';
        valueB = b.secondaryCategory || b.category || '';
        break;
      case 'status':
        valueA = a.status || '';
        valueB = b.status || '';
        break;
      case 'city':
        valueA = a.city || '';
        valueB = b.city || '';
        break;
      case 'date':
        valueA = a.recordDateTime?.getTime() || 0;
        valueB = b.recordDateTime?.getTime() || 0;
        break;
      case 'user':
        valueA = a.user?.username || '';
        valueB = b.user?.username || '';
        break;
      default:
        return 0;
    }

    // Compare values
    let comparison = 0;
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      comparison = valueA.localeCompare(valueB);
    } else if (typeof valueA === 'number' && typeof valueB === 'number') {
      comparison = valueA - valueB;
    }

    return sort.direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Check if any filter is active
 */
export function hasActiveFilters(filters: SoundFilters): boolean {
  return !!(
    filters.searchQuery ||
    filters.category ||
    filters.secondaryCategory ||
    filters.status ||
    filters.dateRange.start ||
    filters.dateRange.end
  );
}

/**
 * Count active filters
 */
export function countActiveFilters(filters: SoundFilters): number {
  let count = 0;
  if (filters.searchQuery) count++;
  if (filters.category) count++;
  if (filters.secondaryCategory) count++;
  if (filters.status) count++;
  if (filters.dateRange.start || filters.dateRange.end) count++;
  return count;
}
