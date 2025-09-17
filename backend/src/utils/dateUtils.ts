/**
 * Utility functions for date formatting
 */

/**
 * Format a date for display in notifications and messages using the long format
 * @param date The date to format
 * @returns Formatted date string like "Monday, 15 January, 19:30"
 */
export function formatGameDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date for display in compact notifications using the short format
 * @param date The date to format
 * @returns Formatted date string like "Mon, 15 Jan, 19:30"
 */
export function formatGameDateShort(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
