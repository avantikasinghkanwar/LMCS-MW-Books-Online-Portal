import { FORMATS, GROUP_LABELS, getFormat, exportGeometry, sizeLabel } from './formats.js';
import { DEFAULT_BRAND, FONT_CHOICES, googleFontsHref } from './brand.js';
import * as db from './db.js';
import { renderSpec, ensureFonts } from './renderer.js';
import { quickLayouts } from './templates.js';
import { generateDesigns, refineDesign, adaptDesign } from './ai.js';
import { exportImage, exportPDF, renderFull, thumbnail, download, fileBase } from './export.js';
import { buildCanvaPackage } from './canva.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const clone = (o) => JSON.parse(JSON.stringify(o));

const S = {
  brand: clone(DEFAULT_BRAND),
  apiKey: '',
  formatId: 'ig-portrait',
  custom: null,
  refIds: [],
  photoIds: [],
  variants: [],
  active: -1,
  designId: null,
  status: 'draft',
  selected: null,
  hits: [],
  bitmaps: new Map(),
  logo: { color: null, white: null },
  busy: false,
};

// ---------------------------------------------------------------- helpers

function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

async function bitmap(id) {
  if (!id) return null;
  if (S.bitmaps.has(id)) return S.bitmaps.get(id);
  const a = await db.getAsset(id);
  if (!a) return null;
  const bmp = await createImageBitmap(a.blob);
  S.bitmaps.set(id, bmp);
  return bmp;
}

async function renderAssets() {
  return { photos: await Promise.all(S.photoIds.map(bitmap)), logo: S.logo };
}

const fmt = () => getFormat(S.formatId, S.custom);
const spec = () => S.variants[S.active];

function previewGeo(f, maxSide = 1400) {
  const g = exportGeometry(f);
  const k = Math.min(1, maxSide / Math.max(g.W, g.H));
  return {
    W: Math.round(g.W * k), H: Math.round(g.H * k),
    trimW: g.trimW * k, trimH: g.trimH * k, bleedPx: g.bleedPx * k, full: g,
  };
}

function readBrief() {
  const v = (id) => $(id).value;
  return {
    branch: v('#f-branch'), purpose: v('#f-purpose'), headline: v('#f-headline'), subline: v('#f-subline'),
    details: v('#f-details'), date: v('#f-date'), time: v('#f-time'), venue: v('#f-venue'), cta: v('#f-cta'),
    contact: v('#f-contact'), link: v('#f-link'), follow: v('#f-follow'), notes: v('#f-notes'),
  };
}

function writeBrief(b = {}) {
  const set = (id, val) => { if (val != null) $(id).value = val; };
  set('#f-branch', b.branch); set('#f-purpose', b.purpose); set('#f-headline', b.headline); set('#f-subline', b.subline);
  set('#f-details', b.details); set('#f-date', b.date); set('#f-time', b.time); set('#f-venue', b.venue);
  set('#f-cta', b.cta); set('#f-contact', b.contact); set('#f-link', b.link); set('#f-follow', b.follow); set('#f-notes', b.notes);
}

function formatOptions(select, current) {
  select.innerHTML = '';
  for (const g of ['social', 'print', 'large']) {
    const og = document.createElement('optgroup');
    og.label = GROUP_LABELS[g];
    FORMATS.filter(f => f.group === g).forEach(f => og.append(new Option(f.name, f.id)));
    select.append(og);
  }
  select.append(new Option('Custom size...', 'custom'));
  if (current) select.value = current;
}

function branchOptions(select, withAll = 'All branches') {
  const cur = select.value;
  select.innerHTML = '';
  select.append(new Option(withAll, ''));
  S.brand.branches.forEach(b => select.append(new Option(b, b)));
  select.value = cur;
}

// ---------------------------------------------------------------- tabs

$$('.tabs button').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
function showTab(name) {
  $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === `tab-${name}`));
  if (name === 'library') renderLibrary();
  if (name === 'assets') renderAssetsTab();
  if (name === 'brand') fillBrandForm();
  if (name === 'studio') draw();
}

// ---------------------------------------------------------------- studio: format & brief

function onFormatChange() {
  S.formatId = $('#f-format').value;
  $('#custom-size').classList.toggle('hidden', S.formatId !== 'custom');
  if (S.formatId === 'custom') {
    const w = +$('#f-cw').value, h = +$('#f-ch').value;
    S.custom = w > 0 && h > 0 ? { w, h, unit: $('#f-cu').value } : { w: 6, h: 3, unit: 'ft' };
  }
  const f = fmt();
  const g = exportGeometry(f);
  $('#format-note').textContent = `${sizeLabel(f)}${g.dpi ? ` - exports at ${g.dpi} dpi` : ''}. ${f.note || ''}`;
  draw();
}
$('#f-format').addEventListener('change', onFormatChange);
['#f-cw', '#f-ch', '#f-cu'].forEach(id => $(id).addEventListener('change', onFormatChange));

