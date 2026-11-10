// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import studio from './src/integrations/studio.mjs';

const SITE = 'https://a6learner.github.io';

export default defineConfig({
  site: SITE,
  // studio(): the local writing desk at /studio, only during `astro dev`
  integrations: [mdx(), sitemap(), studio()],
  devToolbar: { enabled: false },
  // Keep post attachments as real files instead of inlining small ones.
  vite: { build: { assetsInlineLimit: 0 } },
  i18n: {
    locales: ['en', 'zh'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
});
