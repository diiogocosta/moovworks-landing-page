/**
 * Typed facade over `site.config.mjs`.
 *
 * The raw config stays plain ESM so that `astro.config.mjs` and the Node scripts
 * in `scripts/` can import it without a build step. This module narrows it for
 * the Astro components, where the locale unions actually matter.
 */
import * as raw from '../../site.config.mjs';

export type Locale = 'pt-BR' | 'pt-PT' | 'en';
export type LegalKind = 'privacy' | 'terms';

export const SITE = raw.SITE as {
  name: string;
  url: string;
  email: string;
  founded: string;
};

export const LOCALES = raw.LOCALES as readonly Locale[];
export const DEFAULT_LOCALE = raw.DEFAULT_LOCALE as Locale;
export const OG_LOCALE = raw.OG_LOCALE as Record<Locale, string>;
export const LEGAL_KINDS = raw.LEGAL_KINDS as readonly LegalKind[];
export const LEGAL_PUBLISHED = raw.LEGAL_PUBLISHED as boolean;
export const LANG_LABEL: Record<Locale, string> = {
  'pt-BR': 'PT-BR',
  'pt-PT': 'PT-PT',
  en: 'EN',
};

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

/** URL segment for a locale's home page: `pt-BR` → `pt-br`. */
export const slugFor = (locale: Locale): string =>
  (raw.HOME_SLUG as Record<Locale, string>)[locale];

export const legalSlugFor = (locale: Locale, kind: LegalKind): string =>
  (raw.LEGAL_SLUG as Record<Locale, Record<LegalKind, string>>)[locale][kind];

export const homePath = (locale: Locale): string => raw.homePath(locale);

export const legalPath = (locale: Locale, kind: LegalKind): string =>
  raw.legalPath(locale, kind);

export const absolute = (path: string): string => raw.absolute(path);
