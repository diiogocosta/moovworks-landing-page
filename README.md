# moovworks

The moovworks.com institutional site: one page, three languages, static, with the
headline set as an extruded 3D sculpture in WebGL.

> **`spec.md` is intentionally untracked.** It is the brief this was built from, not an
> artefact of it. It is listed in `.gitignore`.
>
> **The brief was revised for the 3D hero.** The original forbade 3D libraries, parallax
> and any budget over 150 KB. Sections 2, 4.5, 10, 11 and 13 now permit one WebGL layer,
> pointer parallax and scroll drift, and a 200 KB budget — while still banning the
> generated look (mesh gradients, spinning logos, decorative glow). That revision is local
> only, because the file is untracked.

## Stack, and why

| Choice | Reason |
| --- | --- |
| **Astro 7, `output: 'static'`** | Ships zero JavaScript to the client by default, and renders the three languages from one route file so they cannot drift apart. No UI framework, no Tailwind. |
| **Hand-written CSS** | One `tokens.css` is the single source of truth for the palette, the families and the fluid scale. Subdomains are expected to import it unchanged. |
| **Self-hosted fonts** | Two `woff2` files, latin subset, served from our own origin. Committed, so the build needs no network and no visitor request ever reaches Google. |
| **A bespoke WebGL renderer for the hero** | three.js costs ~180 KB gzipped, because `WebGLRenderer` defeats tree-shaking. The scene needs one static extruded solid lit by two directional lights, so the geometry is baked at build time and shaded by ~4 KB of our own code. three is used *at build time only*. |
| **No analytics, no cookie banner** | Nothing is tracked, so there is nothing to consent to. |
| **Asset generation is offline** | `public/favicon.svg`, `public/og.png` and the hero mesh are committed outputs of scripts. The site build runs no browser and does no font parsing. |

## Requirements

Node **20.3+** (the scripts use `import.meta.dirname`; the project is developed on 22).

## Commands

```bash
npm install
npm run dev       # local server
npm run build     # static output in dist/
npm run preview   # serve dist/ exactly as a host would
npm run check     # type check (astro check)

npm run fonts         # re-fetch the two woff2 subsets      (needs network)
npm run mesh          # re-bake the hero type geometry       (needs network on first run)
npm run mesh:preview  # render the baked mesh to a PNG      (no browser)
npm run assets        # regenerate favicon.svg + og.png     (needs network on first run)
```

The four maintenance commands are not build steps. Their inputs are cached under
`.cache/` and their outputs committed, so day-to-day work never needs any of them.

`mesh:preview` is the important one after touching the bake: it draws the geometry and
its triangulation straight to an image, so a mistake in the baker can be told apart from
a mistake in the renderer in about two seconds.

## Layout

```
site.config.mjs          domain, contact address, founding year, route slugs, unicode range
astro.config.mjs         Astro config, including the font pipeline
src/content/i18n.json    the copy deck, exactly as the brief specifies it
src/content/ui.json      strings the brief does not cover (skip link, legal placeholders)
src/content/buzzwords.ts the hero's buzzword field: text, anchors, sizes, timings
src/lib/site.ts          typed facade over site.config.mjs
src/lib/i18n.ts          dictionaries
src/lib/seo.ts           hreflang groups and the JSON-LD Organization node
src/styles/tokens.css    the design system. Subdomains import this file
src/components/          one file per block of the page
src/layouts/BaseLayout.astro  head, metadata, and the only inline scripts
src/scripts/hero-3d.ts   the WebGL sculpture
src/assets/type/         the baked hero mesh (generated — do not edit)
src/pages/index.astro    the Accept-Language signpost at /
src/pages/[locale]/      /pt-br/, /pt-pt/, /en/ and the legal stubs
scripts/                 font fetching, mesh baking, asset generation
```

### Adding a fourth language

1. Add the tag to `LOCALES` in `site.config.mjs`, plus its `HOME_SLUG`, `LEGAL_SLUG`
   and `OG_LOCALE` entries.
2. Add a key to `src/content/i18n.json` and `src/content/ui.json`.

Nothing else: the route, the language switcher, the `hreflang` links and the sitemap
all derive from those two places.

### Adding a products section