let draftTimer;
$('#tab-studio .brief').addEventListener('input', () => {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => db.setKV('draft', { brief: readBrief(), formatId: S.formatId, custom: S.custom, refIds: S.refIds, photoIds: S.photoIds }), 600);
});

// Drop zones: files go into the asset library and onto the current brief.
function dropZone(el, kind, onAdd) {
  const input = $('input', el);
  el.addEventListener('click', () => input.click());
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('over'); addFiles([...e.dataTransfer.files], kind).then(onAdd); });
  input.addEventListener('change', () => { addFiles([...input.files], kind).then(onAdd); input.value = ''; });
}

async function addFiles(files, kind, branch = '') {
  const ids = [];
  for (const f of files.filter(f => f.type.startsWith('image/'))) {
    const id = db.uid();
    await db.putAsset({ id, kind, name: f.name, blob: f, branch: branch || $('#f-branch').value || '', tags: [], createdAt: Date.now() });
    ids.push(id);
  }
  return ids;
}

dropZone($('#drop-refs'), 'reference', ids => { S.refIds.push(...ids); renderChips(); });
dropZone($('#drop-photos'), 'photo', ids => { S.photoIds.push(...ids); renderChips(); draw(); });

async function renderChips() {
  for (const [key, box, label] of [['refIds', '#refs', 'R'], ['photoIds', '#photos', 'P']]) {
    const wrap = $(box);
    wrap.innerHTML = '';
    for (const [i, id] of S[key].entries()) {
      const a = await db.getAsset(id);
      if (!a) continue;
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `<img alt=""><b>${label}${key === 'photoIds' ? i : i + 1}</b><button title="Remove" aria-label="Remove">&times;</button>`;
      $('img', chip).src = URL.createObjectURL(a.blob);
      $('button', chip).addEventListener('click', () => { S[key].splice(i, 1); renderChips(); draw(); });
      wrap.append(chip);
    }
  }
}

// ---------------------------------------------------------------- studio: generate

function setBusy(on, msg = '') {
  S.busy = on;
  ['#btn-ai', '#btn-quick', '#btn-refine', '#btn-adapt'].forEach(id => { $(id).disabled = on; });
  const st = $('#ai-status');
  st.classList.remove('error');
  st.textContent = msg;
}

function progressReporter(label) {
  const t0 = Date.now();
  let phase = 'reading', chars = 0;
  const tick = () => {
    const s = Math.round((Date.now() - t0) / 1000);
    $('#ai-status').textContent = phase === 'writing'
      ? `${label}: laying out designs... ${s}s`
      : `${label}: studying references and brief... ${s}s`;
  };
  const iv = setInterval(tick, 1000);
  tick();
  return { update: (p) => { phase = p.phase; chars = p.chars || chars; tick(); }, stop: () => clearInterval(iv) };
}

async function blobsFor(ids) {
  return (await Promise.all(ids.map(db.getAsset))).filter(Boolean).map(a => a.blob);
}

function fail(err) {
  console.error(err);
  const st = $('#ai-status');
  st.classList.add('error');
  st.textContent = err.message || String(err);
}

$('#btn-ai').addEventListener('click', async () => {
  if (!S.apiKey) { toast('Add your Claude API key in Settings first.'); showTab('settings'); return; }
  const p = progressReporter('Designing');
  setBusy(true);
  try {
    const variants = await generateDesigns({
      apiKey: S.apiKey, brand: S.brand, brief: readBrief(), fmt: fmt(),
      refBlobs: await blobsFor(S.refIds), photoBlobs: await blobsFor(S.photoIds), onProgress: p.update,
    });
    if (!variants.length) throw new Error('No usable design came back. Try again.');
    loadVariants(variants);
    setBusy(false, `${variants.length} designs ready. Click any element to adjust it.`);
  } catch (e) { setBusy(false); fail(e); } finally { p.stop(); }
});

$('#btn-quick').addEventListener('click', () => {
  loadVariants(quickLayouts(readBrief(), S.brand, fmt(), S.photoIds.length));
  setBusy(false, 'Quick layouts ready. Use Design with AI for designs built from your references.');
});

