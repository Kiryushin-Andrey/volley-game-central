/**
 * Utilities for composing Telegram messages using parse_mode: 'HTML'.
 * Focused on safe HTML escaping and user-friendly location rendering.
 */

/** Escape text content for Telegram HTML. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape attribute values for Telegram HTML (e.g., href). */
export function escapeHtmlAttribute(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Validate that a URL is http(s). Returns the normalized href or null. */
export function validateHttpUrl(maybeUrl: string | null | undefined): string | null {
  if (!maybeUrl) return null;
  const trimmed = maybeUrl.trim();
  if (trimmed.length === 0) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve a maps link using either a provided link (if valid http/https)
 * or a Google Maps search URL derived from the name.
 */
export function resolveLocationLink(name?: string | null, link?: string | null): string | null {
  const valid = validateHttpUrl(link);
  if (valid) return valid;
  const hasName = typeof name === 'string' && name.trim().length > 0;
  if (hasName) {
    const query = encodeURIComponent(name!.trim());
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  return null;
}

/**
 * Build a user-friendly location section for Telegram messages.
 * Returns a string that starts with two newlines when present, or an empty string otherwise.
 */
export function formatLocationSection(name?: string | null, link?: string | null): string {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const hasName = trimmedName.length > 0;
  const href = resolveLocationLink(trimmedName, link);

  if (href && hasName) {
    return `\n\n📍 Location: <a href="${escapeHtmlAttribute(href)}">${escapeHtml(trimmedName)}</a>`;
  }
  if (href) {
    return `\n\n📍 Location: <a href="${escapeHtmlAttribute(href)}">Open in Maps</a>`;
  }
  if (hasName) {
    // No link available or name-only; still display readable name
    return `\n\n📍 Location: ${escapeHtml(trimmedName)}`;
  }
  return '';
}


