import { defineConfig } from 'astro/config';
import { SITE } from './site.config.mjs';

export default defineConfig({
  site: SITE.url,
  output: 'static',
  trailingSlash: 'always',

  compressHTML: true,
  // One request instead of two: the stylesheet is small enough to inline.
  build: {
    inlineStylesheets: 'always',
    assets: '_assets',
  },

  devToolbar: { enabled: false },
  prefetch: false,
});
