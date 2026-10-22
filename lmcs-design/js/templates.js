// Built-in LMS layouts. They need no API key, and they serve as fallbacks and starting points.
// Each returns a spec in the same format the AI designer produces.

const DEFAULT_HEADLINES = {
  Admissions: 'Admissions *open*',
  Event: 'You are *invited*',
  Celebration: 'Proud *moments*',
  Hiring: "We're *hiring*",
  Announcement: 'Important *update*',
  Festival: 'Warm *wishes*',
  Workshop: 'Parent *workshop*',
};

function copy(b, brand) {
  const factList = [b.date, b.time, b.venue].filter(s => s && s.trim());
  const facts = factList.join('  |  ');
  return {
    stacked: [factList.join('\n'), (b.details || '').trim()].filter(Boolean).join('\n\n'),
    headline: (b.headline && b.headline.trim()) || DEFAULT_HEADLINES[b.purpose] || 'La Montessori *Schools*',
    subline: (b.subline || '').trim() || brand.tagline,
    details: [facts, (b.details || '').trim()].filter(Boolean).join('\n'),
    cta: (b.cta || '').trim(),
    contact: `Call ${(b.contact || brand.phone || '').trim()}` + (b.branch ? `  |  ${b.branch}` : ''),
    link: (b.link || '').trim(),
  };
}

const shapeOf = (fmt) => {
  const r = fmt.w / fmt.h;
  return r >= 2 ? 'wide' : r > 1.15 ? 'landscape' : r < 0.7 ? 'tall' : r < 0.87 ? 'portrait' : 'square';
};

// --- 1. Folder Panel: the LMS layered folder-tab look -------------------------------------
function folderPanel(b, brand, fmt, nPhotos) {
  const t = copy(b, brand), s = shapeOf(fmt), hasPhoto = nPhotos > 0;
  if (s === 'wide' || s === 'landscape') {
    return {
      name: 'Folder Panel', rationale: 'Layered LMS folder-tab panels carry the brand; the headline reads first from a distance.',
      background: { color: 'primary', pattern: { type: 'none' } },
      elements: [
        { type: 'folder', x: 3, y: 9, w: 94, h: 87, fill: 'accent', tabW: 22, tabH: 9, radius: 1.5 },
        { type: 'folder', x: 1.5, y: 11, w: 95, h: 89, fill: 'secondary', tabW: 20, tabH: 9, radius: 1.5 },
        { type: 'logo', x: 6, y: 25, w: 26, h: 16, variant: 'white' },
        { type: 'text', role: 'headline', text: t.headline, x: 6, y: 44, w: hasPhoto ? 50 : 86, h: 28, font: 'heading', weight: 800, size: s === 'wide' ? 19 : 13, color: 'white', emphasisColor: 'accent', lineHeight: 1.02 },
        { type: 'text', role: 'subhead', text: t.subline, x: 6, y: 73, w: hasPhoto ? 50 : 86, h: 8, font: 'body', weight: 600, size: 4.5, color: 'white' },
        ...(hasPhoto ? [{ type: 'photo', slot: 0, x: 60, y: 24, w: 34, h: 58, shape: 'rounded', radius: 2, stroke: 'white', strokeWidth: 0.6 }] : []),
        { type: 'text', role: 'contact', text: t.contact, x: 6, y: 84, w: 60, h: 9, font: 'heading', weight: 700, size: 6.5, color: 'accent' },
        ...(t.cta ? [{ type: 'text', role: 'cta', text: t.cta, x: 66, y: 84, w: 28, h: 9, font: 'heading', weight: 700, size: 4.5, color: 'dark', bg: 'accent', align: 'right', valign: 'middle' }] : []),
      ],
    };
  }
  return {
    name: 'Folder Panel', rationale: 'Layered LMS folder-tab panels carry the brand; one photo framed inside the panel.',
    background: { color: 'primary', pattern: { type: 'none' } },
    elements: [
      { type: 'folder', x: 20, y: 7, w: 85, h: 95, fill: 'accent', tabW: 35, tabH: 5, radius: 3 },
      { type: 'folder', x: 6, y: 7, w: 94, h: 95, fill: 'secondary', tabW: 30, tabH: 5, radius: 3 },
      { type: 'logo', x: 12, y: 15, w: 40, h: 8, variant: 'white' },
      { type: 'text', role: 'headline', text: t.headline, x: 12, y: 25, w: 80, h: 17, font: 'heading', weight: 800, size: 11, color: 'white', emphasisColor: 'accent', lineHeight: 1.02 },
      { type: 'text', role: 'subhead', text: t.subline, x: 12, y: 43, w: 80, h: 5, font: 'body', weight: 600, size: 3.4, color: 'white' },
      ...(hasPhoto
        ? [{ type: 'photo', slot: 0, x: 12, y: 50, w: 80, h: 30, shape: 'rect', stroke: 'white', strokeWidth: 0.5 }]
        : [{ type: 'text', role: 'detail', text: t.details || brand.milestone || '', x: 12, y: 52, w: 80, h: 26, font: 'body', weight: 400, size: 4, color: 'white' }]),
      ...(t.cta ? [{ type: 'text', role: 'cta', text: t.cta, x: 50, y: 76, w: 42, h: 7, font: 'heading', weight: 700, size: 3.2, color: 'dark', bg: 'accent', bgRadius: 0.5, align: 'right', valign: 'middle' }] : []),
      { type: 'text', role: 'detail', text: hasPhoto ? t.details : '', x: 12, y: 84, w: 80, h: 6, font: 'body', weight: 600, size: 3, color: 'white' },
      { type: 'text', role: 'contact', text: t.contact, x: 12, y: 90.5, w: 80, h: 5, font: 'body', weight: 700, size: 3, color: 'accent' },
    ],
  };
}

