/**
 * Utility functions for generating notification messages
 */

/**
 * Get the appropriate subject text for notifications based on guest name
 * @param guestName The guest name from the registration (can be null/undefined)
 * @returns "You" if no guest name, "Your guest [NAME]" if guest name exists
 */
export function getNotificationSubject(guestName?: string | null): string {
  if (guestName && guestName.trim()) {
    return `Your guest ${guestName.trim()}`;
  }
  return 'You';
}
  
/**
 * Get the appropriate possessive form for notifications based on guest name
 * @param guestName The guest name from the registration (can be null/undefined)
 * @returns "you" if no guest name, "your guest [NAME]" if guest name exists
 */
export function getNotificationSubjectLowercase(guestName?: string | null): string {
  if (guestName && guestName.trim()) {
    return `your guest ${guestName.trim()}`;
  }
  return 'you';
}

/**
 * Get the appropriate verb form for notifications based on guest name
 * @param guestName The guest name from the registration (can be null/undefined)
 * @returns "You've" if no guest name, "Your guest [NAME] has" if guest name exists
 */
export function getNotificationSubjectWithVerb(guestName?: string | null, verb: 'have' | 'are' = 'have'): string {
  if (guestName && guestName.trim()) {
    const hasForm = verb === 'have' ? 'has' : 'is';
    return `Your guest ${guestName.trim()} ${hasForm}`;
  }
  const youForm = verb === 'have' ? "You've" : "You're";
  return youForm;
}
