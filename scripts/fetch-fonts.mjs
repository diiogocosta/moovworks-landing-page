/**
 * Refreshes the two self-hosted latin subsets.
 *
 *   npm run fonts
 *
 * The site never talks to Google at runtime: these woff2 files are committed and
 * served from our own origin. We deliberately do not use Astro's Google provider
 * here, because it pins the axis set and Inter's optical size axis is worth
 * keeping (see SERIF-style note in astro.config.mjs).
 *
 * The script only downloads; it does not rewrite the config. If the upstream
 * unicode-range ever drifts from LATIN_UNICODE_RANGE in site.config.mjs it says
 * so loudly instead of silently shipping a font that misses glyphs.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { LATIN_UNICODE_RANGE } from "../site.config.mjs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * `opsz` before `wght` — the CSS2 API requires alphabetical axis order, and the
 * two axes must be requested together to get the variable file. Inter's optical
 * size axis runs 14 to 32: the browser then picks the text cut at body sizes and
 * the display cut at heading sizes from the same file, which is the main reason
 * this is Inter and not something with a single axis.
 */
const INTER_QUERY = "family=Inter:opsz,wght@14..32,100..900";
/**
 * The mono is only ever set at 400 and 500, so the range stops there rather than
 * shipping the full 100-800 axis as dead bytes.
 */
const MONO_QUERY = "family=JetBrains+Mono:wght@400..500";

const TARGETS = [
  { file: "src/assets/fonts/inter-latin.woff2", query: INTER_QUERY },
  { file: "src/assets/fonts/jetbrains-mono-latin.woff2", query: MONO_QUERY },
];

/** Google emits one @font-face per subset; we take the one covering Basic Latin. */
const LATIN_ANCHOR = "U+0000-00FF";

function pickLatinFace(css) {
  const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  const latin = faces.find((face) => face.includes(LATIN_ANCHOR));
  if (!latin)
    throw new Error("no latin @font-face found in the Google CSS response");

  const url = latin.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
  if (!url) throw new Error("latin @font-face has no woff2 src");

  const unicodeRange = latin
    .match(/unicode-range:\s*([^;]+);/)?.[1]
    .split(",")
    .map((part) => part.trim())
    .join(", ");

  return { url, unicodeRange };
}

const normalize = (value) => value.replace(/\s+/g, "").toUpperCase();

let drifted = false;

for (const target of TARGETS) {
  const endpoint = `https://fonts.googleapis.com/css2?${target.query}&display=swap`;
  const response = await fetch(endpoint, { headers: { "User-Agent": UA } });
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

  const font = await fetch(url, { headers: { "User-Agent": UA } });
  if (!font.ok) throw new Error(`${url} → HTTP ${font.status}`);

  const bytes = Buffer.from(await font.arrayBuffer());
  const destination = resolve(target.file);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);

  console.log(`ok ${target.file} (${bytes.length} bytes)`);
}

if (drifted) {
  console.warn(
    "\nUpdate LATIN_UNICODE_RANGE in site.config.mjs to match upstream.",
  );
}
