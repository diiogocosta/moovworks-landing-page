# moovworks

The Moovworks institutional site: one page, three languages (pt-BR, pt-PT, en),
static output, no runtime JavaScript beyond two inline scripts. An applied AI
studio selling five lines of work: video, marketing, ads, apps and projects.

The page is a near-black surface with a single electric-green accent, one
typeface, nested card enclosures, a soft accent glow behind each band for colour
mass, and a hero whose visual (a stack of vertical video frames) is drawn in CSS
rather than photographed.

## Stack, and why

| Choice | Reason |
| --- | --- |
| **Astro 7, `output: 'static'`** | Ships zero JavaScript to the client, and renders the three languages from one route set so they cannot drift apart. No UI framework, no Tailwind. |
| **Hand-written CSS** | One `tokens.css` is the single source of truth for the surface, the accent, the families and the fluid scale. Subdomains are expected to import it unchanged. |
| **Self-hosted fonts** | Two `woff2` files, latin subset, served from our own origin. Committed, so the build needs no network and no visitor request ever reaches Google. |
| **No WebGL, no 3D** | The hero used to be a hand-written WebGL renderer drawing the headline as extruded type. It was retired in the rebrand: it cost ~900 lines, needed WebGL, and the flow diagram says more about an agency than a sculpture does. See "Decisions worth knowing". |
| **No analytics, no cookie banner** | Nothing is tracked, so there is nothing to consent to. |
| **Asset generation is offline** | `public/favicon.svg` and `public/og.png` are committed outputs of `npm run assets`. The site build runs no browser and does no font parsing. |

The whole thing is about 140 KB for a first visit including both fonts, and the
stylesheet is inlined into the document so the first paint needs no second
request.

## Requirements

Node **22.12 or newer**. Astro 7 declares that floor itself; the previous
`>=20.3.0` here was simply wrong and a host reading `engines` would have picked a
Node that cannot run the build.

## Commands

```bash
npm run dev           # dev server
npm run build         # type check, then build, then verify the CSS survived
npm run preview       # serve dist/
npm run check         # astro check on its own

npm run fonts         # refresh the two self-hosted woff2 files   (needs network)
npm run assets        # regenerate favicon.svg + og.png           (needs network)
```

`build` runs the type check and then `scripts/verify-build.mjs`, because two
things about this build fail *silently*. Neither step is optional. See "Guards".

`fonts` and `assets` are not build steps. Their inputs are cached under `.cache/`
and their outputs committed, so day-to-day work never needs either.

## Layout

```
site.config.mjs          origin, contact, locale list, routes, and the headline
src/styles/tokens.css    the identity: surface, accent, type, space, radii
src/styles/global.css    reset, base, primitives, the reveal
src/content/copy.json    every string on the page, in all three locales
src/content/buzzwords.ts the hero's word field
src/components/          one file per band of the page
src/pages/               the three home pages, the legal stubs, the signpost
scripts/                 font fetch, asset generation, build verification
```

`src/content/copy.json` is a single file on purpose. It used to be three, split
so that one of them stayed byte-identical to a design brief that no longer
describes this site, and the split cost two extra casts and two extra accessors
for no benefit.

### Adding a fourth language

1. Add the tag to `LOCALES` and a slug to `HOME_SLUG` in `site.config.mjs`.
2. Add the locale's block to `src/content/copy.json`, and to `LEGAL_SLUG` and
   `OG_LOCALE` in the config.

The build then fails until the copy file is complete, which is the point.

### Adding a products section

`src/components/HomePage.astro` marks the spot, between Services and Principles.
If the section holds a list, give it its own grid template rather than reusing
the services rhythm: five unequal cells is a shape for five things.

## The identity

One dark surface, one accent, and a few rules that keep it from drifting.

- **`#08090a` is the only surface.** Deeper than a plain near-black on purpose:
  on OLED and on a laptop at night it reads as a material, where `#101010` reads
  as a dark grey document. There is no light mode and no section inverts.
  `--canvas-soft` and `--canvas-raised` are steps of the same darkness.
- **Depth comes from glow and nested edges, never from a shadow.** A drop shadow
  on near-black is invisible, so elevation is a lit hairline (`.card`) or a
  radial accent bleed (`.glow`). The glows are radial gradients rather than
  blurred elements: the same soft bleed for a fraction of the compositing cost,
  which is what lets the page carry several of them on a phone.
- **`#00d992` is the only accent, and it is reserved.** A button fill, a focus
  ring, an inline link, the chip label on a service card, the outcome line, the
  connector in the flow diagram, the strike through the hero's slogans, and the
  invitation card's whole surface. Never body text. Both directions clear AAA:
  accent on canvas is 10.2:1, near-black on accent is 10.2:1.