// --- 2. Photo Hero: one strong photo, calm white panel ---------------------------------------
function photoHero(b, brand, fmt, nPhotos) {
  const t = copy(b, brand), s = shapeOf(fmt);
  const photo = nPhotos > 0
    ? (box) => ({ type: 'photo', slot: 0, ...box })
    : (box) => ({ type: 'rect', ...box, fill: { from: 'secondary', to: 'dark', angle: 135 } });
  if (s === 'wide' || s === 'landscape') {
    return {
      name: 'Photo Hero', rationale: 'Half photo, half calm panel: the image sells the moment, the panel carries the message.',
      background: { color: 'white', pattern: { type: 'none' } },
      elements: [
        photo({ x: 52, y: 0, w: 48, h: 100 }),
        { type: 'rect', x: 0, y: 0, w: 1.6, h: 100, fill: 'primary' },
        { type: 'logo', x: 6, y: 8, w: 30, h: 15, variant: 'color' },
        { type: 'text', role: 'headline', text: t.headline, x: 6, y: 28, w: 42, h: 30, font: 'heading', weight: 800, size: s === 'wide' ? 17 : 12, color: 'secondary', emphasisColor: 'primary', lineHeight: 1.02 },
        { type: 'line', x1: 6, y1: 61, x2: 18, y2: 61, color: 'accent', width: 0.9 },
        { type: 'text', role: 'detail', text: t.details || t.subline, x: 6, y: 65, w: 42, h: 14, font: 'body', weight: 600, size: 4.5, color: 'ink' },
        { type: 'text', role: 'contact', text: t.contact, x: 6, y: 83, w: 42, h: 9, font: 'heading', weight: 700, size: 6, color: 'primary' },
      ],
    };
  }
  return {
    name: 'Photo Hero', rationale: 'One dominant photo under an arch-free clean crop; the white panel keeps text crisp.',
    background: { color: 'white', pattern: { type: 'none' } },
    elements: [
      photo({ x: 0, y: 0, w: 100, h: 52 }),
      { type: 'rect', x: 0, y: 52, w: 100, h: 1.2, fill: 'accent' },
      { type: 'rect', x: 6, y: 4, w: 46, h: 9, fill: 'white', radius: 1.5, opacity: 0.94 },
      { type: 'logo', x: 8, y: 5, w: 42, h: 7, variant: 'color' },
      { type: 'text', role: 'headline', text: t.headline, x: 7, y: 57, w: 86, h: 15, font: 'heading', weight: 800, size: 10, color: 'secondary', emphasisColor: 'primary', lineHeight: 1.02 },
      { type: 'text', role: 'subhead', text: t.subline, x: 7, y: 72.5, w: 86, h: 5, font: 'body', weight: 600, size: 3.4, color: 'ink' },
      { type: 'text', role: 'detail', text: t.details, x: 7, y: 78.5, w: 86, h: 9, font: 'body', weight: 400, size: 3, color: 'ink' },
      { type: 'rect', x: 0, y: 89, w: 100, h: 11, fill: 'secondary' },
      { type: 'text', role: 'contact', text: t.contact, x: 7, y: 90.5, w: t.cta ? 50 : 86, h: 8, font: 'heading', weight: 700, size: 3.4, color: 'white', valign: 'middle' },
      ...(t.cta ? [{ type: 'text', role: 'cta', text: t.cta, x: 58, y: 91, w: 35, h: 7, font: 'heading', weight: 700, size: 3, color: 'dark', bg: 'accent', align: 'right', valign: 'middle' }] : []),
    ],
  };
}

