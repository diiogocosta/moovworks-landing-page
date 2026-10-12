/**
 * Bakes the hero headline into a GPU-ready mesh.
 *
 *   npm run mesh
 *
 * The headline is a fixed string, so all the expensive work — instancing the
 * font, flattening the curves, resolving the counters as holes, triangulating —
 * can happen once, here, instead of in every visitor's browser.
 *
 * That is also why this uses three.js at build time and not at runtime: the
 * renderer alone costs ~180 KB gzipped and defeats tree-shaking, while the
 * static geometry it would build costs a few tens of KB of packed integers.
 * three is a devDependency; none of it ships.
 *
 * Output:
 *   hero-mesh.json  layout metrics, contour ranges, provenance
 *   hero-mesh.bin   Int16 quantised points, then Uint16 triangle indices
 *
 * Units are em with the baseline at y = 0 and y up, matching three's own
 * convention, so the runtime only has to scale by the rendered font size.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { openSync } from "fontkit";
import { ShapePath, ShapeUtils } from "three";

const ROOT = resolve(import.meta.dirname, "..");

const SOURCE = {
  file: resolve(ROOT, ".cache/fonts/Archivo-var.ttf"),
  url: "https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf",
};

/** Matches the hero's CSS: Archivo 800, wdth 85. */
const VARIATION = { wght: 800, wdth: 85 };

/** Identical in all three locales, so it is baked once. */
const LINES = ["No more", "AI bullshit"];

/** Points sampled per curved segment. The only real lever on output size. */
const CURVE_SEGMENTS = 8;

/**
 * Positions are stored as Int16 in em. Int16 holds ±32767, so 4000 caps the
 * coordinate range at ±8.19em — this headline spans about 4.4em, and the
 * precision of 1/4000em is 0.04px at the largest rendered size.
 *
 * Checked rather than assumed: see the bounds assertion before packing.
 */
const QUANT = 4000;
const QUANT_MAX = 32767 / QUANT;

const TAGS = {
  moveTo: "M",
  lineTo: "L",
  quadraticCurveTo: "Q",
  bezierCurveTo: "C",
  closePath: "Z",
};

const JSON_OUTPUT = resolve(ROOT, "src/assets/type/hero-mesh.json");
const BIN_OUTPUT = resolve(ROOT, "src/assets/type/hero-mesh.bin");

async function download() {
  if (existsSync(SOURCE.file)) return;
  const response = await fetch(SOURCE.url);
  if (!response.ok) throw new Error(`${SOURCE.url} → HTTP ${response.status}`);
  await mkdir(dirname(SOURCE.file), { recursive: true });
  await writeFile(SOURCE.file, Buffer.from(await response.arrayBuffer()));
  console.log(`fetched ${SOURCE.file}`);
}

/**
 * Replays the baked contours into a ShapePath so three can resolve the counters
 * as holes. `toShapes()` finds them with an even-odd ray cast rather than by
 * winding order, so the y-up font coordinates need no reorienting.
 *
 * Unit discipline is the whole difficulty here: glyph outlines and advances come
 * in font units (1000 to the em for Archivo), the cursor is tracked in em, and
 * the output must be em. Everything inside this function is converted on the way
 * in, and only `toEm` is allowed to divide — mixing the two silently produces
 * coordinates in the hundreds of em, which the bounds check does catch.
 */