When subdomains go live, insert the section between `<Services />` and `<About />` in
`src/components/HomePage.astro`. The comment marking the spot is already there. Nothing
else on the page depends on that ordering.

## How the hero works

Two versions of the same idea, and the page picks one.

**The CSS version** is the baseline. The buzzword field is markup plus CSS only — no
library, and no JavaScript runs the sequence. Each word carries its own `--d` delay,
generated from `STROKE_CASCADE_*` in `src/content/buzzwords.ts` so the cascade stays even
if the list changes length.

```
0.00s   headline in ink; buzzwords in steel
0.55s   marker strokes begin, 85ms apart, 320ms each
1.60s   last stroke landed
1.60s   the whole field fades out, 600ms
2.20s   hero is clean
```

**The WebGL version** replaces the headline with extruded type, and runs on top of the
same buzzword sequence. It only mounts when WebGL exists *and* motion is wanted.

### The sculpture

Everything expensive happens at build time, because the headline is a fixed string:

1. `scripts/bake-hero-mesh.mjs` instances Archivo 800 at `wdth 85`, resolves each
glyph's counters as holes, flattens the curves, and triangulates the caps.
2. It writes `src/assets/type/hero-mesh.bin` — Int16 quantised points, then Uint16
   triangle indices — and a small JSON of layout metrics and contour ranges.
3. At runtime, `src/scripts/hero-3d.ts` expands that into front cap, back cap and
   extruded side walls, uploads three buffers, and draws them with a Lambert shader.

Three deliberate choices inside that:

- **No matrix library.** The scene only rotates about two axes and the camera only sits
  on the z axis, so the vertex shader composes the transform by hand. The depth mapping
  is written out explicitly too, because using the raw eye depth would make `z / w`
  constant and flatten the depth buffer.
- **The camera is placed so one world unit is one pixel at z = 0.** The sculpture is then
  positioned from the headline's measured box, so it lands where the text was at any
  breakpoint with no hard-coded offsets.
- **Lighting happens in linear space and is encoded back to sRGB**, so a face lit to 1.0
  renders as exactly `--tinta` rather than a near-miss.

### What makes it opt-in

| Condition | Result |
| --- | --- |
| `prefers-reduced-motion: reduce` | Module returns immediately. No canvas, no fetch, no buzzwords. |
| No JavaScript | The `.js` class is never set, so the buzzword field is `display: none`. |
| No WebGL | `getContext` returns null and the module bails before fetching the mesh. |
| Mesh fetch or shader fails | The error is caught, `is-gl` is removed, the real headline stays visible. |

In all four cases the visitor gets the plain HTML headline. The canvas is only revealed
(by adding `is-gl` to the hero) **after a frame has actually rendered**.

The DOM `<h1>` is never removed, only made transparent with `opacity: 0` — unlike
`display: none` or `visibility: hidden`, that keeps it in the accessibility tree and
legible to crawlers while the canvas shows it.

## Decisions worth knowing

Places where the brief allowed a judgement call, and what was chosen:

- **The hero is rendered by our own ~4 KB WebGL layer, not by a 3D library.** three.js
  bundles to ~180 KB gzipped for any scene that touches `WebGLRenderer`, which is more
  than the entire rest of the page. Baking the geometry at build time and shading it with
  one small Lambert program gets the same picture for about a tenth of the weight, and it
  means the only thing the site ships is code we wrote. three is a `devDependency`, used
  by the baker for triangulation and by nothing else.
- **The 3D is extruded type, not a gradient or a decorative scene.** The brief's design
  argument is that the headline *is* the design, so the sculpture is the headline — same
  words, same face, same condensed width, now lit from the left. A mesh gradient would
  have been the most generic possible answer to "make it stunning".
- **The header carries a compact "Contact" link.** `header.contact` exists in the copy
  deck, and the job of the page is to get someone in touch, so the string is used rather
  than left dangling. The wireframe sketched only the wordmark and the language switcher;
  this adds one link and no menu.
- **Archivo is self-hosted from Google's CSS API, not through Astro's Google provider.**
  The provider requests only the `wght` axis, which would leave the headlines at width
  100 and cost them the condensed cut the design is built on. `scripts/fetch-fonts.mjs`
  asks for `wdth` explicitly. It also verifies upstream's unicode ranges against
  `LATIN_UNICODE_RANGE`, and complains if they ever drift.
