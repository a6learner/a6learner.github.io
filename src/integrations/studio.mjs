// The writing desk: /studio and its /__studio/api/* endpoints.
// Registered for `astro dev` only, so `astro build` (and GitHub Pages) never contain it.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, isPrivatePath, publicAllowlist, preparePublish, commitAndPush, pushPending, aheadCount } from '../../scripts/lib/publish-core.mjs';

const CONTENT = path.join(ROOT, 'src', 'content');
const KINDS = { blog: path.join(CONTENT, 'blog'), thought: path.join(CONTENT, 'thoughts') };

// ---------- small frontmatter reader / writer for our own files ----------
function parseValue(v) {
  v = v.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    return v.slice(1, -1).split(',').map((s) => parseValue(s)).filter((s) => s !== '');
  }
  if (v.startsWith('"')) {
    try { return JSON.parse(v); } catch { return v.slice(1, -1); }
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}
function readDoc(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const data = {};
  if (!m) return { data, body: text };
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) data[kv[1]] = parseValue(kv[2]);
  }
  return { data, body: m[2].replace(/^\r?\n/, '') };
}
function writeDoc(file, data, body) {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.map((x) => JSON.stringify(String(x))).join(', ')}]` : typeof v === 'string' && k !== 'date' ? JSON.stringify(v) : v}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `---\n${lines.join('\n')}\n---\n\n${body.replace(/^\s+/, '').replace(/\s*$/, '\n')}`);
}

// ---------- locating items ----------
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
function insideContent(p) {
  const abs = path.resolve(ROOT, p);
  return Object.values(KINDS).some((k) => abs.startsWith(k + path.sep)) ? abs : null;
}
function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60);
}
const today = () => new Date().toLocaleDateString('sv-SE');

function describe(kind, file, changed) {
  const { data, body } = readDoc(file);
  const r = rel(file);
  const priv = isPrivatePath(r);
  const visibility = priv ? 'private' : data.draft ? 'draft' : 'public';
  let slug, lang;
  if (kind === 'blog') {
    const m = r.match(/^src\/content\/blog\/(?:private\/)?(.+?)\/index(?:\.(en|zh))?\.mdx?$/);
    slug = m?.[1] ?? path.basename(path.dirname(file));
    lang = m?.[2] ?? data.lang ?? 'en';
  } else {
    const m = path.basename(file).match(/^(.*?)(?:\.(en|zh))?\.mdx?$/);
    slug = m?.[1];
    lang = m?.[2] ?? data.lang ?? 'en';
  }
  const status = priv ? 'local only' : changed.has(r) ? (visibility === 'draft' ? 'draft' : 'not published yet') : visibility === 'draft' ? 'draft' : 'published';
  return {
    kind, path: r, slug, lang, visibility, status,
    title: data.title ?? body.trim().split('\n')[0].slice(0, 60),
    date: data.date ?? '',
  };
}

function listItems() {
  let changed = new Set();
  try {
    const { allowed, skipped } = publicAllowlist();
    changed = new Set([...allowed, ...skipped.map((s) => s.path)]);
  } catch {}
  const items = [];
  const walk = (kind, dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(kind, full);
      else if (/\.mdx?$/.test(e.name) && (kind === 'thought' || /^index(\.(en|zh))?\.mdx?$/.test(e.name))) items.push(describe(kind, full, changed));
    }
  };
  walk('blog', KINDS.blog);
  walk('thought', KINDS.thought);
  items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return items;
}

function targetPath(kind, visibility, slug, lang, ext = '.md') {
  const base = KINDS[kind];
  const priv = visibility === 'private' ? 'private' : '';
  return kind === 'blog'
    ? path.join(base, priv, slug, `index.${lang}${ext}`)
    : path.join(base, priv, `${slug}.${lang}${ext}`);
}

function save(input) {
  const kind = input.kind === 'thought' ? 'thought' : 'blog';
  const lang = input.lang === 'zh' ? 'zh' : 'en';
  const visibility = ['public', 'draft', 'private'].includes(input.visibility) ? input.visibility : 'public';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ? input.date : today();
  const old = input.path ? insideContent(input.path) : null;
  if (input.path && !old) throw new Error('That file is outside the blog folders.');

  let slug = slugify(input.slug || '') || slugify(input.title || '');
  if (kind === 'thought' && !slug) slug = old ? describe('thought', old, new Set()).slug : `${date}-${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}`;
  if (kind === 'blog' && !slug) slug = `post-${date}`;
  if (kind === 'blog' && !input.title?.trim()) throw new Error('A post needs a title.');

  const ext = old ? path.extname(old) : '.md';
  let file = targetPath(kind, visibility, slug, lang, ext);

  if (old && path.resolve(old) !== path.resolve(file)) {
    if (fs.existsSync(file)) throw new Error(`Something already exists at ${rel(file)}.`);
    if (kind === 'blog') {
      const oldDir = path.dirname(old);
      const newDir = path.dirname(file);
      if (oldDir !== newDir) {
        // A post is its folder: both language versions and the pictures move together.
        if (fs.existsSync(newDir)) throw new Error(`A post already exists at ${rel(newDir)}.`);
        fs.mkdirSync(path.dirname(newDir), { recursive: true });
        fs.renameSync(oldDir, newDir);
      }
      const moved = path.join(newDir, path.basename(old));
      if (moved !== file) fs.renameSync(moved, file); // language changed
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.renameSync(old, file);
    }
  } else if (!old && fs.existsSync(file)) {
    throw new Error(`Something already exists at ${rel(file)}. Choose another title or slug.`);
  }

  const prev = fs.existsSync(file) ? readDoc(file).data : {};
  const data = kind === 'blog'
    ? { ...prev, title: input.title.trim(), description: (input.description ?? '').trim(), date, tags: (input.tags ?? []).filter(Boolean), draft: visibility === 'draft' }
    : { ...prev, date, draft: visibility === 'draft' };
  delete data.lang;
  writeDoc(file, data, input.body ?? '');
  return describe(kind, file, new Set());
}

function load(p) {
  const file = insideContent(p);
  if (!file || !fs.existsSync(file)) throw new Error('Not found.');
  const kind = file.startsWith(KINDS.thought + path.sep) ? 'thought' : 'blog';
  const { data, body } = readDoc(file);
  return { ...describe(kind, file, new Set()), description: data.description ?? '', tags: data.tags ?? [], body };
}

function remove(p) {
  const file = insideContent(p);
  if (!file || !fs.existsSync(file)) throw new Error('Not found.');
  fs.rmSync(file);
  const dir = path.dirname(file);
  if (file.startsWith(KINDS.blog + path.sep) && !fs.readdirSync(dir).some((f) => /^index(\.(en|zh))?\.mdx?$/.test(f))) {
    fs.rmSync(dir, { recursive: true }); // last language gone: remove its pictures too
  }
}

function upload(p, name, buf) {
  const file = insideContent(p);
  if (!file || !file.startsWith(KINDS.blog + path.sep)) throw new Error('Save the post first, then add pictures.');
  const clean = name.replace(/[^\w.\-]+/g, '-').replace(/^-+/, '') || 'image.png';
  if (!/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(clean)) throw new Error('Only pictures can be dropped here. Put other files in public/files/.');
  let target = path.join(path.dirname(file), clean);
  for (let i = 2; fs.existsSync(target); i++) target = path.join(path.dirname(file), clean.replace(/(\.\w+)$/, `-${i}$1`));
  fs.writeFileSync(target, buf);
  return { markdown: `![](./${path.basename(target)})` };
}

// Open a file in Obsidian, in the default Markdown app, or show it in Explorer.
function openWith(p, app) {
  const file = insideContent(p);
  if (!file || !fs.existsSync(file)) throw new Error('Save it first.');
  const run = (cmd, args) => spawn(cmd, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
  // rundll32's FileProtocolHandler opens a URI or file with its registered app, with no shell parsing.
  if (app === 'obsidian') run('rundll32.exe', ['url.dll,FileProtocolHandler', `obsidian://open?path=${encodeURIComponent(file)}`]);
  else if (app === 'folder') run('explorer.exe', [`/select,"${file}"`]);
  else run('rundll32.exe', ['url.dll,FileProtocolHandler', `"${file}"`]);
}

