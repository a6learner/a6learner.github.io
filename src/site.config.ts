// Everything personal lives here. Edit this file to change who the site is about.
// Leave a field empty ('') and the site shows a dashed "still being written" blank, or hides it.
export const site = {
  name: { en: 'Jun Wang', zh: '王俊' },
  // The short name used in the greeting and the nav wordmark.
  short: { en: 'Jun', zh: '王俊' },
  // One sentence under the greeting. Empty = a dashed placeholder until you write it.
  tagline: { en: '', zh: '' },
  description: {
    en: "Jun Wang's notebook: writing, short thoughts and things built.",
    zh: '王俊的笔记本：文章、随想和做过的东西。',
  },
  github: 'https://github.com/a6learner',
  email: '', // e.g. 'you@example.com'
  // Extra links shown in the footer, e.g. { label: 'Bilibili', href: 'https://...' }
  links: [] as { label: string; href: string }[],
};