- **One typeface, and weight does the hierarchy.** Inter everywhere, display
  included, plus JetBrains Mono for chips, figures and small labels. Display is
  700, section heads 700, card titles 600, body 400. Inter's optical size axis is
  in the file, so the browser picks the text cut at body sizes and the display cut
  at heading sizes.
- **Four radii, and the difference between the first two is the point.** A card is
  a shell and a core nested inside it (`.card` / `.card__core`), and the core's
  radius is smaller by exactly the margin between them, because concentric curves
  that keep the same radius look like a picture in a badly cut mount. Controls and
  chips are fully rounded, which is what makes them read as controls.
- **Fine grain over everything**, on one fixed layer. It is the cheapest texture
  available because it never repaints.
- **One badge on the whole page**, in the hero. A tracked pill above every heading
  is the fastest way for a page like this to start looking generated.

Every colour, radius, easing and type step lives in `tokens.css` and nowhere else.
Two exceptions are worth knowing: `theme-color` in `BaseLayout.astro` repeats
`--canvas` as a literal because CSS cannot feed a meta tag, and
`scripts/generate-assets.mjs` reads the tokens by name out of that file.

**No `linear` easing anywhere.** Motion uses two custom curves, `--ease-out` for
anything that settles and `--ease-soft` for anything that arrives. A linear
transition is what makes a control feel like a CSS demo instead of a mechanism.

## How the hero works

A badge, the headline, four slogans struck through, a subtitle, two actions, and
a stack of vertical video frames lit from behind.

**The struck slogans** are the joke of the headline made visible: the vocabulary
of AI marketing arrives and a green strike crosses each one out. They are always
English in every locale, because they are words as they are actually written
rather than a sentence to be translated.

They used to be nine small grey words scattered across the hero by percentage
coordinates. That read as texture, not as language: at 12px and that contrast
nobody was reading them, so the headline had no visible answer to itself. They are
now four chips on the baseline of the copy, struck by default, with the animation
only ever playing *from* unstruck where motion is welcome. So with no CSS
animation support or with `prefers-reduced-motion`, the chips are simply already
struck through instead of silently losing the point.

**The reel** is three 9:16 plates with different gradient compositions, the front
one carrying a playhead, a timestamp and a progress line. It is the visual anchor
and it is where the band's colour mass comes from. It is abstract, not a mockup:
no window chrome, no fake interface, nothing that claims to be a screenshot of a
product. It is `aria-hidden` because it carries no information.

Two things about it are load-bearing and easy to break:

- The plates' `flex-basis` plus the negative margins have to add up to exactly
  100% of the column. They are 33/33/44 with two 5% pulls, which is 110 minus 10.
  An earlier 42/42/52 without enough pull summed to 132%, so the reel overflowed
  its column and was silently clipped by the band at the viewport edge.
- The strike chips are 12px on a phone and 13px above it, which is a wrap decision
  rather than a taste one: at 13px the two longest chips need 355px in a 350px
  column and break one per line.

On a phone the reel drops to two plates across the full width. A single
left-aligned frame in a 350px column leaves a quarter of the row empty, which
reads as a broken grid rather than as a composition.

## Decisions worth knowing

- **The headline lives in `site.config.mjs`, not in the copy deck.** It is English
  in all three locales, and two different things are built from it: the `<h1>`
  in `Hero.astro` and the headline burned into `public/og.png`. Declaring it once
  is what stops the share card from advertising a headline the page does not have.
- **`/` is a signpost, not a page.** A static host cannot read `Accept-Language`,
  so `/` resolves the locale in the browser: a previous explicit choice from
  `localStorage`, then `navigator.languages`, then pt-BR. It carries a `meta
  refresh` inside `noscript` and is `noindex`.
- **The legal stubs are `noindex` and absent from the sitemap** while they say "in
  preparation". Flip `LEGAL_PUBLISHED` in `site.config.mjs` in the same change
  that adds the real copy.
- **The founding date is never rephrased as "N years".** It is "Since 2011" in
  English and "Desde 2011" in Portuguese, in `copy.json`, and `founded` in the
  config feeds the same fact into the JSON-LD and the OG card.
- **One inline script, total:** remembering an explicit language choice. The
  signpost at `/` has its own, so two on the whole site. Nothing else on this page
  needs JavaScript, including the hero's struck slogans.
- **Each service card is four parts, and the shape is the sell.** A kicker chip,
  the title, one line in the accent saying why to care, the honest paragraph, then
  the deliverables as chips. The accent line is the reason the card exists; the
  paragraph is the substantiation.