function toShapes(font, text) {
  const run = font.layout(text);
  const path = new ShapePath();
  const toEm = (fontUnits) => fontUnits / font.unitsPerEm;

  // ShapePath has no closePath, so contours are closed by hand — and only when
  // the outline does not already return to its start, to avoid zero-length edges.
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  /** Pen position in font units; converted only where a coordinate is emitted. */
  let pen = 0;

  const closeContour = () => {
    if (lastX !== startX || lastY !== startY) path.lineTo(startX, startY);
  };

  for (let index = 0; index < run.glyphs.length; index += 1) {
    const glyph = run.glyphs[index];
    const { xOffset, xAdvance } = run.positions[index];
    const shift = pen + xOffset;

    const emitX = (value) => toEm(value + shift);
    const emitY = (value) => toEm(value);

    for (const { command, args } of glyph.path.commands) {
      switch (command) {
        case "moveTo":
          closeContour();
          path.moveTo(emitX(args[0]), emitY(args[1]));
          [startX, startY] = [emitX(args[0]), emitY(args[1])];
          [lastX, lastY] = [startX, startY];
          break;

        case "lineTo":
          path.lineTo(emitX(args[0]), emitY(args[1]));
          [lastX, lastY] = [emitX(args[0]), emitY(args[1])];
          break;

        case "quadraticCurveTo":
          path.quadraticCurveTo(
            emitX(args[0]),
            emitY(args[1]),
            emitX(args[2]),
            emitY(args[3]),
          );
          [lastX, lastY] = [emitX(args[2]), emitY(args[3])];
          break;

        case "bezierCurveTo":
          path.bezierCurveTo(
            emitX(args[0]),
            emitY(args[1]),
            emitX(args[2]),
            emitY(args[3]),
            emitX(args[4]),
            emitY(args[5]),
          );
          [lastX, lastY] = [emitX(args[4]), emitY(args[5])];
          break;

        case "closePath":
          closeContour();
          [lastX, lastY] = [startX, startY];
          break;

        default:
          throw new Error(`unhandled path command: ${command}`);
      }
    }

    closeContour();
    [lastX, lastY] = [startX, startY];
    pen += xAdvance;
  }

  return { shapes: path.toShapes(), advance: toEm(run.advanceWidth) };
}

/** Signed area of a ring, by the shoelace formula. */
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const j = (i + 1) % ring.length;
    sum += ring[i].x * ring[j].y - ring[j].x * ring[i].y;
  }
  return Math.abs(sum) / 2;
}

function bakeLine(font, text) {
  const { shapes, advance } = toShapes(font, text);

  const points = [];
  const contours = [];
  const indices = [];

  /*
   * Vertex-based bookkeeping, not float-based. `points` holds interleaved x and
   * y, so its length is twice the vertex count — and both the contour starts and
   * the triangle indices have to be vertex indices, because that is what
   * `triangulateShape` returns and what the runtime reads with.
   */
  let vertices = 0;

  // Every shape's inked area, and the area its triangles actually cover. These
  // must agree: if the indices are off by even one vertex the triangles span the
  // wrong points and the sum diverges, which is the failure mode that silently
  // renders as slabs rather than letterforms.
  let outlineArea = 0;
  let triangleArea = 0;

  for (const shape of shapes) {
    // Flattened once, here, so the runtime never sees a bezier.
    const { shape: outer, holes } = shape.extractPoints(CURVE_SEGMENTS);

    /*
     * This must run before the rings are recorded, not after. It mutates them —
     * dropping a closing point that duplicates the first — and the triangles it
     * returns index the mutated arrays. Exporting the pre-mutation rings leaves
     * every index one vertex out of step from the second contour onwards.
     */
    const triangles = ShapeUtils.triangulateShape(outer, holes);

    const rings = [outer, ...holes];
    const start = vertices;

    // `extractPoints` returns the outer ring first, then its counters, and
    // `triangulateShape` indexes them in that same order. The flag travels with
    // the contour because the runtime has to know which rings are holes in order
    // to face the extruded side walls the right way.
    //
    // `contour.start` is an absolute vertex index into this line's point list,
    // not an offset within the shape. The runtime walks the contours to build the
    // extruded walls and indexes the points directly; a per-shape offset would
    // silently stitch together vertices from different letters.
    rings.forEach((ring, ringIndex) => {
      contours.push({
        start: vertices,
        count: ring.length,
        hole: ringIndex > 0,
      });
      for (const point of ring) points.push(point.x, point.y);
      vertices += ring.length;
    });

    outlineArea += ringArea(outer);
    for (const hole of holes) outlineArea -= ringArea(hole);

    const block = rings.flat();
    for (const triangle of triangles) {
      indices.push(
        start + triangle[0],
        start + triangle[1],
        start + triangle[2],
      );
      triangleArea += ringArea([
        block[triangle[0]],
        block[triangle[1]],
        block[triangle[2]],
      ]);
    }
  }

  const drift = Math.abs(triangleArea - outlineArea) / outlineArea;
  if (drift > 0.001) {
    throw new Error(
      `triangulation does not match the outline for "${text}": ` +
        `outline ${outlineArea.toFixed(4)}em² vs triangles ${triangleArea.toFixed(4)}em² ` +
        `(${(drift * 100).toFixed(2)}% off)`,
    );
  }

  return { text, advance, points, contours, indices };
}

