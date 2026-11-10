import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { posts } from '../../lib/content';
import { site } from '../../site.config';

export async function GET(context: APIContext) {
  const items = await posts('zh');
  return rss({
    title: site.name.zh,
    description: site.description.zh,
    site: context.site!,
    items: items.map((p) => ({
      title: p.entry.data.title,
      description: p.entry.data.description,
      pubDate: p.entry.data.date,
      link: `/zh/blog/${p.slug}/`,
    })),
  });
}
