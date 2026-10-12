import { defineConfig, fontProviders } from "astro/config";
import { LATIN_UNICODE_RANGES, SITE } from "./site.config.mjs";

export default defineConfig({
  site: SITE.url,
  output: "static",
  trailingSlash: "always",

  // `true` keeps HTML-aware whitespace instead of v7's new JSX rules, so an
  // explicit space between inline elements survives minification.
  compressHTML: true,

  // One request instead of two: the stylesheet is small enough to inline.
  // `verify-build.mjs` asserts the result, so do not switch this to "auto".
  build: {
    inlineStylesheets: "always",
    assets: "_assets",
  },

  devToolbar: { enabled: false },
  prefetch: false,

  /**
   * Two families, two woff2 files, latin subset, served from our own origin.
   *
   * Both are local rather than `fontProviders.google()` on purpose. Google's
   * provider would work here, but it pins the axis set, and Inter's optical size
   * axis is worth having: the display sizes on this page want the text cut and
   * the body wants the default, and the browser picks that automatically when
   * `opsz` is in the file. So `npm run fonts` pulls the correct slices once and
   * they are committed, which also makes the build work offline.
   *
   * Astro still writes the `@font-face` rules, keeps `font-display: swap` and
   * generates a capsize-matched fallback so the swap does not shift layout.
   */
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Inter",
      cssVariable: "--font-inter",
      fallbacks: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
      display: "swap",
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/inter-latin.woff2"],
            weight: "100 900",
            style: "normal",
            unicodeRange: LATIN_UNICODE_RANGES,
          },
        ],
      },
    },
    {
      /**
       * The mono is not decoration. It carries the figures, the pipeline's step
       * labels and the one eyebrow per band, which is the whole of the page's
       * technical texture. Weight stops at 500: a mono at 700 next to Inter 400
       * reads as a different brand.
       */
      provider: fontProviders.local(),
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains-mono",
      fallbacks: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      display: "swap",
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/jetbrains-mono-latin.woff2"],
            weight: "400 500",
            style: "normal",
            unicodeRange: LATIN_UNICODE_RANGES,
          },
        ],
      },
    },
  ],
});
