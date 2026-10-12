/**
 * Asserts that the scroll-driven CSS survived the build.
 *
 *   npm run build   (runs this automatically)
 *
 * Why this exists: Astro's style compiler folds `animation-timeline` into the
 * `animation` shorthand when both are declared in the same rule. Writing
 *
 *     animation: reveal-in linear both;
 *     animation-timeline: view();
 *
 * comes out of the build as `animation: linear both reveal-in view()`, and
 * Chromium rejects that shorthand form — `CSS.supports('animation', '... view()')`
 * is false — so the whole declaration is dropped. The result is not a visible
 * error: the sticky header simply never solidifies and every reveal simply never
 * runs, on every page, in production only. `astro dev` does not transform the
 * CSS this way, so it looks fine locally.
 *
 * The fix is to write the animation as longhands. This checks that the fix is
 * still in place, and that the enhancement has not quietly disappeared.
 */
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = resolve(ROOT, "dist");

/** An `animation:` shorthand carrying a timeline function, which browsers reject. */
const FOLDED_SHORTHAND = /animation:[^;{}]*\b(?:view|scroll)\(/;

/** The declarations that must survive for the enhancement to work at all. */
const REQUIRED = [
  {
    pattern: /animation-timeline:view\(\)/,
    what: "the reveal view() timeline",
  },
  { pattern: /animation-name:reveal-in/, what: "the reveal keyframes" },
  {
    pattern: /animation-timeline:scroll\(/,
    what: "the header scroll() timeline",
  },
  { pattern: /animation-name:header-solid/, what: "the header keyframes" },
];

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

let files;
try {
  files = await htmlFiles(DIST);
} catch {
  console.error("verify-build: dist/ not found — run the build first.");
  process.exit(1);
}

if (files.length === 0) {
  console.error("verify-build: no HTML in dist/.");
  process.exit(1);
}

const problems = [];

// The stylesheet is inlined, so any page carries the whole thing; checking them
// all just means a page that somehow lost it is caught too.
const first = await readFile(files[0], "utf8");
const css = first;

if (FOLDED_SHORTHAND.test(css)) {
  problems.push(
    "the build folded a timeline into the `animation` shorthand " +
      `(${css.match(FOLDED_SHORTHAND)?.[0]}), which Chromium rejects. ` +
      "Write the animation as longhands — see src/styles/global.css.",
  );
}

for (const { pattern, what } of REQUIRED) {
  if (!pattern.test(css)) {
    problems.push(
      `${what} is missing from the built CSS (looked for ${pattern}).`,
    );
  }
}

if (problems.length > 0) {
  console.error("\nverify-build failed:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("");
  process.exit(1);
}

console.log(
  `verify-build: ok — scroll-driven CSS intact across ${files.length} page(s).`,
);
