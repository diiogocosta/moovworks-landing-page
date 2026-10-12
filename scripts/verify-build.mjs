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
 *
 * A note on which files are checked. Every page that imports the stylesheet gets
 * it inlined, because `build.inlineStylesheets` is `always`. One page does not:
 * the language signpost at `/`, which imports no stylesheet and is a redirect
 * document. So a page is only held to the CSS assertions if it actually carries
 * an inlined `<style>` block. An earlier version of this script tested whichever
 * file the directory listing happened to return first, which on a filesystem with
 * a different entry order meant testing the signpost and failing the build for a
 * reason that did not exist. It now reads every page.
 */
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

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

const pages = await Promise.all(
  files.map(async (file) => ({ file, html: await readFile(file, "utf8") })),
);

/**
 * Only pages the build actually inlined the stylesheet into. The signpost at `/`
 * has none, so it is not evidence either way.
 */
const styled = pages.filter(({ html }) => html.includes("<style"));

const problems = [];

if (styled.length === 0) {
  problems.push(
    "no built page carries an inlined stylesheet. Check that " +
      "`build.inlineStylesheets` is still `always` in astro.config.mjs.",
  );
}

// A folded shorthand is a defect wherever it appears, styled or not.
for (const { file, html } of pages) {
  const folded = html.match(FOLDED_SHORTHAND);
  if (folded) {
    problems.push(
      `${relative(DIST, file)} folded a timeline into the \`animation\` shorthand ` +
        `(${folded[0]}), which Chromium rejects. Write the animation as ` +
        "longhands — see src/styles/global.css.",
    );
  }
}

/*
 * And these must be present in every styled page, not just the first one. The
 * stylesheet is inlined, so any page carries the whole thing: a page missing it
 * has lost the stylesheet outright.
 */
for (const { pattern, what } of REQUIRED) {
  const missing = styled
    .filter(({ html }) => !pattern.test(html))
    .map(({ file }) => relative(DIST, file));

  if (missing.length > 0) {
    problems.push(
      `${what} is missing from ${missing.length} of ${styled.length} styled ` +
        `page(s): ${missing.join(", ")}.`,
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
  `verify-build: ok — scroll-driven CSS intact across ${styled.length} ` +
    `styled page(s) of ${pages.length}.`,
);
