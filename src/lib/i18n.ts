/**
 * The trilingual dictionary, plus the handful of strings the brief leaves out.
 * Nothing in a component may hard-code copy — it all comes from here.
 */
import authoredContent from "../content/authored.json";
import content from "../content/i18n.json";
import uiStrings from "../content/ui.json";
import type { Locale } from "./site";

export interface Service {
  title: string;
  text: string;
}

export interface Dictionary {
  meta: { title: string; description: string };
  header: { contact: string };
  hero: { headline: string; sub: string; cta: string };
  services: Service[];
  about: { headline: string; text: string };
  contact: { headline: string; email: string; button: string };
  footer: { privacy: string; terms: string };
}

export interface UiDictionary {
  skip: string;
  languageNav: string;
  legalPlaceholder: string;
  backHome: string;
  toTop: string;
}

/**
 * Copy written for this build rather than supplied by the brief: the section
 * headings, and the principles band. Kept separate so `i18n.json` stays exactly
 * the deck the brief specifies.
 */
export interface AuthoredDictionary {
  sections: { services: string; principles: string };
  principles: Service[];
}

const dictionaries = content as Record<Locale, Dictionary>;
const interfaceStrings = uiStrings as unknown as Record<Locale, UiDictionary>;
const authored = authoredContent as unknown as Record<
  Locale,
  AuthoredDictionary
>;

/** The page copy for a locale. */
export const t = (locale: Locale): Dictionary => dictionaries[locale];

/** Labels and placeholders that sit outside the copy deck. */
export const ui = (locale: Locale): UiDictionary => interfaceStrings[locale];

/** Section headings and the principles band. */
export const a = (locale: Locale): AuthoredDictionary => authored[locale];
