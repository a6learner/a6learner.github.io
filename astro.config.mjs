// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

const SITE = 'https://a6learner.github.io';

export default defineConfig({
  site: SITE,
  integrations: [mdx(), sitemap()],
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
