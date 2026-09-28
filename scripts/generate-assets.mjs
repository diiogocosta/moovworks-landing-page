/**
 * Generates the two brand assets that are made of type.
 *
 *   npm run assets
 *
 * Both are cut from the real Archivo outlines, so the favicon and the share
 * card are the same letterforms as the site rather than an approximation. The
 * palette is read out of tokens.css, so the assets cannot drift from the
 * design system.
 *
 * Outputs are committed, which keeps the site build free of fonts, sharp and
 * the network. Re-run this only when the mark, the headline or the palette
 * changes.
 *
 * Note on inputs: fontkit cannot instance a WOFF2 variation (the woff2 tables
 * are stored transformed and the derived font loses its cmap), so this pulls
 * the variable TTFs from the google/fonts repository instead. They are cached
 * under .cache/ and never shipped.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { openSync } from 'fontkit';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const CACHE = resolve(ROOT, '.cache/fonts');

const FONTS = {
  display: {
    file: resolve(CACHE, 'Archivo-var.ttf'),
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf',
  },
};

/** Reads the palette from the design tokens rather than repeating it here. */
async function readPalette() {
  const css = await readFile(resolve(ROOT, 'src/styles/tokens.css'), 'utf8');
  const token = (name) => {
    const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
    if (!match) throw new Error(`token --${name} not found in tokens.css`);
    return match[1].toUpperCase();
  };
  return {
    concreto: token('concreto'),
    papel: token('papel'),
    tinta: token('tinta'),
    aco: token('aco'),
  };
}

async function download({ file, url }) {
  if (existsSync(file)) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  console.log(`fetched ${file}`);
}

/**
 * Turns a string into a single SVG path, with y flipped so the glyphs render
 * upright, and reports its advance width and ink bounding box.
 *
 * Kerning comes from the font's own GPOS lookups via `layout()`, which is the
 * whole reason to go through fontkit instead of placing glyphs by hand. The
 * bbox is what lets the layout be measured rather than guessed: `minY` is the
 * top of the ink, because the y flip makes up negative.
 */
function typeset(font, text, { size }) {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;

  let cursor = 0;
  let d = '';
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let index = 0; index < run.glyphs.length; index += 1) {
    const glyph = run.glyphs[index];
    const position = run.positions[index];
    const glyphPath = glyph.path
      .scale(scale, -scale)
      .translate(cursor + position.xOffset * scale, -position.yOffset * scale);

    cursor += position.xAdvance * scale;

    // Spaces carry no ink; letting them set the bbox would pad every measurement.
    if (glyphPath.commands.length === 0) continue;

    d += glyphPath.toSVG();
    const box = glyphPath.bbox;
    minX = Math.min(minX, box.minX);
    minY = Math.min(minY, box.minY);
    maxX = Math.max(maxX, box.maxX);
    maxY = Math.max(maxY, box.maxY);
  }

  return { d, width: cursor, bbox: { minX, minY, maxX, maxY } };
}

const path = (d, fill) => `<path d="${d}" fill="${fill}"/>`;

async function buildFavicon(tokens) {
  // 800 at the default width: a condensed 'm' at 16px turns to mud.
  const font = openSync(FONTS.display.file).getVariation({ wght: 800, wdth: 100 });

  const glyph = font.layout('m').glyphs[0];
  const box = glyph.path.bbox;
  const size = 32;
  const inset = 6;
  const target = size - inset * 2;

  const scale = target / (box.maxX - box.minX);
  // Centre the ink, not the em box: the glyph carries a left side bearing, and
  // ignoring it pushes the letter visibly off-centre in the tile.
  const offsetX = (size - (box.maxX - box.minX) * scale) / 2 - box.minX * scale;
  const baseline = size / 2 + ((box.minY + box.maxY) * scale) / 2;

  const d = glyph.path.scale(scale, -scale).translate(offsetX, baseline).toSVG();

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Moovworks">`,
    `<rect width="${size}" height="${size}" rx="2" fill="${tokens.tinta}"/>`,
    path(d, tokens.papel),
    '</svg>',
    '',
  ].join('\n');

  await writeFile(resolve(ROOT, 'public/favicon.svg'), svg);
  console.log('wrote public/favicon.svg');
}

