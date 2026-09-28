/**
 * Single source of truth for every value that appears in more than one place.
 *
 * Imported by `astro.config.mjs` (build-time) and by `src/**` (render-time), so the
 * contact address, the origin and the route slugs can never drift apart.
 */

export const SITE = {
  name: 'Moovworks',
  /** Production origin. No trailing slash. */
  url: 'https://moovworks.com',
  /**
   * Placeholder address. Change it here and nowhere else — every mailto: on the
   * site, the footer and the JSON-LD read from this value.
   */
  email: 'contato@moovworks.com',
  /** Credibility date. Never rephrased as "N years" — that would age badly. */
  founded: '2011',
};

/** Ordered exactly as the header renders them. */
export const LOCALES = ['pt-BR', 'pt-PT', 'en'];

export const DEFAULT_LOCALE = 'pt-BR';

/** One page, one slug per locale. */
export const HOME_SLUG = { 'pt-BR': 'pt-br', 'pt-PT': 'pt-pt', en: 'en' };

/** Localised slugs for the legal stubs, which sit outside the design scope. */
export const LEGAL_SLUG = {
  'pt-BR': { privacy: 'privacidade', terms: 'termos' },
  'pt-PT': { privacy: 'privacidade', terms: 'termos' },
  en: { privacy: 'privacy', terms: 'terms' },
};

/** Only used for og:locale / og:locale:alternate. */
export const OG_LOCALE = { 'pt-BR': 'pt_BR', 'pt-PT': 'pt_PT', en: 'en_US' };

export const homePath = (locale) => `/${HOME_SLUG[locale]}/`;

export const legalPath = (locale, kind) =>
  `/${HOME_SLUG[locale]}/${LEGAL_SLUG[locale][kind]}/`;

export const absolute = (path) => new URL(path, SITE.url).href;
