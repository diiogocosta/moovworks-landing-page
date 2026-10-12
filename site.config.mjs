/**
 * Single source of truth for every value that appears in more than one place.
 *
 * Imported by `astro.config.mjs` (build-time) and by `src/**` (render-time), so the
 * contact address, the origin and the route slugs can never drift apart.
 */

export const SITE = {
  name: "Moovworks",
  /** Production origin. No trailing slash. */
  url: "https://moovworks.com",
  /**
   * Placeholder address. Change it here and nowhere else — every mailto: on the
   * site, the footer and the JSON-LD read from this value.
   */
  email: "contato@moovworks.com",
  /** Credibility date. Never rephrased as "N years" — that would age badly. */
  founded: "2011",
};

/** Ordered exactly as the header renders them. */
export const LOCALES = ["pt-BR", "pt-PT", "en"];

export const DEFAULT_LOCALE = "pt-BR";

/** One page, one slug per locale. */
export const HOME_SLUG = { "pt-BR": "pt-br", "pt-PT": "pt-pt", en: "en" };

/** Localised slugs for the legal stubs, which sit outside the design scope. */
export const LEGAL_SLUG = {
  "pt-BR": { privacy: "privacidade", terms: "termos" },
  "pt-PT": { privacy: "privacidade", terms: "termos" },
  en: { privacy: "privacy", terms: "terms" },
};

export const LEGAL_KINDS = ["privacy", "terms"];

/**
 * While these routes only say "em preparação" they are `noindex` and left out
 * of the sitemap. Set this to true in the same change that adds the real text.
 */
export const LEGAL_PUBLISHED = false;

/** Only used for og:locale / og:locale:alternate. */
export const OG_LOCALE = { "pt-BR": "pt_BR", "pt-PT": "pt_PT", en: "en_US" };

/**
 * The Basic Latin range both self-hosted subsets are cut to. Declared on the
 * @font-face rules so a browser never downloads a font it will not use.
 * `scripts/fetch-fonts.mjs` verifies this still matches upstream.
 */
export const LATIN_UNICODE_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, " +
  "U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, " +
  "U+2212, U+2215, U+FEFF, U+FFFD";

/** Astro wants the range as a list, not as a single comma-joined string. */
export const LATIN_UNICODE_RANGES = LATIN_UNICODE_RANGE.split(", ");

export const homePath = (locale) => `/${HOME_SLUG[locale]}/`;

export const legalPath = (locale, kind) =>
  `/${HOME_SLUG[locale]}/${LEGAL_SLUG[locale][kind]}/`;

export const absolute = (path) => new URL(path, SITE.url).href;
