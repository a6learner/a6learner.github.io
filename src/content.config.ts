import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const lang = z.enum(['en', 'zh']);

// Blog: src/content/blog/<slug>/index.en.mdx (+ index.zh.mdx). Images and files sit beside it.
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      tags: z.array(z.string()).default([]),
      cover: image().optional(),
      draft: z.boolean().default(false),
      lang: lang.default('en'),
    }),
});

// Thoughts: short notes. src/content/thoughts/2026-11-09-something.md
const thoughts = defineCollection({
  loader: glob({ base: './src/content/thoughts', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    date: z.coerce.date(),
    lang: lang.default('en'),
    draft: z.boolean().default(false),
  }),
});

// Projects: src/content/projects/<slug>.en.md (+ <slug>.zh.md)
const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      year: z.number().optional(),
      tags: z.array(z.string()).default([]),
      cover: image().optional(),
      repo: z.string().url().optional(),
      link: z.string().url().optional(),
      featured: z.boolean().default(false),
      order: z.number().default(0),
      lang: lang.default('en'),
    }),
});

// Pages: free-form text pages such as About. src/content/pages/about.en.md (+ about.zh.md)
const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    lang: lang.default('en'),
  }),
});

export const collections = { blog, thoughts, projects, pages };