/** The block extent in em, reported so the quantisation range stays honest. */
function blockBounds(lines) {
  const coords = lines.flatMap((line) => line.points);
  const xs = coords.filter((_, index) => index % 2 === 0);
  const ys = coords.filter((_, index) => index % 2 === 1);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function pack(lines) {
  let pointTotal = 0;
  let indexTotal = 0;
  for (const line of lines) {
    pointTotal += line.points.length / 2;
    indexTotal += line.indices.length;
  }

  // One allocation each: Int16 points, then Uint16 indices, laid out per line
  // in declaration order. Indices start at an even byte offset because every
  // Int16 pair is 2 bytes wide.
  const pointBytes = Buffer.alloc(pointTotal * 2 * 2);
  const indexBytes = Buffer.alloc(indexTotal * 2);

  let pointOffset = 0;
  let indexOffset = 0;

  for (const line of lines) {
    for (let i = 0; i < line.points.length; i += 2) {
      const x = Math.round(line.points[i] * QUANT);
      const y = Math.round(line.points[i + 1] * QUANT);
      if (!Number.isFinite(x) || !Number.isFinite(y))
        throw new Error("non-finite point");
      pointBytes.writeInt16LE(x, pointOffset);
      pointBytes.writeInt16LE(y, pointOffset + 2);
      pointOffset += 4;
    }

    for (const value of line.indices) {
      indexBytes.writeUInt16LE(value, indexOffset);
      indexOffset += 2;
    }
  }

  return {
    buffer: Buffer.concat([pointBytes, indexBytes]),
    counts: lines.map((line) => ({
      points: line.points.length / 2,
      indices: line.indices.length,
    })),
  };
}

await download();

const font = openSync(SOURCE.file).getVariation(VARIATION);
const baked = LINES.map((text) => bakeLine(font, text));
const bounds = blockBounds(baked);

const reach = Math.max(
  Math.abs(bounds.minX),
  Math.abs(bounds.maxX),
  Math.abs(bounds.minY),
  Math.abs(bounds.maxY),
);
if (reach > QUANT_MAX) {
  throw new Error(
    `outlines span ${reach.toFixed(2)}em but QUANT=${QUANT} only covers ` +
      `${QUANT_MAX.toFixed(2)}em; lower QUANT to ${Math.floor(32767 / reach)}`,
  );
}

const { buffer, counts } = pack(baked);

const metadata = {
  source: {
    family: "Archivo",
    variation: VARIATION,
    curveSegments: CURVE_SEGMENTS,
    units: "em, baseline at y=0, y up",
    note: "Generated by scripts/bake-hero-mesh.mjs. Do not edit.",
  },
  quant: { scale: QUANT },
  lines: baked.map((line, index) => ({
    text: line.text,
    advance: Number(line.advance.toFixed(4)),
    points: counts[index].points,
    indices: counts[index].indices,
    contours: line.contours,
  })),
};

await mkdir(dirname(JSON_OUTPUT), { recursive: true });
await writeFile(JSON_OUTPUT, `${JSON.stringify(metadata, null, 2)}\n`);
await writeFile(BIN_OUTPUT, buffer);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(
  `wrote ${JSON_OUTPUT} ${kb(Buffer.byteLength(JSON.stringify(metadata)))}\n` +
    `wrote ${BIN_OUTPUT} ${kb(buffer.length)}\n` +
    `  ${counts.reduce((n, c) => n + c.points, 0)} points, ` +
    `${counts.reduce((n, c) => n + c.indices / 3, 0)} triangles\n` +
    `  contours per line: ${baked.map((l) => l.contours.length).join(", ")}\n` +
    `  bounds: x ${bounds.minX.toFixed(3)}..${bounds.maxX.toFixed(3)}  ` +
    `y ${bounds.minY.toFixed(3)}..${bounds.maxY.toFixed(3)} em`,
);
