/**
 * Creates a safe email local-part from a user-visible name.
 * - Lowercases and trims
 * - Removes diacritics (NFKD) for Latin-based scripts
 * - Replaces spaces with underscore
 * - Replaces all characters outside [a-z0-9._-] with underscore
 * - Collapses repeated separators and trims from ends
 * - Falls back to `user{fallbackId}` if empty
 * - Truncates to 64 characters to satisfy common email local-part limits
 */
export function toEmailLocalPart(name: string, fallbackId: number): string {
  if (!name) return `user${fallbackId}`;
  let local = name.trim().toLowerCase();

  // Transliterate Cyrillic to Latin equivalents (basic Russian/Ukrainian set)
  local = transliterateCyrillic(local);

  // Remove diacritics for Latin characters (e.g., é -> e). Non-Latin letters become underscores below.
  try {
    local = local.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    // If normalize is not supported, skip gracefully
  }

  // Replace spaces with underscore
  local = local.replace(/\s+/g, '_');

  // Keep only allowed characters in a conservative set
  local = local.replace(/[^a-z0-9._-]/g, '_');

  // Collapse multiple separators into a single underscore
  local = local.replace(/[._-]{2,}/g, '_');

  // Trim leading/trailing separators
  local = local.replace(/^[._-]+|[._-]+$/g, '');

  if (!local) local = `user${fallbackId}`;

  // Enforce typical local-part max length
  if (local.length > 64) local = local.slice(0, 64);

  return local;
}

/** Basic Cyrillic -> Latin transliteration covering Russian + common Ukrainian letters */
function transliterateCyrillic(input: string): string {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i',
    'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
    'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '',
    'э': 'e', 'ю': 'yu', 'я': 'ya',
    // Ukrainian/Belarusian
    'і': 'i', 'ї': 'yi', 'є': 'ye', 'ґ': 'g'
  };
  let out = '';
  for (const ch of input) {
    out += map[ch] !== undefined ? map[ch] : ch;
  }
  return out;
}