- **The serif is a single static weight, not a variable file.** The body is only ever
  weight 400; the variable file is 51 KB against 20 KB for the instance that is actually
  used. Same rendering, and it is what keeps the page inside the 150 KB budget.
- **Two extra steps were added to the scale**: `--step-row` for list-row titles and
  `--step-email` for the address, which is set at title size but sized so it never has to
  break mid-word on a 320px screen.
- **`/` resolves the language in the browser.** A static host cannot read
  `Accept-Language`. The signpost prefers an explicit earlier choice (`localStorage`),
  then `navigator.languages`, then pt-BR, and carries a `meta refresh` inside `noscript`
  for the no-JavaScript case. It is `noindex`.
- **The legal stubs are `noindex` and absent from the sitemap** while they say
  "em preparação". Set `LEGAL_PUBLISHED = true` in `site.config.mjs` in the same change
  that adds the real copy.
- **`--aco` is not used inside the ink band.** It is 2.25:1 on `--tinta`. That section
  uses `--papel`, as the brief's own table says it should.
- **The marker never becomes a text colour.** It appears only as the hero's marker
  strokes, the button's hover fill, the focus ring on the ink band, and link underlines —
  never as type on `--concreto`, where it does not contrast.
- **There are two inline scripts in total**: one adds the `.js` class and remembers an
  explicit language choice; the other is the signpost at `/`.

## Deploying

Static output. Any of Cloudflare Pages, Vercel or Netlify, with:

- build command `npm run build`
- output directory `dist`
- Node 20.3+ (no adapter needed)

Set the real origin in `site.config.mjs` before the first deploy — canonical URLs,
`hreflang`, Open Graph and `sitemap.xml` are all derived from it. The contact address is
a placeholder in the same file and is used by every `mailto:` and by the JSON-LD.

## What was verified

Measured against the built output, not assumed:

- **Home page view is 131 KB gzipped** — 5.4 KB HTML with the stylesheet inlined, 108 KB
  of fonts, 14 KB of baked mesh, 4 KB of renderer code. Under the original 150 KB budget,
  and well under the revised 200 KB one. `og.png` is a further 29 KB but is crawler-only;
  it is never fetched on a page view.
- **The 3D never blocks the first paint.** No 3D library ships to the client at all, and
  the mesh is fetched only after the DOM headline has been painted, so the LCP element is
  text rather than a canvas.
- **The sculpture lands on the text it replaces**: measured ink bounds 231–996 × 212–499
  against an expected 235–1001 × 210–498. The remaining few pixels are real perspective —
  the near face of a 17px extrusion projects slightly wider than the far one.
- **Pointer parallax and damping work**: yaw reaches ±0.0526 of a ±0.055 limit, pitch
  ±0.025 of ±0.028, and both settle back to zero on pointer-leave.
- **All four opt-outs hold**: reduced motion, no JavaScript, no WebGL, and a renderer
  failure each leave the real headline visible with the canvas never revealed.
- **No horizontal scroll and no collisions** between the buzzword field, the headline and
  the call to action at 320, 360, 375, 414, 480, 600, 767, 768, 900, 1024, 1100, 1280,
  1440, 1920 and 2560 px. Five buzzwords below 768 px, nine above.
- **Contrast passes** on every text node in the page (AA, accounting for size and weight).
- **No touch target below 44×44 px.**
- **Focus rings**: 3px `--tinta` on the concrete surface, `--marcador` inside the ink
  band.
- **The language signpost** resolves correctly for a stored choice, `pt-PT`, `pt`, `en-GB`,
  `pt-BR`, and an unsupported language (falls back to pt-BR).
- **`astro check` is clean**: 25 files, 0 errors, 0 warnings.

### Guards that keep the bake honest

`scripts/bake-hero-mesh.mjs` refuses to write output it cannot vouch for:

- the outlines' coordinate span is checked against the `Int16` quantisation range
- every shape's triangle area is checked against its outline area, counters included, and
  the run fails if they disagree by more than 0.1%

Both exist because this step is easy to get subtly wrong. Writing float offsets into a
vertex-indexed array produced perfectly plausible numbers and rendered as slabs, and these
two checks catch exactly that class of mistake.
