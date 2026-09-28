# moovworks

The moovworks.com institutional site: one page, three languages, static.

> **`spec.md` is intentionally untracked.** It is the brief this was built from, not an
> artefact of it. It is listed in `.gitignore`.

## Stack, and why

| Choice | Reason |
| --- | --- |
| **Astro 7, `output: 'static'`** | Ships zero JavaScript to the client by default, and renders the three languages from one route file so they cannot drift apart. No UI framework, no Tailwind, no animation library. |
| **Hand-written CSS** | One `tokens.css` is the single source of truth for the palette, the families and the fluid scale. Subdomains are expected to import it unchanged. |
| **Self-hosted fonts** | Two `woff2` files, latin subset, served from our own origin. Committed, so the build needs no network and no visitor request ever reaches Google. |
| **No analytics, no cookie banner** | Nothing is tracked, so there is nothing to consent to. |
| **Asset generation is offline** | `public/favicon.svg` and `public/og.png` are committed outputs of a script. The site build does not run sharp, fontkit, or a browser. |

## Requirements

Node **20.3+** (the scripts use `import.meta.dirname`; the project is developed on 22).

## Commands

```bash
npm install
npm run dev       # local server
npm run build     # static output in dist/
npm run preview   # serve dist/ exactly as a host would

npm run fonts     # re-fetch the two woff2 subsets   (needs network)
npm run assets    # regenerate favicon.svg + og.png  (needs network on first run)
```

`fonts` and `assets` are maintenance commands, not build steps. Their inputs are
cached under `.cache/` and their outputs committed, so day-to-day work never needs
either.

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
src/pages/index.astro    the Accept-Language signpost at /
src/pages/[locale]/      /pt-br/, /pt-pt/, /en/ and the legal stubs
scripts/                 font fetching and asset generation
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

The buzzword field is markup plus CSS only — no library, and no JavaScript runs the
sequence. Each word carries its own `--d` delay, generated from `STROKE_CASCADE_*` in
`src/content/buzzwords.ts` so the cascade stays even if the list changes length.

```
0.00s   headline in ink; buzzwords in steel
0.55s   marker strokes begin, 85ms apart, 320ms each
1.60s   last stroke landed
1.60s   the whole field fades out, 600ms
2.20s   hero is clean
```

It runs once, never loops, and never touches the headline. Two escape hatches keep it
out of the DOM entirely: `prefers-reduced-motion: reduce`, and no JavaScript (the inline
head script adds a `.js` class; without it the field is `display: none`). In both cases
the page opens on the finished state. The field is absolutely positioned inside the hero,
so it cannot shift layout.

## Decisions worth knowing

Places where the brief allowed a judgement call, and what was chosen:

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

- **Home page weight 128 KB** (20 KB HTML with the stylesheet inlined, 110 KB of fonts),
  below the 150 KB target, and much less over the wire once compressed.
- **No horizontal scroll and no collisions** between the buzzword field, the headline and
  the call to action at 320, 360, 375, 414, 480, 600, 767, 768, 900, 1024, 1100, 1280,
  1440, 1920 and 2560 px. Five buzzwords below 768 px, nine above.
- **Contrast passes** on every text node in the page (AA, accounting for size and weight).
- **No touch target below 44×44 px.**
- **Focus rings**: 3px `--tinta` on the concrete surface, `--marcador` inside the ink
  band.
- **Reduced motion and no-JavaScript** both open the hero clean, with no buzzwords
  rendered.
- **The language signpost** resolves correctly for a stored choice, `pt-PT`, `pt`, `en-GB`,
  `pt-BR`, and an unsupported language (falls back to pt-BR).