$('#btn-refine').addEventListener('click', async () => {
  const instruction = $('#refine-text').value.trim();
  if (!spec()) return toast('Create a design first.');
  if (!instruction) return toast('Describe the change you want.');
  if (!S.apiKey) { toast('Add your Claude API key in Settings first.'); showTab('settings'); return; }
  const p = progressReporter('Refining');
  setBusy(true);
  try {
    const [v] = await refineDesign({
      apiKey: S.apiKey, brand: S.brand, brief: readBrief(), fmt: fmt(), spec: spec(), instruction,
      refBlobs: await blobsFor(S.refIds), photoBlobs: await blobsFor(S.photoIds), onProgress: p.update,
    });
    if (!v) throw new Error('No design came back. Try again.');
    S.variants.push(v);
    selectVariant(S.variants.length - 1);
    renderVariantStrip();
    $('#refine-text').value = '';
    setBusy(false, 'Change applied as a new version (previous versions stay in the strip).');
  } catch (e) { setBusy(false); fail(e); } finally { p.stop(); }
});

$('#btn-adapt').addEventListener('click', async () => {
  if (!spec()) return toast('Create a design first.');
  const toId = $('#adapt-format').value;
  if (toId === 'custom') return toast('Pick a standard size to adapt to.');
  if (!S.apiKey) { toast('Add your Claude API key in Settings first.'); showTab('settings'); return; }
  const fromFmt = fmt(), toFmt = getFormat(toId);
  const p = progressReporter(`Adapting to ${toFmt.name}`);
  setBusy(true);
  try {
    const [v] = await adaptDesign({
      apiKey: S.apiKey, brand: S.brand, brief: readBrief(), fromFmt, toFmt, spec: spec(),
      photoBlobs: await blobsFor(S.photoIds), onProgress: p.update,
    });
    if (!v) throw new Error('No design came back. Try again.');
    const baseTitle = $('#d-title').value.replace(/ - [^-]+$/, '');
    S.formatId = toId; S.custom = null; S.designId = null; S.status = 'draft';
    $('#f-format').value = toId;
    onFormatChange();
    loadVariants([v]);
    if (baseTitle) $('#d-title').value = `${baseTitle} - ${toFmt.name}`;
    setBusy(false, `Adapted to ${toFmt.name}. Save it to keep both sizes in the library.`);
  } catch (e) { setBusy(false); fail(e); } finally { p.stop(); }
});

function loadVariants(variants) {
  S.variants = variants;
  S.selected = null;
  selectVariant(0);
  renderVariantStrip();
}

function selectVariant(i) {
  S.active = i;
  S.selected = null;
  draw();
  renderTextFields();
  renderElementPanel();
  $$('#variants button').forEach((b, j) => b.classList.toggle('active', j === i));
  const v = spec();
  if (v) $('#stage-label').textContent = `${v.name || 'Design'} - ${v.rationale || ''}`;
}

async function renderVariantStrip() {
  const strip = $('#variants');
  strip.innerHTML = '';
  const f = fmt(), assets = await renderAssets();
  await ensureFonts(null, S.brand);
  S.variants.forEach((v, i) => {
    const g = previewGeo(f, 240);
    const c = document.createElement('canvas');
    c.width = g.W; c.height = g.H;
    renderSpec(c.getContext('2d'), v, S.brand, g, assets);
    const b = document.createElement('button');
    b.innerHTML = `<img alt=""><span>${i + 1}. ${v.name || 'Design'}</span>`;
    $('img', b).src = c.toDataURL('image/jpeg', 0.85);
    b.addEventListener('click', () => selectVariant(i));
    b.classList.toggle('active', i === S.active);
    strip.append(b);
  });
}

// ---------------------------------------------------------------- studio: preview & direct editing

let drawQueued = false;
function draw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(async () => {
    drawQueued = false;
    const canvas = $('#preview');
    const f = fmt();
    const g = previewGeo(f);
    if (canvas.width !== g.W || canvas.height !== g.H) { canvas.width = g.W; canvas.height = g.H; }
    const ctx = canvas.getContext('2d');
    if (!spec()) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, g.W, g.H);
      S.hits = [];
      return;
    }
    await ensureFonts(spec(), S.brand);
    S.hits = renderSpec(ctx, spec(), S.brand, g, await renderAssets(), {
      guides: $('#t-guides').checked, format: f, selected: S.selected,
    });
    S.geo = g;
  });
}
$('#t-guides').addEventListener('change', draw);

function canvasPoint(e) {
  const c = $('#preview'), r = c.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
}

let drag = null;
$('#preview').addEventListener('pointerdown', (e) => {
  if (!spec()) return;
  const p = canvasPoint(e);
  const hit = [...S.hits].reverse().find(h => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h);
  S.selected = hit ? hit.index : null;
  renderElementPanel();
  draw();
  if (hit) {
    const el = spec().elements[hit.index];
    drag = { start: p, orig: clone(el), el };
    $('#preview').setPointerCapture(e.pointerId);
  }
});
$('#preview').addEventListener('pointermove', (e) => {
  if (!drag || !S.geo) return;
  const p = canvasPoint(e);
  const dx = ((p.x - drag.start.x) / S.geo.trimW) * 100, dy = ((p.y - drag.start.y) / S.geo.trimH) * 100;
  moveElement(drag.el, drag.orig, dx, dy);
  draw();
});
$('#preview').addEventListener('pointerup', () => { if (drag) { drag = null; renderElementPanel(); renderVariantStrip(); } });

