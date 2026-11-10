// Writing desk logic. Talks only to /__studio/api/* on this local server.
const $ = (s) => document.querySelector(s);
const form = $('#form');
const statusEl = $('#status');
const publishBtn = $('#publish');
const dialog = $('#confirm');
let items = [];
let current = null; // { kind, path } of the open item; path null when new
let filter = 'all';
let dirty = false;

async function api(route, { method = 'GET', body, raw } = {}) {
  const res = await fetch(`/__studio/api/${route}`, {
    method,
    headers: { 'x-studio': '1', ...(raw ? {} : body ? { 'content-type': 'application/json' } : {}) },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function say(text, error = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('is-error', error);
}

const visibility = () => form.visibility.value;

function previewUrl(it) {
  if (!it) return null;
  const zh = it.lang === 'zh' ? '/zh' : '';
  return it.kind === 'blog' ? `${zh}/blog/${it.slug}` : `${zh}/thoughts`;
}

function refreshControls() {
  const v = visibility();
  // Private writing gets no Publish button at all.
  publishBtn.hidden = v === 'private';
  publishBtn.disabled = v === 'draft';
  publishBtn.title = v === 'draft' ? 'Drafts are not published. Choose Public first.' : '';
  form.dataset.kind = current.kind;
  $('#kind-label').textContent = `${current.path ? 'Edit' : 'New'} ${current.kind === 'blog' ? 'post' : 'thought'}`;
  $('#delete').hidden = !current.path;
  const it = items.find((i) => i.path === current.path);
  const url = previewUrl(it);
  $('#preview').hidden = !url;
  if (url) $('#preview').href = url;
  $('#drop-hint').textContent = current.path
    ? 'Drop pictures onto the text to add them. They are saved in this post’s folder.'
    : 'Save the post once, then drop pictures onto the text to add them.';
}

function renderList() {
  const ul = $('#items');
  ul.replaceChildren();
  for (const it of items.filter((i) => filter === 'all' || i.kind === filter)) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'item';
    if (current?.path === it.path) b.setAttribute('aria-current', 'true');
    const title = document.createElement('span');
    title.className = 'item__title';
    title.textContent = it.title || '(untitled)';
    const meta = document.createElement('span');
    meta.className = 'item__meta';
    const kind = document.createElement('span');
    kind.textContent = `${it.kind === 'blog' ? 'Post' : 'Thought'}, ${it.lang === 'zh' ? '中文' : 'EN'}, ${it.date}`;
    const tag = document.createElement('span');
    tag.className = 'tag' + (it.visibility === 'private' ? ' tag--private' : it.status === 'not published yet' ? ' tag--pending' : '');
    tag.textContent = it.visibility === 'private' ? 'private' : it.status;
    meta.append(kind, tag);
    b.append(title, meta);
    b.addEventListener('click', () => open(it.path));
    li.append(b);
    ul.append(li);
  }
}

async function loadList() {
  const data = await api('list');
  items = data.items;
  renderList();
}

function fill(it) {
  form.title.value = it.title ?? '';
  form.slug.value = it.kind === 'blog' && it.path ? it.slug : '';
  form.lang.value = it.lang ?? 'en';
  form.date.value = it.date || new Date().toLocaleDateString('sv-SE');
  form.description.value = it.description ?? '';
  form.tags.value = (it.tags ?? []).join(', ');
  form.body.value = it.body ?? '';
  form.querySelector(`input[name="visibility"][value="${it.visibility ?? 'public'}"]`).checked = true;
  dirty = false;
}

async function open(path) {
  if (dirty && !confirm('You have unsaved changes. Leave them?')) return;
  try {
    const it = await api(`item?path=${encodeURIComponent(path)}`);
    current = { kind: it.kind, path: it.path };
    fill(it);
    location.hash = encodeURIComponent(it.path);
    refreshControls();
    renderList();
    say('');
  } catch (e) {
    say(e.message, true);
  }
}

function startNew(kind) {
  if (dirty && !confirm('You have unsaved changes. Leave them?')) return;
  current = { kind, path: null };
  fill({ kind, visibility: 'public' });
  history.replaceState(null, '', location.pathname);
  refreshControls();
  renderList();
  say('');
  (kind === 'blog' ? form.title : form.body).focus();
}

async function save() {
  const payload = {
    kind: current.kind,
    path: current.path,
    title: form.title.value,
    slug: form.slug.value,
    lang: form.lang.value,
    date: form.date.value,
    description: form.description.value,
    tags: form.tags.value.split(',').map((s) => s.trim()).filter(Boolean),
    visibility: visibility(),
    body: form.body.value,
  };
  const saved = await api('save', { method: 'POST', body: payload });
  current = { kind: saved.kind, path: saved.path };
  form.slug.value = saved.kind === 'blog' ? saved.slug : '';
  dirty = false;
  location.hash = encodeURIComponent(saved.path);
  await loadList();
  refreshControls();
  return saved;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const s = await save();
    say(s.visibility === 'private'
      ? `Saved privately on this computer: ${s.path}`
      : `Saved on this computer: ${s.path}. ${s.visibility === 'public' ? 'Press Publish when you want it online.' : 'It stays a draft.'}`);
  } catch (err) {
    say(err.message, true);
  }
});

// ---------- publishing ----------
function list(title, paths) {
  const wrap = document.createElement('div');
  const p = document.createElement('p');
  p.textContent = title;
  const ul = document.createElement('ul');
  for (const x of paths) { const li = document.createElement('li'); li.textContent = x; ul.append(li); }
  wrap.append(p, ul);
  return wrap;
}
let plan = null;