- **The fifth cell is not a service.** It is the invitation ("Got an idea and no
  idea how to move it?") on a filled accent card spanning the full width, so the
  page's loudest element is the only one that asks for anything.
- **The service cards are unequal on purpose:** 7/5, then 5/7, then the invitation
  across the full width. An even row of four, or of any number, is the layout this
  page exists to avoid.

## Deploying

Static output. Any of Cloudflare Pages, Vercel or Netlify, with:

- build command `npm run build`
- output directory `dist`
- Node 22.12 or newer, no adapter

Set the real origin in `site.config.mjs` before the first deploy: canonical URLs,
`hreflang`, Open Graph and `sitemap.xml` are all derived from it. The contact
address is a placeholder in the same file and is used by every `mailto:` and by
the JSON-LD.

## How the page reveals

Three moments move as you scroll, not every section. The header turns from
transparent to a solid bar, and the services and principles bands rise as they
enter the viewport. All of it is **CSS scroll-driven animation**
(`animation-timeline: view()` and `scroll(root)`), so there is no
IntersectionObserver, no scroll listener, and no JavaScript involved at all.

That choice is not about saving bytes. A scripted reveal has to hide its content
*first*, so a blocked bundle or a parse error leaves a blank page. Here, a browser
without `animation-timeline` applies no animation and simply shows the content:
the failure mode is "no animation", never "no page".

Motion is used in three places on purpose. Motion that happens everywhere is not
emphasis, it is noise.

### The catch

Every animation has to be written as **longhands**, never the `animation`
shorthand:

```css
/* Wrong. The build folds the timeline into the shorthand. */
animation: reveal-in linear both;
animation-timeline: view();

/* Right. */
animation-name: reveal-in;
animation-timing-function: linear;
animation-fill-mode: both;
animation-timeline: view();
```

Astro's style compiler folds `animation-timeline` into the `animation` shorthand
when both are declared in the same rule, emitting
`animation: linear both reveal-in view()`. Chromium rejects that form outright, so
the declaration is dropped and every scroll-driven rule dies with no error
anywhere. `astro dev` does not transform the CSS this way, so it looks fine
locally and breaks in production.

## What was verified

- `npm run build` clean: type check, build, and the surviving-CSS guard.
- The page renders at 390, 820, 1440 and 1920 with **no horizontal overflow**:
  the emulated viewport's `innerWidth` equals the requested width at every one.
- Every visible string re-read in all three locales: no em-dashes, no invented
  numbers, no client names, one contact label reused everywhere it means the same
  thing.
- One accent colour, used identically in every section, and exactly one badge on
  the page.

Four things were found by looking rather than by building, which is the argument
for looking:

- **A screenshot at a 390px window is not a 390px page.** Headless Chrome clamps
  the layout viewport to about 504px whatever `--window-size` says, so the
  "mobile" shot was a 504px layout cropped to 390 and looked like a
  horizontal-overflow bug that was not there. `.cache/shot-cdp.mjs` drives Chrome
  over CDP instead, which is also what lets it emulate `prefers-reduced-motion`,
  since the reveals start at `opacity: 0` and a whole-page capture otherwise
  renders every revealed section blank.
- **The page genuinely overflowed by 99px.** `innerWidth` came back as 489 on a
  390px viewport while `clientWidth` was 390, which is the signature: the layout
  viewport is right and the content is too wide. The cause was a decorative glow
  positioned with `inset-inline-end` and no clipping ancestor. Bands now clip
  their own overflow (`.section`), and `body` deliberately does **not**, because a
  page-level `overflow-x: clip` would have hidden this instead of surfacing it.
- **The services grid collapsed to overlapping text on a phone.** The
  twelve-column template was declared in the base rule and the spans in a
  min-width query, so below the collapse point each cell sat in a single 30px
  column. A multi-column layout needs its single-column fallback declared in the
  same component, not assumed.
- **The reel was clipped at the viewport edge**, because its plates' flex bases
  summed to 132% of their column. Fixed by arithmetic that adds to 100%, which is
  now written down next to it.

## Guards

`scripts/verify-build.mjs` runs after every build and asserts that the
scroll-driven CSS survived the transform above: no folded shorthands, and the
two timelines plus their keyframes present in every page that carries an inlined
stylesheet. The stylesheet is inlined because `build.inlineStylesheets` is
`always`, and this guard depends on that, so do not switch it to `auto`.

It reads **every** page rather than the first one the directory listing returns.
It used to test `files[0]`, which on a filesystem with a different entry order
meant testing the stylesheet-free signpost at `/` and failing the build for a
reason that did not exist.

`npm run build` also runs `astro check` first. The copy deck is asserted rather
than cast through `unknown`, so a key that exists in one locale and not the others
is a type error, and a missing translation cannot ship as an empty string.
