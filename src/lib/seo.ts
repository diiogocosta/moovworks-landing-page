/**
 * Head metadata shared by every route: canonical, cross-linked hreflang,
 * Open Graph, Twitter card and the JSON-LD Organization node.
 */
import {
  LOCALES,
  OG_LOCALE,
  SITE,
  absolute,
  homePath,
  legalPath,
} from "./site";
import type { LegalKind, Locale } from "./site";

export interface Alternate {
  hreflang: string;
  href: string;
}

export const homeAlternates = (): Alternate[] => [
  ...LOCALES.map((locale) => ({
    hreflang: locale,
    href: absolute(homePath(locale)),
  })),
  // `/` is the entry point: it picks a locale from Accept-Language or the
  // visitor's previous choice, so it is the sensible default for crawlers too.
  { hreflang: "x-default", href: absolute("/") },
];

export const legalAlternates = (kind: LegalKind): Alternate[] => [
  ...LOCALES.map((locale) => ({
    hreflang: locale,
    href: absolute(legalPath(locale, kind)),
  })),
  { hreflang: "x-default", href: absolute(legalPath("pt-BR", kind)) },
];

export const openGraphLocales = (
  locale: Locale,
): {
  primary: string;
  alternates: string[];
} => ({
  primary: OG_LOCALE[locale],
  alternates: LOCALES.filter((other) => other !== locale).map(
    (other) => OG_LOCALE[other],
  ),
});

export const organizationJsonLd = (locale: Locale, description: string) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  url: absolute("/"),
  logo: absolute("/favicon.svg"),
  email: SITE.email,
  foundingDate: SITE.founded,
  description,
  inLanguage: locale,
});
