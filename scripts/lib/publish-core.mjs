// Shared, safety-first publishing used by the writing desk (/studio) and `npm run publish`.
//
// Rules:
//  - Only files under the PUBLIC_ROOTS can be published, and never anything inside a private/ folder
//    or belonging to a draft. This is an explicit allowlist; `git add .` / `git add -A` are never used.
//  - Before committing: a production build must succeed and must not contain any private content.
//  - The staged files are checked again; anything private or outside the allowlist blocks the publish.
//  - `git commit --only` commits just these files, so other work in progress stays untouched.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PUBLIC_ROOTS = [
  'src/content/blog/',
  'src/content/thoughts/',
  'src/content/projects/',
  'src/content/pages/',
  'public/files/',
];
const SITE = 'https://a6learner.github.io';
const ACTIONS = 'https://github.com/a6learner/a6learner.github.io/actions';

export const isPrivatePath = (p) => /(^|\/)private(\/|$)/i.test(p.replace(/\\/g, '/'));

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

/** Changed paths (added, modified, deleted, untracked), repo-relative with forward slashes. */
function changedPaths() {
  const out = git(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const parts = out.split('\0').filter(Boolean);
  const paths = [];
  for (let i = 0; i < parts.length; i++) {
    const code = parts[i].slice(0, 2);
    paths.push(parts[i].slice(3));
    if (code[0] === 'R' || code[0] === 'C') paths.push(parts[++i]); // the old path of a rename
  }
  return [...new Set(paths)];
}

function frontmatterDraft(file) {
  try {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return Boolean(fm && /^draft:\s*true\s*$/m.test(fm[1]));
  } catch {
    return false; // deleted file
  }
}

/** True when the file belongs to a draft: a draft markdown file, or an asset in a folder whose posts are all drafts. */
function belongsToDraft(file) {
  if (/\.(md|mdx)$/i.test(file)) return frontmatterDraft(file);
  const dir = path.posix.dirname(file);
  if (!dir.startsWith('src/content/blog/')) return false;
  let posts = [];
  try {
    posts = fs.readdirSync(path.join(ROOT, dir)).filter((f) => /^index\.(en|zh)\.mdx?$|^index\.mdx?$/.test(f));
  } catch {
    return false;
  }
  return posts.length > 0 && posts.every((f) => frontmatterDraft(`${dir}/${f}`));
}

/** The explicit allowlist: public, non-draft content that has changed. */
export function publicAllowlist() {
  const allowed = [];
  const skipped = [];
  for (const p of changedPaths()) {
    if (!PUBLIC_ROOTS.some((r) => p.startsWith(r))) continue; // not content: never published from here
    if (isPrivatePath(p)) skipped.push({ path: p, why: 'private' });
    else if (belongsToDraft(p)) skipped.push({ path: p, why: 'draft' });
    else allowed.push(p);
  }
  return { allowed, skipped };
}

/** Every private item on disk, so the build output can be searched for leaks. */
function privateFingerprints() {
  const marks = [];
  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (isPrivatePath(path.relative(ROOT, full))) {
        const rel = path.relative(ROOT, full).replace(/\\/g, '/');
        const base = e.name.replace(/\.[^.]+$/, '');
        if (/\.(md|mdx)$/i.test(e.name)) {
          const text = fs.readFileSync(full, 'utf8');
          const title = text.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1];
          if (title && title.length >= 6) marks.push({ text: title, from: rel });
          const slug = rel.match(/private\/(.+?)\/index\./)?.[1];
          if (slug) marks.push({ text: `/blog/${slug}`, from: rel });
          // the first real sentence of the body is a good fingerprint too
          const body = text.replace(/^---[\s\S]*?---/, '').split('\n').map((l) => l.trim()).find((l) => l.length >= 24 && !l.startsWith('<') && !l.startsWith('!['));
          if (body) marks.push({ text: body.slice(0, 40), from: rel });
        } else if (base.length >= 6) {
          marks.push({ text: base, from: rel }); // an image or file name
        }
      }
    }
  };
  walk(path.join(ROOT, 'src', 'content'));
  return marks;
}

export function scanDist() {
  const dist = path.join(ROOT, 'dist');
  const marks = privateFingerprints();
  const leaks = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const rel = path.relative(dist, full).replace(/\\/g, '/');
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      if (isPrivatePath(rel)) leaks.push(`dist/${rel} (a private path)`);
      for (const m of marks) if (e.name.includes(m.text)) leaks.push(`dist/${rel} (file name matches ${m.from})`);
      if (/\.(html|xml|txt|json|js|css)$/.test(e.name)) {
        const text = fs.readFileSync(full, 'utf8');
        for (const m of marks) if (text.includes(m.text)) leaks.push(`dist/${rel} contains text from ${m.from}`);
      }
    }
  };
  if (fs.existsSync(dist)) walk(dist);
  return [...new Set(leaks)];
}

