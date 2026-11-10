import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/ui';

type Name = 'blog' | 'thoughts' | 'projects' | 'pages';
export type Item<C extends Name> = {
  entry: CollectionEntry<C>;
  slug: string;
  lang: Lang; // the language the entry is written in
  fallback: boolean; // true when shown in the other language's pages
  isPrivate: boolean;
  isDraft: boolean;
};

// Drafts and anything inside a private/ folder only appear with `npm run dev`.
const DEV = import.meta.env.DEV;

// src/content/blog/my-post/index.zh.mdx  ->  slug "my-post", lang "zh"
function parse(entry: CollectionEntry<Name>) {
  const path = (entry.filePath ?? entry.id).replace(/\\/g, '/');
  let rel = path.replace(/^.*?src\/content\/[^/]+\//, '').replace(/\.(md|mdx)$/, '');
  const isPrivate = /(^|\/)private\//.test(rel);
  rel = rel.replace(/(^|\/)private\//, '$1');
  let lang = ((entry.data as { lang?: Lang }).lang ?? 'en') as Lang;
  const m = rel.match(/\.(en|zh)$/);
  if (m) {
    lang = m[1] as Lang;
    rel = rel.slice(0, -3);
  }
  return { slug: rel.replace(/\/index$/, ''), lang, isPrivate };
}

/** One item per slug: in `lang` when that version exists, otherwise the other language. */
export async function localized<C extends Name>(name: C, lang: Lang): Promise<Item<C>[]> {
  const all = (await getCollection(name)) as CollectionEntry<C>[];
  const bySlug = new Map<string, Item<C>>();
  for (const entry of all) {
    const p = parse(entry as CollectionEntry<Name>);
    const isDraft = Boolean((entry.data as { draft?: boolean }).draft);
    if (!DEV && (p.isPrivate || isDraft)) continue;
    const item: Item<C> = { entry, ...p, fallback: p.lang !== lang, isDraft };
    const prev = bySlug.get(p.slug);
    if (!prev || (prev.fallback && !item.fallback)) bySlug.set(p.slug, item);
  }
  return [...bySlug.values()];
}

const time = (e: { data: unknown }) => (e.data as { date?: Date }).date?.valueOf() ?? 0;

export async function posts(lang: Lang) {
  return (await localized('blog', lang)).sort((a, b) => time(b.entry) - time(a.entry));
}

export async function thoughts(lang: Lang) {
  return (await localized('thoughts', lang)).sort((a, b) => time(b.entry) - time(a.entry));
}

export async function projects(lang: Lang) {
  return (await localized('projects', lang)).sort(
    (a, b) => a.entry.data.order - b.entry.data.order || (b.entry.data.year ?? 0) - (a.entry.data.year ?? 0),
  );
}

export function readingMinutes(body = '') {
  const cjk = (body.match(/[㐀-鿿]/g) ?? []).length;
  const words = body.replace(/[㐀-鿿]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230 + cjk / 450));
}