function moveElement(el, orig, dx, dy) {
  const r = (n) => Math.round(n * 10) / 10;
  if (el.type === 'line') {
    el.x1 = r(orig.x1 + dx); el.x2 = r(orig.x2 + dx); el.y1 = r(orig.y1 + dy); el.y2 = r(orig.y2 + dy);
  } else {
    el.x = r(orig.x + dx); el.y = r(orig.y + dy);
  }
}

document.addEventListener('keydown', (e) => {
  if (S.selected == null || !spec() || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  const el = spec().elements[S.selected];
  const step = e.shiftKey ? 2 : 0.5;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) {
    e.preventDefault();
    moveElement(el, clone(el), ...moves[e.key]);
    draw(); renderElementPanel();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelected();
  } else if (e.key === 'Escape') {
    S.selected = null; draw(); renderElementPanel();
  }
});

function deleteSelected() {
  if (S.selected == null) return;
  spec().elements.splice(S.selected, 1);
  S.selected = null;
  draw(); renderElementPanel(); renderTextFields(); renderVariantStrip();
}
$('#el-del').addEventListener('click', deleteSelected);
$('#el-front').addEventListener('click', () => reorder(1));
$('#el-back').addEventListener('click', () => reorder(-1));
function reorder(dir) {
  const els = spec()?.elements, i = S.selected;
  if (i == null || i + dir < 0 || i + dir >= els.length) return;
  [els[i], els[i + dir]] = [els[i + dir], els[i]];
  S.selected = i + dir;
  draw(); renderVariantStrip();
}

// ---------------------------------------------------------------- studio: side panels

const ROLE_LABEL = { headline: 'Headline', subhead: 'Supporting line', body: 'Body', detail: 'Details', cta: 'Call to action', contact: 'Contact', label: 'Label' };

function renderTextFields() {
  const box = $('#text-fields');
  const v = spec();
  if (!v) { box.textContent = 'Generate a design to edit its words here.'; return; }
  box.innerHTML = '';
  box.classList.remove('muted', 'small');
  v.elements.forEach((el, i) => {
    if (el.type !== 'text') return;
    const lab = document.createElement('label');
    lab.className = 'field';
    lab.textContent = ROLE_LABEL[el.role] || 'Text';
    const ta = document.createElement('textarea');
    ta.rows = Math.min(4, String(el.text).split('\n').length + 1);
    ta.value = el.text;
    ta.addEventListener('input', () => { el.text = ta.value; draw(); });
    ta.addEventListener('change', renderVariantStrip);
    ta.addEventListener('focus', () => { S.selected = i; draw(); renderElementPanel(); });
    lab.append(ta);
    box.append(lab);
  });
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Wrap a word in *asterisks* to colour it. Drag elements on the canvas; arrow keys nudge.';
  box.append(hint);
}

