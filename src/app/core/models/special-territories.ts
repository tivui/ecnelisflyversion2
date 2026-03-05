/**
 * Special territories not included in ISO 3166-1.
 * Codes use the X prefix (user-assigned range in ISO 3166).
 */

export interface SpecialTerritory {
  flag: string;
  names: { fr: string; en: string; es: string };
}

export const SPECIAL_TERRITORIES: Record<string, SpecialTerritory> = {
  XBQ: { flag: '_basque-country', names: { fr: 'Pays basque', en: 'Basque Country', es: 'País Vasco' } },
  XSC: { flag: '_scotland', names: { fr: 'Écosse', en: 'Scotland', es: 'Escocia' } },
  XWA: { flag: '_wales', names: { fr: 'Pays de Galles', en: 'Wales', es: 'Gales' } },
  XEN: { flag: '_england', names: { fr: 'Angleterre', en: 'England', es: 'Inglaterra' } },
  XKO: { flag: '_kosovo', names: { fr: 'Kosovo', en: 'Kosovo', es: 'Kosovo' } },
};

/** Legacy codes stored by the import Lambda (e.g. "_basque-country") → new short code */
const LEGACY_TO_CODE: Record<string, string> = {};
for (const [code, t] of Object.entries(SPECIAL_TERRITORIES)) {
  LEGACY_TO_CODE[t.flag] = code;
}

/** Resolve a country code (including legacy import codes) to a short code */
export function resolveCountryCode(code: string): string {
  return LEGACY_TO_CODE[code] ?? code;
}

/** Get the flag image path for a country code (ISO or special territory, including legacy) */
export function getSpecialTerritoryFlag(code: string): string | null {
  const resolved = resolveCountryCode(code);
  const territory = SPECIAL_TERRITORIES[resolved];
  return territory ? `/img/flags/${territory.flag}.png` : null;
}

/** Check if a code is a special territory (or a legacy code for one) */
export function isSpecialTerritory(code: string): boolean {
  const resolved = resolveCountryCode(code);
  return resolved in SPECIAL_TERRITORIES;
}

/** Get the translated name of a special territory */
export function getSpecialTerritoryName(code: string, lang: string): string | null {
  const resolved = resolveCountryCode(code);
  const territory = SPECIAL_TERRITORIES[resolved];
  if (!territory) return null;
  const locale = (lang === 'fr' || lang === 'en' || lang === 'es') ? lang : 'en';
  return territory.names[locale];
}

/** Get all special territories as { code, name } for a given language */
export function getAllTerritories(lang: string): { code: string; name: string }[] {
  const locale = (lang === 'fr' || lang === 'en' || lang === 'es') ? lang : 'en';
  return Object.entries(SPECIAL_TERRITORIES).map(([code, t]) => ({
    code,
    name: t.names[locale],
  }));
}

/**
 * Universal getFlagPath — works for ISO codes, special territory codes, and legacy import codes.
 * Use this instead of per-component getFlagPath() implementations.
 */
export function getFlagPath(country?: string | null): string | null {
  if (!country) return null;
  const code = country.trim();
  if (!code) return null;

  // Check special territory (including legacy codes like "_basque-country")
  const specialFlag = getSpecialTerritoryFlag(code);
  if (specialFlag) return specialFlag;

  // Standard ISO 2-3 letter codes
  if (code.length >= 2 && code.length <= 3) {
    return `/img/flags/${code.toUpperCase()}.png`;
  }

  return null;
}