const OG = { width: 1200, height: 630, margin: 72 };
const OG_LINES = ['No more', 'AI bullshit'];
const LEADING_RATIO = 0.92;

/** Lays the lines out at `size` and reports the ink box of the block as a whole. */
function layoutLines(font, lines, size) {
  const leading = size * LEADING_RATIO;

  const rendered = lines.map((line, index) => {
    const { d, bbox } = typeset(font, line, { size });
    return { d, baseline: index * leading, bbox };
  });

  const boxes = rendered.map(({ baseline, bbox }) => ({
    minX: bbox.minX,
    minY: baseline + bbox.minY,
    maxX: bbox.maxX,
    maxY: baseline + bbox.maxY,
  }));

  return {
    rendered,
    inkWidth: Math.max(...boxes.map((b) => b.maxX)) - Math.min(...boxes.map((b) => b.minX)),
    inkHeight: Math.max(...boxes.map((b) => b.maxY)) - Math.min(...boxes.map((b) => b.minY)),
  };
}

async function buildOpenGraph(tokens) {
  const base = openSync(FONTS.display.file);
  const headlineFont = base.getVariation({ wght: 800, wdth: 80 });
  const wordmarkFont = base.getVariation({ wght: 700, wdth: 100 });
  const detailFont = base.getVariation({ wght: 500, wdth: 90 });

  // The band the headline has to occupy: clear of the wordmark above and the
  // date below, rather than flush against them.
  const band = { top: 158, bottom: 494 };
  const available = {
    width: OG.width - OG.margin * 2,
    height: band.bottom - band.top,
  };

  // Measure once at a unit size, then solve for the size that fills the band
  // on whichever axis binds first. No hand-tuned magic number.
  const unit = 100;
  const probe = layoutLines(headlineFont, OG_LINES, unit);
  const size =
    unit *
    Math.min(available.width / probe.inkWidth, available.height / probe.inkHeight);

  const headline = layoutLines(headlineFont, OG_LINES, size);

  // Anchor the ink to the left margin and centre it in the band.
  const shiftX = OG.margin - Math.min(...headline.rendered.map((r) => r.bbox.minX));
  const shiftY =
    (band.top + band.bottom) / 2 -
    (Math.min(...headline.rendered.map((r) => r.baseline + r.bbox.minY)) +
      Math.max(...headline.rendered.map((r) => r.baseline + r.bbox.maxY))) /
      2;

  const headlineParts = headline.rendered.map(
    ({ d, baseline }) =>
      `<g transform="translate(${shiftX} ${shiftY + baseline})">${path(d, tokens.tinta)}</g>`,
  );

  const wordmark = typeset(wordmarkFont, 'moovworks', { size: 34 });
  const since = typeset(detailFont, 'Since 2011.', { size: 26 });

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG.width}" height="${OG.height}" viewBox="0 0 ${OG.width} ${OG.height}">`,
    `<rect width="${OG.width}" height="${OG.height}" fill="${tokens.concreto}"/>`,
    `<g transform="translate(${OG.margin} ${OG.margin + 30})">${path(wordmark.d, tokens.tinta)}</g>`,
    ...headlineParts,
    `<g transform="translate(${OG.margin} ${OG.height - OG.margin})">${path(since.d, tokens.aco)}</g>`,
    '</svg>',
    '',
  ].join('\n');

  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(resolve(ROOT, 'public/og.png'));
  console.log(`wrote public/og.png (${OG.width}x${OG.height}, headline ${Math.round(size)}px)`);
}

const tokens = await readPalette();
await download(FONTS.display);
await mkdir(resolve(ROOT, 'public'), { recursive: true });
await buildFavicon(tokens);
await buildOpenGraph(tokens);