function tokenSelect(value, onChange) {
  const s = document.createElement('select');
  Object.keys(S.brand.colors).forEach(k => s.append(new Option(S.brand.colorNames?.[k] || k, k)));
  if (value && typeof value === 'string' && !S.brand.colors[value]) s.append(new Option(value, value));
  s.value = typeof value === 'string' ? value : 'primary';
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

function renderElementPanel() {
  const panel = $('#el-panel'), fields = $('#el-fields');
  const el = S.selected != null ? spec()?.elements[S.selected] : null;
  panel.classList.toggle('hidden', !el);
  if (!el) return;
  fields.innerHTML = '';
  const add = (label, input) => {
    const l = document.createElement('label');
    l.textContent = label;
    l.append(input);
    fields.append(l);
  };
  const num = (key, step = 0.5) => {
    const i = document.createElement('input');
    i.type = 'number'; i.step = step; i.value = el[key] ?? '';
    i.addEventListener('input', () => { el[key] = i.value === '' ? undefined : +i.value; draw(); });
    i.addEventListener('change', renderVariantStrip);
    return i;
  };
  const sel = (key, opts) => {
    const s = document.createElement('select');
    opts.forEach(o => s.append(new Option(String(o), String(o))));
    s.value = String(el[key] ?? opts[0]);
    s.addEventListener('change', () => { el[key] = isNaN(+s.value) ? s.value : +s.value; draw(); renderVariantStrip(); });
    return s;
  };
  const head = document.createElement('p');
  head.className = 'hint';
  head.textContent = `${el.type}${el.role ? ` (${el.role})` : ''}`;
  fields.append(head);

  if (el.type === 'text') {
    add('Size', num('size', 0.25));
    add('Colour', tokenSelect(el.color, v => { el.color = v; draw(); renderVariantStrip(); }));
    const r = document.createElement('div'); r.className = 'row';
    fields.append(r);
    const align = sel('align', ['left', 'center', 'right']), weight = sel('weight', [400, 600, 700, 800]);
    const fl = document.createElement('label'); fl.textContent = 'Align'; fl.append(align); r.append(fl);
    const wl = document.createElement('label'); wl.textContent = 'Weight'; wl.append(weight); r.append(wl);
    add('Font', sel('font', ['heading', 'body', 'accent']));
    add('Pill behind text', tokenSelectOptional('bg'));
  } else if (['rect', 'ellipse', 'folder', 'arch'].includes(el.type)) {
    if (typeof el.fill === 'string' || !el.fill) add('Fill', tokenSelect(el.fill, v => { el.fill = v; draw(); renderVariantStrip(); }));
    add('Opacity', num('opacity', 0.05));
  } else if (el.type === 'photo') {
    add('Photo', sel('slot', S.photoIds.map((_, i) => i).concat(S.photoIds.length ? [] : [0])));
    add('Shape', sel('shape', ['rect', 'rounded', 'circle', 'arch', 'folder']));
    add('Focus (vertical %)', num('focusY', 5));
  } else if (el.type === 'logo') {
    add('Version', sel('variant', ['color', 'white']));
    add('Align', sel('align', ['left', 'center', 'right']));
  } else if (el.type === 'qr') {
    const i = document.createElement('input');
    i.value = el.data || '';
    i.addEventListener('change', () => { el.data = i.value; draw(); renderVariantStrip(); });
    add('Link', i);
  }
  if (el.type !== 'line') {
    const r = document.createElement('div'); r.className = 'row';
    for (const k of ['x', 'y', 'w', 'h']) {
      const l = document.createElement('label'); l.textContent = k.toUpperCase() + ' %'; l.append(num(k)); r.append(l);
    }
    fields.append(r);
  }

  function tokenSelectOptional(key) {
    const s = tokenSelect(el[key] || 'none', v => { el[key] = v === 'none' ? undefined : v; draw(); renderVariantStrip(); });
    s.prepend(new Option('None', 'none'));
    s.value = el[key] || 'none';
    return s;
  }
}

// ---------------------------------------------------------------- studio: save & export

async function currentRecord(status) {
  const f = fmt();
  const g = previewGeo(f, 480);
  const c = document.createElement('canvas');
  c.width = g.W; c.height = g.H;
  renderSpec(c.getContext('2d'), spec(), S.brand, g, await renderAssets());
  const now = Date.now();
  const existing = S.designId ? await db.getDesign(S.designId) : null;
  return {
    id: S.designId || db.uid(),
    title: $('#d-title').value.trim() || `${readBrief().purpose} - ${f.name}`,
    formatId: S.formatId, custom: S.custom, branch: readBrief().branch, brief: readBrief(),
    spec: clone(spec()), variants: clone(S.variants), active: S.active,
    refIds: [...S.refIds], photoIds: [...S.photoIds],
    thumb: thumbnail(c), status: status || S.status,
    createdAt: existing?.createdAt || now, updatedAt: now,
  };
}

$('#btn-save').addEventListener('click', async () => {
  if (!spec()) return toast('Create a design first.');
  const rec = await currentRecord();
  await db.putDesign(rec);
  S.designId = rec.id;
  $('#d-title').value = rec.title;
  toast('Saved to the library.');
});
$('#btn-approve').addEventListener('click', async () => {
  if (!spec()) return toast('Create a design first.');
  S.status = 'approved';
  const rec = await currentRecord('approved');
  await db.putDesign(rec);
  S.designId = rec.id;
  toast('Marked approved and saved.');
});

async function runExport(kind) {
  if (!spec()) return toast('Create a design first.');
  const missing = spec().elements.filter(e => e.type === 'photo' && !S.photoIds[e.slot ?? 0]).length;
  if (missing) toast(`Note: ${missing} photo frame(s) have no photo and will export empty.`, 4000);
  const title = $('#d-title').value.trim() || readBrief().purpose;
  const info = $('#export-info');
  info.textContent = 'Rendering full resolution...';
  try {
    const assets = await renderAssets();
    if (kind === 'pdf') {
      const { geo, page } = await exportPDF(spec(), S.brand, fmt(), assets, title, { cropMarks: $('#t-crop').checked });
      info.textContent = `PDF: ${geo.W} x ${geo.H} px at ${geo.dpi} dpi, bleed included${page.scale > 1 ? `, saved at 1:${page.scale} scale (tell the printer)` : ''}.`;
    } else {
      const geo = await exportImage(spec(), S.brand, fmt(), assets, title, kind);
      info.textContent = `${kind.toUpperCase()}: ${geo.W} x ${geo.H} px${geo.dpi ? ` at ${geo.dpi} dpi incl. bleed` : ''}.`;
    }
  } catch (e) {
    info.textContent = e.message;
  }
}
$('#btn-png').addEventListener('click', () => runExport('png'));
$('#btn-jpg').addEventListener('click', () => runExport('jpg'));
$('#btn-pdf').addEventListener('click', () => runExport('pdf'));

$('#btn-canva').addEventListener('click', async () => {
  if (!spec()) return toast('Create a design first.');
  const info = $('#export-info');
  info.textContent = 'Preparing Canva package...';
  try {
    const title = $('#d-title').value.trim() || `${readBrief().purpose} - ${fmt().name}`;
    const pkg = await buildCanvaPackage(spec(), S.brand, fmt(), await renderAssets(), title);
    download(new Blob([JSON.stringify(pkg)], { type: 'application/json' }), `${fileBase(title, fmt())}.canva.json`);
    const native = pkg.layers.filter(l => l.kind !== 'image' || l.canvaAssetId).length;
    info.textContent = `Canva package ready: ${native} editable layers, ${Object.keys(pkg.images).length} image layers. ` +
      'Attach it in Claude and say "send this to Canva".';
  } catch (e) {
    info.textContent = e.message;
  }
});

// ---------------------------------------------------------------- library

async function renderLibrary() {
  const grid = $('#lib-grid');
  const branch = $('#lib-branch').value, status = $('#lib-status').value;
  const list = (await db.listDesigns()).filter(d => (!branch || d.branch === branch) && (!status || d.status === status));
  grid.innerHTML = list.length ? '' : '<p class="empty">No designs yet. Saved designs appear here.</p>';
  for (const d of list) {
    const f = getFormat(d.formatId, d.custom);
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = `${d.status === 'approved' ? '<span class="badge">Approved</span>' : ''}<img alt="">
      <div class="meta"><strong></strong><span class="muted"></span></div>
      <div class="tools"><button class="ghost small" data-a="open">Open</button><button class="ghost small" data-a="dup">Duplicate</button><button class="ghost small danger" data-a="del">Delete</button></div>`;
    $('img', tile).src = d.thumb;
    $('strong', tile).textContent = d.title;
    $('.meta span', tile).textContent = `${f.name}${d.branch ? ` - ${d.branch}` : ''} - ${new Date(d.updatedAt).toLocaleDateString()}`;
    tile.addEventListener('click', async (e) => {
      const a = e.target.dataset?.a;
      if (a === 'open') openDesign(d);
      if (a === 'dup') { await db.putDesign({ ...d, id: db.uid(), title: `${d.title} (copy)`, status: 'draft', createdAt: Date.now(), updatedAt: Date.now() }); renderLibrary(); }
      if (a === 'del' && confirm(`Delete "${d.title}"?`)) { await db.deleteDesign(d.id); renderLibrary(); }
    });
    grid.append(tile);
  }
}
$('#lib-branch').addEventListener('change', renderLibrary);
$('#lib-status').addEventListener('change', renderLibrary);

function openDesign(d) {
  S.formatId = d.formatId; S.custom = d.custom; S.designId = d.id; S.status = d.status;
  S.refIds = d.refIds || []; S.photoIds = d.photoIds || [];
  writeBrief(d.brief);
  $('#f-format').value = d.formatId;
  if (d.custom) { $('#f-cw').value = d.custom.w; $('#f-ch').value = d.custom.h; $('#f-cu').value = d.custom.unit; }
  $('#d-title').value = d.title;
  showTab('studio');
  onFormatChange();
  renderChips();
  S.variants = d.variants?.length ? clone(d.variants) : [clone(d.spec)];
  selectVariant(Math.min(d.active ?? 0, S.variants.length - 1));
  renderVariantStrip();
}

// ---------------------------------------------------------------- assets tab

async function loadLogo() {
  for (const v of ['color', 'white']) {
    const a = await db.getAsset(`logo-${v}`);
    S.logo[v] = a ? await createImageBitmap(a.blob) : null;
    const prev = $(`#logo-${v}-prev`);
    prev.innerHTML = '';
    if (a) { const img = new Image(); img.src = URL.createObjectURL(a.blob); img.alt = `${v} logo`; prev.append(img); }
    else prev.textContent = 'No logo yet - a typeset wordmark is used';
  }
}

let logoTarget = 'color';
$$('[data-logo]').forEach(b => b.addEventListener('click', () => { logoTarget = b.dataset.logo; $('#logo-input').click(); }));
$('#logo-input').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  await db.putAsset({ id: `logo-${logoTarget}`, kind: 'logo', name: f.name, blob: f, branch: '', tags: [logoTarget], createdAt: Date.now() });
  e.target.value = '';
  await loadLogo();
  draw(); renderVariantStrip();
  toast('Logo saved.');
});

