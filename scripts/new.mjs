// Create a new blog post:   npm run new "My post title"
// Chinese post:             npm run new "我的文章" -- --zh
// Private post (never uploaded): npm run new "Diary" -- --private
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const zh = args.includes('--zh');
const priv = args.includes('--private');
const title = args.filter((a) => !a.startsWith('--')).join(' ').trim();
if (!title) {
  console.log('Usage: npm run new "My post title"   (add -- --zh for Chinese, -- --private for private)');
  process.exit(1);
}

const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local time
let slug = title.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
if (!slug) slug = `post-${today}`; // e.g. a Chinese-only title
const base = path.join('src', 'content', 'blog', priv ? 'private' : '', slug);
const file = path.join(base, `index.${zh ? 'zh' : 'en'}.md`);
if (fs.existsSync(file)) {
  console.log(`Already exists: ${file}`);
  process.exit(1);
}
fs.mkdirSync(base, { recursive: true });
fs.writeFileSync(
  file,
  `---
title: ${JSON.stringify(title)}
description: ""
date: ${today}
tags: []
draft: false
---

${zh ? '从这里开始写。' : 'Start writing here.'}

<!--
Pictures: put them in this folder, then  ![what it shows](./photo.jpg)
Files:    put them in public/files/,      then  [notes.pdf](/files/notes.pdf)
Preview:  npm run dev   ->  http://localhost:4321${zh ? '/zh' : ''}/blog/${slug}
Publish:  npm run publish
-->
`,
);
console.log(`Created ${file}`);
console.log(`Put pictures for this post in ${base}${path.sep}`);
// Open it in VS Code if it is installed.
spawn(`code "${base}" "${file}"`, { shell: true, stdio: 'ignore', detached: true }).on('error', () => {}).unref();