/** Build the site exactly as GitHub will, then check the output for private content. */
export function buildAndScan() {
  const astro = path.join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');
  try {
    execFileSync(process.execPath, [astro, 'build'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production' } });
  } catch (e) {
    const out = `${e.stdout ?? ''}\n${e.stderr ?? ''}`.trim().split('\n').slice(-15).join('\n');
    return { ok: false, problems: ['The site does not build, so nothing was published.', out] };
  }
  const leaks = scanDist();
  if (leaks.length) return { ok: false, problems: ['Private content was found in the build output. Nothing was published.', ...leaks] };
  return { ok: true, problems: [] };
}

/** Make sure the pre-commit hook that refuses private files is installed. */
export function ensureHook() {
  const hooks = path.join(ROOT, '.git', 'hooks');
  if (!fs.existsSync(hooks)) return;
  const file = path.join(hooks, 'pre-commit');
  const body = `#!/bin/sh
# Installed by the personal blog: refuse to commit anything inside a private/ folder.
if git diff --cached --name-only | grep -Ei '(^|/)private(/|$)' >/dev/null; then
  echo "Blocked: private content is staged. Unstage it with: git reset -- <path>" >&2
  git diff --cached --name-only | grep -Ei '(^|/)private(/|$)' >&2
  exit 1
fi
`;
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== body) fs.writeFileSync(file, body, { mode: 0o755 });
}

function defaultMessage(files) {
  const names = files
    .filter((f) => /\.(md|mdx)$/.test(f))
    .map((f) => f.replace(/^src\/content\//, '').replace(/\/index\.(en|zh)\.mdx?$|\.(en|zh)\.mdx?$|\.mdx?$/, ''));
  const uniq = [...new Set(names)];
  if (uniq.length === 0) return 'Update files';
  if (uniq.length <= 3) return `Publish ${uniq.join(', ')}`;
  return `Publish ${uniq.length} items`;
}

/** Step 1: what would be published, after the build check. Changes nothing in git. */
export function preparePublish() {
  ensureHook();
  const { allowed, skipped } = publicAllowlist();
  if (allowed.length === 0) {
    return { ok: false, files: [], skipped, ahead: aheadCount(), problems: ['There are no public changes to publish.'] };
  }
  const build = buildAndScan();
  return { ok: build.ok, files: allowed, skipped, message: defaultMessage(allowed), problems: build.problems };
}

/** Step 2: stage exactly `files`, verify, commit only them, push. */
export function commitAndPush(files, message) {
  ensureHook();
  const { allowed } = publicAllowlist();
  const allowSet = new Set(allowed);
  const bad = files.filter((f) => !allowSet.has(f) || isPrivatePath(f));
  if (bad.length) return { ok: false, problems: ['These files are not allowed to be published:', ...bad] };
  if (!files.length) return { ok: false, problems: ['Nothing to publish.'] };
  if (!message || !message.trim()) return { ok: false, problems: ['The commit message is empty.'] };

  // Stage the allowlisted files only (handles new, changed and deleted files).
  git(['add', '--all', '--', ...files]);

  // Check what is staged now. Anything private or outside this publish blocks it.
  const staged = git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
  const leaked = staged.filter((p) => isPrivatePath(p));
  if (leaked.length) {
    git(['reset', '-q', '--', ...leaked, ...files]); // back to exactly how it was before, minus the leak
    return { ok: false, problems: ['Private files were staged and have been unstaged again. Nothing was published:', ...leaked] };
  }
  const extra = staged.filter((p) => !allowSet.has(p));
  if (extra.length) {
    // Do not touch the user's own staged work; just refuse to mix it in.
    git(['reset', '-q', '--', ...files]);
    return { ok: false, problems: ['Other files are already staged in git. Commit or unstage them first:', ...extra] };
  }

  try {
    git(['commit', '--only', '-q', '-m', message.trim(), '--', ...files]);
  } catch (e) {
    git(['reset', '-q', '--', ...files]);
    return { ok: false, problems: ['git commit failed.', String(e.stderr || e.message)] };
  }
  const commit = git(['rev-parse', '--short', 'HEAD']).trim();
  try {
    // Empty proxy settings skip a local proxy that may not be running.
    git(['-c', 'http.proxy=', '-c', 'https.proxy=', 'push', '-u', 'origin', 'HEAD'], { timeout: 120000 });
  } catch (e) {
    return {
      ok: false,
      commit,
      problems: [`Saved as commit ${commit}, but uploading failed. Check the connection and press Publish again.`, String(e.stderr || e.message).trim()],
    };
  }
  return { ok: true, commit, files, site: SITE, actions: ACTIONS };
}

/** Commits that are saved but not uploaded yet (e.g. after a failed push): push them. */
export function pushPending() {
  try {
    git(['-c', 'http.proxy=', '-c', 'https.proxy=', 'push', '-u', 'origin', 'HEAD'], { timeout: 120000 });
    return { ok: true, site: SITE, actions: ACTIONS };
  } catch (e) {
    return { ok: false, problems: ['Uploading failed.', String(e.stderr || e.message).trim()] };
  }
}

export function aheadCount() {
  try {
    return Number(git(['rev-list', '--count', '@{u}..HEAD']).trim()) || 0;
  } catch {
    return 0;
  }
}