$('#add-photos').addEventListener('click', () => $('#photo-input').click());
$('#photo-input').addEventListener('change', async (e) => {
  await addFiles([...e.target.files], 'photo', $('#photo-branch').value);
  e.target.value = '';
  renderAssetsTab();
});
$('#add-refs').addEventListener('click', () => $('#ref-input').click());
$('#ref-input').addEventListener('change', async (e) => {
  await addFiles([...e.target.files], 'reference');
  e.target.value = '';
  renderAssetsTab();
});

async function assetGrid(gridSel, kind, onPick) {
  const grid = $(gridSel);
  const items = await db.listAssets(kind);
  grid.innerHTML = items.length ? '' : '<p class="empty">Nothing here yet.</p>';
  for (const a of items) {
    const tile = document.createElement('div');
    tile.className = 'tile selectable';
    tile.dataset.id = a.id;
    tile.innerHTML = `<img alt=""><div class="meta"><span class="muted"></span></div><div class="tools"><button class="ghost small danger">Delete</button></div>`;
    $('img', tile).src = URL.createObjectURL(a.blob);
    $('.meta span', tile).textContent = a.branch || 'All branches';
    tile.addEventListener('click', async (e) => {
      if (e.target.tagName === 'BUTTON') {
        if (confirm('Delete this picture from the library?')) { await db.deleteAsset(a.id); S.bitmaps.delete(a.id); assetGrid(gridSel, kind, onPick); }
        return;
      }
      onPick?.(a, tile);
    });
    grid.append(tile);
  }
}

