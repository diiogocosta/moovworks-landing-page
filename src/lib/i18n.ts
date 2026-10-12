/**
 * The trilingual copy deck, plus the handful of interface strings the brief
 * leaves out. Nothing in a component may hard-code copy: it all comes from here.
 *
 * The deck is a single file (`src/content/copy.json`) rather than the three it
 * used to be. The old split existed to keep one file byte-identical to the
 * original brief, which no longer describes this site, and it cost two extra
 * casts and two extra accessors for no benefit.
 */
import copy from "../content/copy.json";
import type { Locale } from "./site";

/**
 * A service card. The four parts are the shape of the sell, and they are
 * deliberately separate rather than one paragraph: `outcome` is the line that
 * makes someone want the thing, and it is set in the accent so it cannot be
 * mistaken for body copy.
 */
export interface Service {
  /** The mono label on the card. */
  kicker: string;
  title: string;
  /** One line, the reason to care. */
  outcome: string;
  /** The honest paragraph behind the claim. */
  text: string;
  /** Short deliverable names, rendered as chips. */
  includes: string[];
}

export interface Principle {
  title: string;
  text: string;
}

export interface Copy {
  meta: { title: string; description: string };
  header: { contact: string };
  /** No headline here. That is English in every locale and lives in
   * `site.config.mjs`, because the page and the OG card are both built from it. */
  hero: { badge: string; sub: string; cta: string; ctaSecondary: string };
  services: {
    title: string;
    lead: string;
    items: Service[];
    /** The fifth cell: the invitation, not a service. */
    invite: { title: string; text: string; cta: string };
  };
  process: { title: string; lead: string; from: string; to: string };
  principles: { title: string; lead: string; items: Principle[] };
  about: { headline: string; text: string };
  contact: { title: string; text: string; cta: string };
  footer: { contact: string; privacy: string; terms: string };
  ui: {
    skip: string;
    languageNav: string;
    legalPlaceholder: string;
    backHome: string;
    toTop: string;
  };
}

/**
 * A plain assertion, deliberately, and not `as unknown as`. The `unknown` hop
 * switches TypeScript off, so a key that is renamed in one locale and not the
 * others renders as an empty string with a green build. Without it the compiler
 * compares the JSON's actual shape to `Copy` and fails the build instead, which
 * is the only translation check this site has. `npm run build` runs `astro check`
 * first for exactly this reason.
 */
const dictionaries = copy as Record<Locale, Copy>;

/** The page copy for a locale. */
export const t = (locale: Locale): Copy => dictionaries[locale];
