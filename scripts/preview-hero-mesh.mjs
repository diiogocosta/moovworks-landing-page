/**
 * Renders the baked hero mesh to a PNG, with no browser involved.
 *
 *   npm run mesh:preview   →  .cache/hero-mesh-preview.png
 *
 * The point of this file is to be able to tell the baker's mistakes apart from
 * the renderer's. When the hero was first wired up it drew irregular slabs
 * instead of letterforms, and the cause turned out to be three separate
 * indexing errors in the bake — all of which this makes obvious in about two
 * seconds, because it draws the triangulation itself rather than shading it.
 *
 * A correct run shows the headline twice: once as triangle fills, once as
 * stroked contour rings tracing the outlines.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const ROOT = resolve(import.meta.dirname, "..");
const POINT_STRIDE = 4;
const INDEX_STRIDE = 2;

/** Drawn at a size where the counters are unambiguous. */
const FONT = 200;
const MARGIN = 40;
const WIDTH = 2200;
const LINE_LEADING = 0.92;

const meta = JSON.parse(
  await readFile(resolve(ROOT, "src/assets/type/hero-mesh.json"), "utf8"),
);
const bin = await readFile(resolve(ROOT, "src/assets/type/hero-mesh.bin"));
const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
const scale = meta.quant.scale;

const colour = { concrete: "#E3E4DF", ink: "#14213D", marker: "#F5D90A" };

const WIDTH_PX = WIDTH;
const HEIGHT_PX =
  MARGIN * 2 + FONT * (1 + (meta.lines.length - 1) * LINE_LEADING) + 60;

const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH_PX}" height="${HEIGHT_PX}" viewBox="0 0 ${WIDTH_PX} ${HEIGHT_PX}">`,
  `<rect width="${WIDTH_PX}" height="${HEIGHT_PX}" fill="${colour.concrete}"/>`,
];

const report = [];

/*
 * The buffer is all points first, then all indices — so a line's index block
 * starts after every line's points, not at zero. Reading it from the per-line
 * offset alone is what "renders the point data as triangle indices".
 */
let pointBase = 0;
let indexBase =
  meta.lines.reduce((total, line) => total + line.points, 0) * POINT_STRIDE;

for (const [index, line] of meta.lines.entries()) {
  const readX = (i) =>
    view.getInt16(pointBase + i * POINT_STRIDE, true) / scale;
  const readY = (i) =>
    view.getInt16(pointBase + i * POINT_STRIDE + 2, true) / scale;

  const baseline = MARGIN + FONT * (0.72 + index * LINE_LEADING);
  const toX = (i) => MARGIN + readX(i) * FONT;
  const toY = (i) => baseline - readY(i) * FONT;

  let triangles = "";
  let outOfRange = 0;
  for (let i = 0; i < line.indices; i += 3) {
    const a = view.getUint16(indexBase + i * INDEX_STRIDE, true);
    const b = view.getUint16(indexBase + (i + 1) * INDEX_STRIDE, true);
    const c = view.getUint16(indexBase + (i + 2) * INDEX_STRIDE, true);
    if (a >= line.points || b >= line.points || c >= line.points)
      outOfRange += 1;
    triangles +=
      `M${toX(a).toFixed(1)} ${toY(a).toFixed(1)}` +
      `L${toX(b).toFixed(1)} ${toY(b).toFixed(1)}` +
      `L${toX(c).toFixed(1)} ${toY(c).toFixed(1)}Z`;
  }

  let rings = "";
  for (const contour of line.contours) {
    for (let k = 0; k < contour.count; k += 1) {
      const p = contour.start + k;
      const q = contour.start + ((k + 1) % contour.count);
      rings +=
        `M${toX(p).toFixed(1)} ${toY(p).toFixed(1)}` +
        `L${toX(q).toFixed(1)} ${toY(q).toFixed(1)}`;
    }
  }

  parts.push(
    `<path d="${triangles}" fill="${colour.ink}" fill-opacity="0.32" fill-rule="nonzero"/>`,
  );
  parts.push(
    `<path d="${rings}" stroke="${colour.marker}" stroke-width="1.2" fill="none"/>`,
  );

  report.push(
    `"${line.text}": ${line.points} points, ${line.indices / 3} triangles, ` +
      `${line.contours.length} contours, out-of-range indices ${outOfRange}`,
  );

  pointBase += line.points * POINT_STRIDE;
  indexBase += line.indices * INDEX_STRIDE;
}

parts.push("</svg>");

await mkdir(resolve(ROOT, ".cache"), { recursive: true });
const output = resolve(ROOT, ".cache/hero-mesh-preview.png");
await sharp(Buffer.from(parts.join("\n")))
  .png()
  .toFile(output);

console.log(report.join("\n"));
console.log(`wrote ${output}`);
