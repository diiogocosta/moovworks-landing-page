/**
 * Refreshes the two self-hosted latin subsets.
 *
 *   npm run fonts
 *
 * The site never talks to Google at runtime — these woff2 files are committed
 * and served from our own origin. We deliberately do not use Astro's Google
 * provider here: it requests only the `wght` axis, and the display face needs
 * `wdth` too (see ARCHIVO_QUERY below).
 *
 * The script only downloads; it does not rewrite the config. If the upstream
 * unicode-range ever drifts from LATIN_UNICODE_RANGE in site.config.mjs it says
 * so loudly instead of silently shipping a font that misses glyphs.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { LATIN_UNICODE_RANGE } from '../site.config.mjs';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** `wdth` before `wght` — the CSS2 API requires alphabetical axis order. */
const ARCHIVO_QUERY = 'family=Archivo:wdth,wght@75..100,400..900';
/**
 * Pinned to the single weight the site actually renders. Google serves the
 * variable file (51 KB) for a range and a static instance (20 KB) for one
 * weight; the body is only ever weight 400, so the range would be dead bytes.
 */
const SERIF_QUERY = 'family=Source+Serif+4:wght@400';

const TARGETS = [
  { file: 'src/assets/fonts/archivo-latin.woff2', query: ARCHIVO_QUERY },
  { file: 'src/assets/fonts/source-serif-4-latin.woff2', query: SERIF_QUERY },
];

/** Google emits one @font-face per subset; we take the one covering Basic Latin. */
const LATIN_ANCHOR = 'U+0000-00FF';

function pickLatinFace(css) {
  const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  const latin = faces.find((face) => face.includes(LATIN_ANCHOR));
  if (!latin) throw new Error('no latin @font-face found in the Google CSS response');

  const url = latin.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
  if (!url) throw new Error('latin @font-face has no woff2 src');

  const unicodeRange = latin
    .match(/unicode-range:\s*([^;]+);/)?.[1]
    .split(',')
    .map((part) => part.trim())
    .join(', ');

  return { url, unicodeRange };
}

const normalize = (value) => value.replace(/\s+/g, '').toUpperCase();

let drifted = false;

for (const target of TARGETS) {
  const endpoint = `https://fonts.googleapis.com/css2?${target.query}&display=swap`;
  const response = await fetch(endpoint, { headers: { 'User-Agent': UA } });
  if (!response.ok) {
    throw new Error(`${endpoint} → HTTP ${response.status}`);
  }

  const { url, unicodeRange } = pickLatinFace(await response.text());

  if (normalize(unicodeRange) !== normalize(LATIN_UNICODE_RANGE)) {
    drifted = true;
    console.warn(`! unicode-range drift for ${target.file}`);
    console.warn(`    upstream: ${unicodeRange}`);
    console.warn(`    config:   ${LATIN_UNICODE_RANGE}`);
  }

  const font = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!font.ok) throw new Error(`${url} → HTTP ${font.status}`);

  const bytes = Buffer.from(await font.arrayBuffer());
  const destination = resolve(target.file);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);

  console.log(`ok ${target.file} (${bytes.length} bytes)`);
}

if (drifted) {
  console.warn('\nUpdate LATIN_UNICODE_RANGE in site.config.mjs to match upstream.');
}