publishBtn.addEventListener('click', async () => {
  if (visibility() !== 'public') return;
  try {
    if (dirty || !current.path) await save();
  } catch (err) {
    return say(err.message, true);
  }
  publishBtn.disabled = true;
  say('Checking what can be published and building the site. This takes a few seconds…');
  try {
    plan = await api('publish/prepare', { method: 'POST' });
  } catch (err) {
    publishBtn.disabled = false;
    return say(err.message, true);
  }
  publishBtn.disabled = false;
  const body = $('#confirm-body');
  body.replaceChildren();
  const go = $('#confirm-go');
  if (!plan.files.length && plan.ahead > 0) {
    body.append(list(`${plan.ahead} saved change(s) were not uploaded last time. Upload them now?`, []));
    $('#msg-field').hidden = true;
    go.textContent = 'Upload now';
    go.disabled = false;
  } else if (!plan.files.length) {
    say('Everything public is already published.');
    return;
  } else {
    body.append(list('These files will be committed and pushed to GitHub:', plan.files));
    if (plan.skipped?.length) body.append(list('Kept on this computer (private or draft), not included:', plan.skipped.map((s) => `${s.path} (${s.why})`)));
    if (!plan.ok) {
      const pr = document.createElement('p');
      pr.className = 'problems';
      pr.textContent = plan.problems.join('\n');
      body.append(pr);
    }
    $('#msg-field').hidden = false;
    $('#msg').value = plan.message;
    go.textContent = 'Publish these files';
    go.disabled = !plan.ok;
  }
  dialog.showModal();
});

$('#confirm-cancel').addEventListener('click', () => { dialog.close(); say('Not published. Nothing was changed in git.'); });

$('#confirm-go').addEventListener('click', async () => {
  const go = $('#confirm-go');
  go.disabled = true;
  say('Publishing…');
  try {
    const r = plan.files.length
      ? await api('publish/commit', { method: 'POST', body: { files: plan.files, message: $('#msg').value } })
      : await api('publish/push', { method: 'POST' });
    dialog.close();
    if (r.ok) say(`Published${r.commit ? ` (${r.commit})` : ''}. The website updates in about a minute: ${r.site}`);
    else say(r.problems.join('\n'), true);
  } catch (err) {
    dialog.close();
    say(err.message, true);
  }
  await loadList();
  refreshControls();
});

// ---------- delete ----------
$('#delete').addEventListener('click', async () => {
  if (!current.path) return;
  const pub = visibility() !== 'private';
  if (!confirm(pub ? 'Delete this from your computer? If it was published, press Publish afterwards to remove it from the website too.' : 'Delete this private note from your computer? This cannot be undone.')) return;
  try {
    await api('delete', { method: 'POST', body: { path: current.path } });
    dirty = false;
    await loadList();
    startNew(current.kind);
    say('Deleted.');
  } catch (err) {
    say(err.message, true);
  }
});

// ---------- pictures: drop onto the text ----------
const bodyField = form.body.closest('.field');
form.body.addEventListener('dragover', (e) => { if (current.kind === 'blog') { e.preventDefault(); bodyField.classList.add('is-drop'); } });
form.body.addEventListener('dragleave', () => bodyField.classList.remove('is-drop'));
form.body.addEventListener('drop', async (e) => {
  bodyField.classList.remove('is-drop');
  if (current.kind !== 'blog' || !e.dataTransfer?.files.length) return;
  e.preventDefault();
  if (!current.path) return say('Save the post once first, then drop pictures.', true);
  for (const f of e.dataTransfer.files) {
    try {
      const r = await api(`upload?path=${encodeURIComponent(current.path)}&name=${encodeURIComponent(f.name)}`, { method: 'POST', raw: f });
      const at = form.body.selectionStart ?? form.body.value.length;
      form.body.setRangeText(`\n${r.markdown}\n`, at, at, 'end');
      dirty = true;
      say(`Added ${f.name}. Describe it inside the [ ] for people who cannot see it.`);
    } catch (err) {
      say(err.message, true);
    }
  }
});

// ---------- write in Obsidian / another app ----------
document.querySelectorAll('[data-open]').forEach((b) =>
  b.addEventListener('click', async () => {
    try {
      if (dirty || !current.path) await save();
      await api('open', { method: 'POST', body: { path: current.path, app: b.dataset.open } });
      if (b.dataset.open === 'obsidian') say('Opened in Obsidian. Write there; it saves by itself. Come back here to publish.');
      else if (b.dataset.open === 'default') say('Opened in your default Markdown app.');
    } catch (err) {
      say(err.message, true);
    }
  }),
);

// When you come back from Obsidian, pick up what you wrote there (unless there are unsaved edits here).
async function reloadCurrent() {
  await loadList().catch(() => {});
  if (!current?.path || dirty) return;
  try {
    const it = await api(`item?path=${encodeURIComponent(current.path)}`);
    const pos = form.body.selectionStart;
    fill(it);
    form.body.setSelectionRange(pos, pos);
    refreshControls();
  } catch {
    // the file was moved or deleted outside the desk
    startNew(current.kind);
    say('That file is no longer there. It may have been renamed or deleted in another app.', true);
  }
}
window.addEventListener('focus', reloadCurrent);
document.addEventListener('visibilitychange', () => { if (!document.hidden) reloadCurrent(); });

// ---------- misc ----------
form.addEventListener('input', () => { dirty = true; });
form.addEventListener('change', (e) => { if (e.target.name === 'visibility') refreshControls(); });
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); form.requestSubmit(); }
});
window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
$('#new-post').addEventListener('click', () => startNew('blog'));
$('#new-thought').addEventListener('click', () => startNew('thought'));
document.querySelectorAll('[data-filter]').forEach((b) =>
  b.addEventListener('click', () => {
    filter = b.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderList();
  }),
);

(async () => {
  await loadList().catch((e) => say(e.message, true));
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash) await open(hash);
  else startNew('blog');
})();