function renderAssetsTab() {
  loadLogo();
  assetGrid('#photo-grid', 'photo', (a) => { if (!S.photoIds.includes(a.id)) S.photoIds.push(a.id); renderChips(); toast('Added to the current brief.'); });
  assetGrid('#ref-grid', 'reference', (a) => { if (!S.refIds.includes(a.id)) S.refIds.push(a.id); renderChips(); toast('Added to the current brief.'); });
}

$('#pick-photos').addEventListener('click', async () => {
  const dlg = $('#picker');
  await assetGrid('#picker-grid', 'photo', (a, tile) => {
    const i = S.photoIds.indexOf(a.id);
    if (i >= 0) S.photoIds.splice(i, 1); else S.photoIds.push(a.id);
    tile.classList.toggle('picked', i < 0);
  });
  $$('#picker-grid .tile').forEach(t => t.classList.toggle('picked', S.photoIds.includes(t.dataset.id)));
  dlg.showModal();
});
$('#picker-done').addEventListener('click', () => { $('#picker').close(); renderChips(); draw(); });

// ---------------------------------------------------------------- brand tab

function fillBrandForm() {
  const b = S.brand;
  $('#b-name').value = b.name; $('#b-short').value = b.shortName; $('#b-phone').value = b.phone;
  $('#b-tagline').value = b.tagline; $('#b-milestone').value = b.milestone || '';
  $('#b-web').value = b.website || ''; $('#b-insta').value = b.instagram || '';
  $('#b-branches').value = b.branches.join(', ');
  $('#b-voice').value = b.voice; $('#b-motifs').value = b.motifs; $('#b-rules').value = b.rules;
  const cv = b.canva || {};
  $('#b-cv-kit').value = cv.brandKitId || ''; $('#b-cv-folder').value = cv.folderName || '';
  $('#b-cv-logo').value = cv.logoAssetId || ''; $('#b-cv-logo-w').value = cv.logoWhiteAssetId || '';
  $('#b-cv-aspect').value = cv.logoAspect || 1; $('#b-cv-base').value = cv.baseDesignId || '';
  const wrap = $('#b-colors');
  wrap.innerHTML = '';
  for (const [k, v] of Object.entries(b.colors)) {
    const l = document.createElement('label');
    l.innerHTML = `<input data-name="${k}" value=""><input type="color" data-color="${k}">`;
    $('[data-name]', l).value = b.colorNames?.[k] || k;
    $('[data-color]', l).value = v;
    wrap.append(l);
  }
  for (const role of ['heading', 'body', 'accent']) {
    const s = $(`#b-font-${role}`);
    s.innerHTML = '';
    FONT_CHOICES.forEach(f => s.append(new Option(f, f)));
    s.value = b.fonts[role];
    s.onchange = typePreview;
  }
  typePreview();
}

function typePreview() {
  const h = $('#b-font-heading').value, bo = $('#b-font-body').value, ac = $('#b-font-accent').value;
  $('#type-preview').innerHTML = `
    <div style="font:800 30px '${h}';color:${S.brand.colors.secondary}">Admissions <span style="color:${S.brand.colors.primary}">open</span></div>
    <div style="font:400 15px '${bo}';margin:.3em 0">Montessori learning for ages 2 to 12, guided by trained teachers.</div>
    <div style="font:400 24px '${ac}';color:${S.brand.colors.accent}">${S.brand.tagline}</div>`;
}

