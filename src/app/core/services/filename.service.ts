/**
 * Utility functions for file name sanitization
 */

/**
 * Sanitize a filename for safe storage (S3, etc.)
 * - Removes accents/diacritics
 * - Replaces spaces and special characters with hyphens
 * - Converts to lowercase
 * - Removes consecutive hyphens
 * - Removes leading/trailing hyphens
 * - Preserves the file extension
 *
 * @param filename Original filename (e.g., "Mon Fichier (été).mp3")
 * @returns Sanitized filename (e.g., "mon-fichier-ete.mp3")
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return filename;

  // Separate name and extension
  const lastDotIndex = filename.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0;
  const name = hasExtension ? filename.substring(0, lastDotIndex) : filename;
  const extension = hasExtension ? filename.substring(lastDotIndex).toLowerCase() : '';

  // Normalize and remove accents
  let sanitized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Replace spaces and special characters with hyphens
  sanitized = sanitized
    .replace(/[^a-zA-Z0-9\-_]/g, '-')
    .toLowerCase();

  // Remove consecutive hyphens
  sanitized = sanitized.replace(/-+/g, '-');

  // Remove leading/trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // Ensure filename is not empty
  if (!sanitized) {
    sanitized = 'file';
  }

  return sanitized + extension;
}

/**
 * Generate a unique filename by adding a timestamp suffix
 *
 * @param filename Original filename
 * @returns Filename with timestamp (e.g., "mon-fichier-1704067200000.mp3")
 */
export function generateUniqueFilename(filename: string): string {
  const sanitized = sanitizeFilename(filename);
  const lastDotIndex = sanitized.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0;
  const name = hasExtension ? sanitized.substring(0, lastDotIndex) : sanitized;
  const extension = hasExtension ? sanitized.substring(lastDotIndex) : '';

  return `${name}-${Date.now()}${extension}`;
}
