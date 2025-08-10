/**
 * Utility functions for handling game locations
 */

/**
 * Resolves a location link for display
 * @param name - Location name
 * @param link - Custom location link
 * @returns A valid URL for the location
 */
export const resolveLocationLink = (name?: string | null, link?: string | null): string => {
  if (link && (link.startsWith('http://') || link.startsWith('https://'))) return link;
  if (name) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  return '#';
};