// --- 3. Editorial Calm: warm white, refined type, arch photo ---------------------------------
function editorialCalm(b, brand, fmt, nPhotos) {
  const t = copy(b, brand), s = shapeOf(fmt), hasPhoto = nPhotos > 0;
  if (s === 'wide' || s === 'landscape') {
    return {
      name: 'Editorial Calm', rationale: 'Warm white space and confident type give a premium, institutional feel.',
      background: { color: 'light', pattern: { type: 'none' } },
      elements: [
        hasPhoto
          ? { type: 'photo', slot: 0, x: 64, y: 12, w: 30, h: 88, shape: 'arch' }
          : { type: 'arch', x: 64, y: 12, w: 30, h: 88, fill: 'secondary' },
        { type: 'ellipse', x: 86, y: 6, w: 9, h: 9 * fmt.w / fmt.h, fill: 'accent' },
        { type: 'logo', x: 6, y: 8, w: 28, h: 13, variant: 'color' },
        { type: 'text', role: 'label', text: (b.purpose || 'LMS').toUpperCase(), x: 6, y: 27, w: 40, h: 6, font: 'body', weight: 700, size: 3.2, color: 'primary', letterSpacing: 0.16 },
        { type: 'text', role: 'headline', text: t.headline, x: 6, y: 34, w: 54, h: 30, font: 'heading', weight: 700, size: s === 'wide' ? 16 : 11, color: 'dark', emphasisColor: 'primary', lineHeight: 1.04 },
        { type: 'text', role: 'detail', text: t.details || t.subline, x: 6, y: 66, w: 54, h: 13, font: 'body', weight: 400, size: 4.5, color: 'ink' },
        { type: 'text', role: 'contact', text: t.contact, x: 6, y: 84, w: 54, h: 8, font: 'heading', weight: 700, size: 5.5, color: 'secondary' },
      ],
    };
  }
  return {
    name: 'Editorial Calm', rationale: 'Warm white space, a single arch photo and confident type give a premium, institutional feel.',
    background: { color: 'light', pattern: { type: 'none' } },
    elements: [
      { type: 'logo', x: 8, y: 5, w: 44, h: 7, variant: 'color' },
      { type: 'text', role: 'label', text: (b.purpose || 'LMS').toUpperCase(), x: 8, y: 15, w: 60, h: 4, font: 'body', weight: 700, size: 2.6, color: 'primary', letterSpacing: 0.16 },
      { type: 'text', role: 'headline', text: t.headline, x: 8, y: 19.5, w: 84, h: 16, font: 'heading', weight: 700, size: 10, color: 'dark', emphasisColor: 'primary', lineHeight: 1.04 },
      hasPhoto
        ? { type: 'photo', slot: 0, x: 30, y: 39, w: 62, h: 41, shape: 'arch' }
        : { type: 'arch', x: 30, y: 39, w: 62, h: 41, fill: 'secondary' },
      { type: 'ellipse', x: 78, y: 35, w: 12, h: 12 * fmt.w / fmt.h, fill: 'accent' },
      { type: 'text', role: 'detail', text: t.stacked || t.subline, x: 8, y: 40, w: 20, h: 38, font: 'body', weight: 600, size: 2.8, color: 'ink', lineHeight: 1.4 },
      { type: 'line', x1: 8, y1: 85, x2: 92, y2: 85, color: 'secondary', width: 0.25 },
      { type: 'text', role: 'contact', text: t.contact, x: 8, y: 87, w: 60, h: 6, font: 'heading', weight: 700, size: 3.2, color: 'secondary' },
      ...(t.cta ? [{ type: 'text', role: 'cta', text: t.cta, x: 62, y: 87, w: 30, h: 6, font: 'heading', weight: 700, size: 2.8, color: 'white', bg: 'primary', align: 'right', valign: 'middle' }] : []),
    ],
  };
}

export const TEMPLATES = [
  { id: 'folder', name: 'Folder Panel', build: folderPanel },
  { id: 'hero', name: 'Photo Hero', build: photoHero },
  { id: 'editorial', name: 'Editorial Calm', build: editorialCalm },
];

// Squeeze content (not edge-to-edge panels) into a vertical band, for formats with
// unusable zones: story UI overlays, the standee base.
function fitVertical(spec, top, bottom) {
  const k = (bottom - top) / 100;
  for (const el of spec.elements) {
    const fullBleed = (el.y ?? 0) <= 0.6 || (el.y ?? 0) + (el.h ?? 0) >= 99.4;
    if (el.type === 'line') { el.y1 = top + el.y1 * k; el.y2 = top + el.y2 * k; continue; }
    if (fullBleed && el.type !== 'text' && el.type !== 'logo') continue;
    el.y = top + el.y * k;
    el.h = el.h * k;
  }
  return spec;
}

const BANDS = { story: [11, 84], standee: [2, 86] };

export function quickLayouts(brief, brand, fmt, nPhotos) {
  return TEMPLATES.map(t => {
    const spec = t.build(brief, brand, fmt, nPhotos);
    return BANDS[fmt.id] ? fitVertical(spec, ...BANDS[fmt.id]) : spec;
  });
}
