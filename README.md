# Jun Wang's notebook

My personal site: an intro, writing, short thoughts and projects, in English and 中文.
Built with [Astro](https://astro.build), designed with [Hallmark](https://github.com/Nutlope/hallmark) (theme: Paste-up).

## Run it on your computer

```sh
npm install      # once
npm run dev      # open http://localhost:4321 , changes show instantly
npm run build    # check the real site builds (output in dist/)
```

## Where things live

| I want to change… | Edit this |
|---|---|
| My name, tagline, GitHub, email, links | `src/site.config.ts` |
| The About page | `src/content/pages/about.en.md` and `about.zh.md` |
| Colours, fonts, sizes, shadows (the whole look) | `src/styles/tokens.css` |
| Layout and component styles | `src/styles/site.css` |
| Interface words (menu, buttons) in both languages | `src/i18n/ui.ts` |

## The desktop app (easiest)

Double click **Personal Blog** on the desktop. It starts the local site, opens the writing desk
(`http://127.0.0.1:4321/studio`) in its own window, and stops everything when you close the window.

- **Who can see it:** every post and thought is Public, Draft or Private.
  Private ones live in a `private/` folder on this computer and are never uploaded.
- **Save locally** writes the Markdown file. No git.
- **Publish to GitHub** (only shown for Public) builds the site, checks that nothing private is in it,
  shows the exact files and commit message, and pushes after you confirm.
- Drop pictures onto the text to add them to a post.

Install or remove the shortcut:
```powershell
powershell -ExecutionPolicy Bypass -File launcher\Install-Shortcut.ps1
powershell -ExecutionPolicy Bypass -File launcher\Uninstall-Shortcut.ps1
```
Logs: `%LOCALAPPDATA%\PersonalBlog\launcher.log`. The writing desk only exists in `npm run dev`;
it is never part of the published website.

Safety nets for private writing: `.gitignore`, the publish allowlist, a scan of the build output,
a check of the staged files, and a git pre-commit hook that refuses any `private/` path.

## The quick way

```sh
npm run new "My post title"          # new post (add -- --zh for Chinese, -- --private for private)
npm run thought "What I was thinking"  # pin a short thought
npm run dev                          # preview at http://localhost:4321
npm run publish                      # publish public changes (asks first); live in about a minute
```

In plain Markdown: pictures go in the post's folder (`![alt](./photo.jpg)`), files go in
`public/files/` (`[notes.pdf](/files/notes.pdf)`).

## Write a blog post by hand

1. Make a folder: `src/content/blog/my-first-post/`
2. Add `index.en.mdx` (English) and/or `index.zh.mdx` (Chinese). Copy the template from
   `src/content/blog/how-this-notebook-works/post-template.txt`.
3. Put pictures and files in the same folder.

```mdx
---
title: My first post
description: One sentence about it.
date: 2026-11-09
tags: [notes]
---

A picture (same folder): resized and compressed automatically.

![What it shows](./photo.jpg)

A file people can download:

import slides from './slides.pdf?url'

<FileCard src={slides} name="slides.pdf" note="What it is" />

Several pictures in a grid:

import a from './a.jpg'
import b from './b.jpg'

<Gallery images={[a, b]} alts={['First', 'Second']} />
```

The folder name becomes the address: `/blog/my-first-post`. Use lowercase English letters and dashes.
If a post exists in only one language, the other language's site shows it with a small note.
Plain `.md` works too when you don't need `FileCard` or `Gallery`.

## Write a thought

A thought is a short note. Make one file: `src/content/thoughts/2026-11-09-something.en.md`
(or `.zh.md`):

```md
---
date: 2026-11-09
---

What I was thinking.
```

## Add a project

`src/content/projects/my-project.en.md` (and `.zh.md`):

```md
---
title: My project
description: One sentence about what it does.
year: 2026
tags: [Python]
repo: https://github.com/a6learner/my-project
link: https://example.com   # optional live link
cover: ./my-project.png      # optional screenshot, same folder
featured: true               # show on the front page
order: 1                     # smaller comes first
---
```

## Private and draft

- **Private:** put a post or thought inside a `private/` folder, e.g. `src/content/blog/private/diary/index.en.md`.
  It shows (with a yellow "Private" badge) only in `npm run dev` on your computer. Git ignores
  these folders, so they are **never uploaded**.
- **Draft:** add `draft: true` to the frontmatter. Hidden from the live site, visible in `npm run dev`.
  The file is still uploaded to GitHub (the repo is public), so drafts are not secret.

## Put it online at a6learner.github.io (one-time setup)

1. On GitHub, create a **new public repository named exactly `a6learner.github.io`**. Leave it empty.
2. In this folder:
   ```sh
   git init
   git add .
   git commit -m "First version of my site"
   git branch -M main
   git remote add origin https://github.com/a6learner/a6learner.github.io.git
   git push -u origin main
   ```
3. On GitHub: the repo's **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Wait about a minute (watch the **Actions** tab). The site is live at https://a6learner.github.io

After that, publishing is just: write, then `git add . && git commit -m "new post" && git push`.

## Redesign later

- Small changes: edit the tokens in `src/styles/tokens.css` (colours are `oklch(lightness chroma hue)`).
- A whole new look: in Claude Code run `/hallmark redesign src/styles`. The design decisions are recorded
  at the top of `src/styles/site.css` and in `.hallmark/log.json`.