$('#b-save').addEventListener('click', async () => {
  const b = S.brand;
  b.name = $('#b-name').value.trim(); b.shortName = $('#b-short').value.trim(); b.phone = $('#b-phone').value.trim();
  b.tagline = $('#b-tagline').value.trim(); b.milestone = $('#b-milestone').value.trim();
  b.website = $('#b-web').value.trim(); b.instagram = $('#b-insta').value.trim();
  b.branches = $('#b-branches').value.split(',').map(s => s.trim()).filter(Boolean);
  b.voice = $('#b-voice').value.trim(); b.motifs = $('#b-motifs').value.trim(); b.rules = $('#b-rules').value.trim();
  $$('#b-colors [data-color]').forEach(i => { b.colors[i.dataset.color] = i.value; });
  $$('#b-colors [data-name]').forEach(i => { b.colorNames[i.dataset.name] = i.value.trim(); });
  for (const role of ['heading', 'body', 'accent']) b.fonts[role] = $(`#b-font-${role}`).value;
  b.canva = {
    brandKitId: $('#b-cv-kit').value.trim(), folderName: $('#b-cv-folder').value.trim() || 'LMCS Design',
    logoAssetId: $('#b-cv-logo').value.trim(), logoWhiteAssetId: $('#b-cv-logo-w').value.trim(),
    logoAspect: +$('#b-cv-aspect').value || 1, baseDesignId: $('#b-cv-base').value.trim(),
  };
  await db.setKV('brand', b);
  refreshBranchSelects();
  toast('Brand saved. New and existing designs now use it.');
});
$('#b-reset').addEventListener('click', async () => {
  if (!confirm('Reset brand settings to the LMS defaults?')) return;
  S.brand = clone(DEFAULT_BRAND);
  await db.setKV('brand', S.brand);
  fillBrandForm();
  refreshBranchSelects();
});

function refreshBranchSelects() {
  branchOptions($('#f-branch'), 'All branches (network)');
  branchOptions($('#lib-branch'));
  branchOptions($('#photo-branch'));
}

// ---------------------------------------------------------------- settings

$('#s-key-save').addEventListener('click', async () => {
  S.apiKey = $('#s-key').value.trim();
  await db.setKV('apiKey', S.apiKey);
  $('#s-key-status').textContent = S.apiKey ? 'Key saved in this browser.' : 'Key removed.';
});
$('#s-backup').addEventListener('click', async () => {
  $('#s-db-status').textContent = 'Preparing backup...';
  const data = await db.exportBackup();
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `lmcs-design-backup-${new Date().toISOString().slice(0, 10)}.json`);
  $('#s-db-status').textContent = `Backup downloaded: ${data.designs.length} designs, ${data.assets.length} pictures.`;
});
$('#s-restore').addEventListener('click', () => $('#s-restore-input').click());
$('#s-restore-input').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    await db.importBackup(JSON.parse(await f.text()));
    S.brand = { ...clone(DEFAULT_BRAND), ...(await db.getKV('brand', {})) };
    await loadLogo();
    refreshBranchSelects();
    $('#s-db-status').textContent = 'Backup restored.';
  } catch (err) {
    $('#s-db-status').textContent = err.message;
  }
  e.target.value = '';
});

// ---------------------------------------------------------------- init

async function init() {
  $('#gfonts').href = googleFontsHref();
  const saved = await db.getKV('brand');
  if (saved) S.brand = { ...clone(DEFAULT_BRAND), ...saved, colors: { ...DEFAULT_BRAND.colors, ...saved.colors }, fonts: { ...DEFAULT_BRAND.fonts, ...saved.fonts }, canva: { ...DEFAULT_BRAND.canva, ...saved.canva } };
  S.apiKey = await db.getKV('apiKey', '');
  $('#s-key').value = S.apiKey;
  formatOptions($('#f-format'), S.formatId);
  formatOptions($('#adapt-format'), 'flex-10x4');
  $('#adapt-format').querySelector('option[value="custom"]').remove();
  refreshBranchSelects();
  $('#f-contact').value = S.brand.phone;
  const draft = await db.getKV('draft');
  if (draft) {
    writeBrief(draft.brief);
    S.formatId = draft.formatId || S.formatId;
    S.custom = draft.custom;
    S.refIds = draft.refIds || [];
    S.photoIds = draft.photoIds || [];
    $('#f-format').value = S.formatId;
  }
  await loadLogo();
  onFormatChange();
  renderChips();
  window.addEventListener('resize', draw);
}
init();
