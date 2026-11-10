export const langs = ['en', 'zh'] as const;
export type Lang = (typeof langs)[number];

// Every piece of interface text, in both languages. Add a key to both blocks.
const ui = {
  en: {
    'nav.writing': 'Writing',
    'nav.thoughts': 'Thoughts',
    'nav.projects': 'Projects',
    'nav.about': 'About',
    'nav.menu': 'Menu',
    'nav.home': 'Home',
    'nav.switch': '中文',
    'nav.switchLabel': '切换到中文',
    'mode.toggle': 'Switch between light and dark',
    'skip': 'Skip to content',
    'hero.hello': "Hello, I'm {name}.",
    'hero.taglineBlank': 'A line about me, still being written',
    'hero.read': 'Read what I have been writing',
    'hero.drag': 'The sheets are not glued down. Drag them around; double click one to put it back.',
    'hero.updated': 'Updated',
    'home.writing': 'Things I wrote down',
    'home.thoughts': 'Thoughts, as they come',
    'home.projects': 'Things I built',
    'home.allWriting': 'All writing',
    'home.allThoughts': 'All thoughts',
    'home.allProjects': 'All projects',
    'empty.writing': 'Nothing published yet. The first post is on its way.',
    'empty.thoughts': 'No thoughts pinned up yet.',
    'empty.projects': 'No projects listed yet.',
    'blog.title': 'Writing',
    'blog.lead': 'Longer notes on what I learn, build and wonder about.',
    'blog.all': 'All',
    'blog.filter': 'Filter by tag',
    'blog.minutes': '{n} min read',
    'blog.contents': 'On this page',
    'blog.back': 'Back to all writing',
    'blog.onlyIn': 'This post is only written in Chinese for now.',
    'thoughts.title': 'Thoughts',
    'thoughts.lead': 'Short and unpolished, written when they arrive.',
    'projects.title': 'Projects',
    'projects.lead': 'Things I made, kept here so I can find them again.',
    'projects.code': 'Code',
    'projects.visit': 'Visit',
    'about.title': 'About',
    'badge.draft': 'Draft',
    'badge.private': 'Private: only on your computer',
    'footer.close': 'Yours,',
    'footer.rss': 'RSS',
    'footer.github': 'GitHub',
    'footer.email': 'Email',
    'file.download': 'Download',
    '404.title': 'This page fell off the board.',
    '404.back': 'Go back to the front page',
  },
  zh: {
    'nav.writing': '文章',
    'nav.thoughts': '随想',
    'nav.projects': '项目',
    'nav.about': '关于',
    'nav.menu': '菜单',
    'nav.home': '首页',
    'nav.switch': 'EN',
    'nav.switchLabel': 'Switch to English',
    'mode.toggle': '切换明暗模式',
    'skip': '跳到正文',
    'hero.hello': '你好，我是{name}。',
    'hero.taglineBlank': '关于我的一句话，还在写',
    'hero.read': '看看我最近写了什么',
    'hero.drag': '这些纸片没粘牢，可以拖动；双击一张就放回原处。',
    'hero.updated': '更新于',
    'home.writing': '最近写下的',
    'home.thoughts': '随手的想法',
    'home.projects': '做过的东西',
    'home.allWriting': '全部文章',
    'home.allThoughts': '全部随想',
    'home.allProjects': '全部项目',
    'empty.writing': '还没有发布文章，第一篇在路上。',
    'empty.thoughts': '这里还没有贴上想法。',
    'empty.projects': '还没有列出项目。',
    'blog.title': '文章',
    'blog.lead': '关于学到的、做过的和好奇的事情，写得长一点的笔记。',
    'blog.all': '全部',
    'blog.filter': '按标签筛选',
    'blog.minutes': '约 {n} 分钟',
    'blog.contents': '本文目录',
    'blog.back': '返回全部文章',
    'blog.onlyIn': '这篇文章暂时只有英文版。',
    'thoughts.title': '随想',
    'thoughts.lead': '短的、没打磨的，想到就写下来。',
    'projects.title': '项目',
    'projects.lead': '我做过的东西，放在这里方便以后找到。',
    'projects.code': '代码',
    'projects.visit': '访问',
    'about.title': '关于',
    'badge.draft': '草稿',
    'badge.private': '私密：只在你的电脑上可见',
    'footer.close': '此致，',
    'footer.rss': 'RSS',
    'footer.github': 'GitHub',
    'footer.email': '邮件',
    'file.download': '下载',
    '404.title': '这一页从墙上掉下来了。',
    '404.back': '回到首页',
  },
} as const;

export type UIKey = keyof (typeof ui)['en'];

export function t(lang: Lang, key: UIKey, vars: Record<string, string | number> = {}) {
  let s: string = ui[lang][key] ?? ui.en[key];
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/** Path for a page in a language: href('zh', '/blog') gives '/zh/blog'. */
export function href(lang: Lang, path: string) {
  if (lang === 'en') return path;
  return path === '/' ? '/zh/' : `/zh${path}`;
}

/** The same page in the other language. */
export function otherLangPath(pathname: string, lang: Lang) {
  if (lang === 'zh') return pathname.replace(/^\/zh(\/|$)/, '/') || '/';
  return pathname === '/' ? '/zh/' : `/zh${pathname}`;
}

// Dates in frontmatter are calendar days, so format them in UTC to avoid shifting a day.
export function formatDate(d: Date, lang: Lang) {
  return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** Compact date for lists: "9 Nov 2026" / "2026年11月9日" */
export function shortDate(d: Date, lang: Lang) {
  return lang === 'zh'
    ? formatDate(d, lang)
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
