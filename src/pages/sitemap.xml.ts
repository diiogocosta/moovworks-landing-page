import type { APIRoute } from 'astro';
import {
  LEGAL_KINDS,
  LEGAL_PUBLISHED,
  LOCALES,
  absolute,
  homePath,
  legalPath,
} from '../lib/site';
import { homeAlternates, legalAlternates } from '../lib/seo';
import type { Alternate } from '../lib/seo';

interface Entry {
  loc: string;
  alternates: Alternate[];
}

/**
 * Every page is in exactly one alternate group: the three home pages plus the
 * entry point, and (once they carry real copy) each legal page across the three
 * locales.
 *
 * `lastmod` is deliberately omitted — the build date is not a meaningful change
 * date, and asserting it would only teach crawlers to distrust the file.
 */
const entries: Entry[] = [
  { loc: absolute('/'), alternates: homeAlternates() },
  ...LOCALES.map((locale) => ({
    loc: absolute(homePath(locale)),
    alternates: homeAlternates(),
  })),
  ...(LEGAL_PUBLISHED
    ? LEGAL_KINDS.flatMap((kind) =>
        LOCALES.map((locale) => ({
          loc: absolute(legalPath(locale, kind)),
          alternates: legalAlternates(kind),
        })),
      )
    : []),
];

const escape = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const renderEntry = ({ loc, alternates }: Entry) => {
  const links = alternates
    .map(
      (alternate) =>
        `    <xhtml:link rel="alternate" hreflang="${escape(alternate.hreflang)}" href="${escape(alternate.href)}"/>`,
    )
    .join('\n');

  return `  <url>\n    <loc>${escape(loc)}</loc>\n${links}\n  </url>`;
};

export const GET: APIRoute = () => {
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.map(renderEntry),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