// ---------- HTTP ----------
function readBody(req, raw = false) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (raw) return resolve(buf);
      try { resolve(buf.length ? JSON.parse(buf.toString('utf8')) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname.replace('/__studio/api/', '');
  // Only this page may call the API: a custom header cannot be sent cross-site without a CORS preflight.
  if (req.headers['x-studio'] !== '1') return send(res, 403, { error: 'Forbidden' });
  try {
    if (req.method === 'GET' && route === 'list') return send(res, 200, { items: listItems(), ahead: aheadCount() });
    if (req.method === 'GET' && route === 'item') return send(res, 200, load(url.searchParams.get('path') || ''));
    if (req.method === 'POST' && route === 'save') return send(res, 200, save(await readBody(req)));
    if (req.method === 'POST' && route === 'open') { const b = await readBody(req); openWith(b.path || '', b.app); return send(res, 200, { ok: true }); }
    if (req.method === 'POST' && route === 'delete') { remove((await readBody(req)).path || ''); return send(res, 200, { ok: true }); }
    if (req.method === 'POST' && route === 'upload') return send(res, 200, upload(url.searchParams.get('path') || '', url.searchParams.get('name') || '', await readBody(req, true)));
    if (req.method === 'POST' && route === 'publish/prepare') return send(res, 200, preparePublish());
    if (req.method === 'POST' && route === 'publish/commit') { const b = await readBody(req); return send(res, 200, commitAndPush(b.files || [], b.message || '')); }
    if (req.method === 'POST' && route === 'publish/push') return send(res, 200, pushPending());
    return send(res, 404, { error: 'Unknown endpoint' });
  } catch (e) {
    return send(res, 400, { error: e.message });
  }
}

export default function studio() {
  return {
    name: 'personal-blog-studio',
    hooks: {
      'astro:config:setup': ({ command, injectRoute, updateConfig }) => {
        if (command !== 'dev') return; // never part of a build
        injectRoute({ pattern: '/studio', entrypoint: './src/studio/Studio.astro' });
        updateConfig({
          vite: {
            plugins: [{
              name: 'personal-blog-studio-api',
              configureServer(server) {
                server.middlewares.use((req, res, next) => (req.url?.startsWith('/__studio/api/') ? handle(req, res) : next()));
              },
            }],
          },
        });
      },
    },
  };
}
