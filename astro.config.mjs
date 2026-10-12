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
   * provider requests only the `wght` axis, which would leave Archivo at
   * width 100 and cost the headlines the condensed cut the design depends on;
   * asking Google directly for `wdth` returns a 90 KB file that Astro then
   * cannot request. So `npm run fonts` pulls the correct slices once and they
   * are committed — which also makes the build work offline.
   *
   * Astro still writes the `@font-face` rules, keeps `font-display: swap` and
   * generates a capsize-matched fallback so the swap does not shift layout.
   */
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Archivo",
      cssVariable: "--font-archivo",
      fallbacks: ["Arial Narrow", "Arial", "sans-serif"],
      display: "swap",
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/archivo-latin.woff2"],
            weight: "100 900",
            style: "normal",
            // Makes `font-stretch: 85%` on a headline instance the `wdth` axis
            // instead of snapping to a single width.
            stretch: "75% 100%",
            unicodeRange: LATIN_UNICODE_RANGES,
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "Source Serif 4",
      cssVariable: "--font-source-serif",
      fallbacks: ["Georgia", "serif"],
      display: "swap",
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/source-serif-4-latin.woff2"],
            weight: "400",
            style: "normal",
            unicodeRange: LATIN_UNICODE_RANGES,
          },
        ],
      },
    },
  ],
});
