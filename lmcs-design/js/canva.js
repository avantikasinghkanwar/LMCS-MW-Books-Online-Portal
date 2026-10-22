// Canva bridge: turns a design spec into a package of Canva-native layers.
//
// Solid shapes and text become real, editable Canva elements (insert_shape / add_text).
// Things Canva's editing API can't express natively - photos with masks, gradients,
// patterns, QR codes - are flattened into image layers. The logo uses the LMS logo
// already in the Canva library, so the brand kit stays the source of truth.
//
// Claude builds the package into Canva with the lmcs-canva-bridge skill
// (skills/lmcs-canva-bridge), using the Canva connector.

import { resolveColor } from './brand.js';
import { renderSpec, ensureFonts } from './renderer.js';

const CANVA_MAX = 8000;   // Canva page side limit (px)
const CANVA_PX_PER_IN = 96; // Canva measures print designs at 96 px per inch

// Canva page size for a format, plus how much finer rasters should be for print.
export function canvaPage(fmt) {
  if (fmt.unit === 'px') return { width: fmt.w, height: fmt.h, scale: 1, raster: 1.5, note: '' };
  const inW = fmt.unit === 'mm' ? fmt.w / 25.4 : fmt.w, inH = fmt.unit === 'mm' ? fmt.h / 25.4 : fmt.h;
  let w = inW * CANVA_PX_PER_IN, h = inH * CANVA_PX_PER_IN;
  const scale = Math.min(1, CANVA_MAX / Math.max(w, h));
  w = Math.round(w * scale); h = Math.round(h * scale);
  const dpi = fmt.dpi || 300;
  const raster = Math.min(3.2, (dpi / CANVA_PX_PER_IN) / scale);
  const note = scale < 1
    ? `Canva page is ${Math.round(scale * 100)}% of the real size (Canva's 8000 px limit). Print at ${Math.round(100 / scale)}% or set the real size with Canva's Resize.`
    : 'Turn on File > Show print bleed in Canva before downloading a print PDF.';
  return { width: w, height: h, scale, raster, note };
}

const r2 = (n) => Math.round(n * 100) / 100;

function shapePath(type, w, h, el, radiusPx) {
  const W = r2(w), H = r2(h);
  if (type === 'ellipse') {
    return `M0 ${r2(h / 2)} A${r2(w / 2)} ${r2(h / 2)} 0 1 0 ${W} ${r2(h / 2)} A${r2(w / 2)} ${r2(h / 2)} 0 1 0 0 ${r2(h / 2)} Z`;
  }
  if (type === 'arch') {
    const rr = r2(Math.min(w / 2, h));
    return `M0 ${H} L0 ${rr} A${r2(w / 2)} ${rr} 0 0 1 ${W} ${rr} L${W} ${H} Z`;
  }
  if (type === 'folder') {
    const tw = w * ((el.tabW ?? 35) / 100);
    const th = Math.max(h * ((el.tabH ?? 7) / 100), 4);
    const rad = r2(Math.min(radiusPx || th * 0.6, th, tw / 3));
    return `M0 ${H} L0 ${rad} A${rad} ${rad} 0 0 1 ${rad} 0 L${r2(tw - rad)} 0 A${rad} ${rad} 0 0 1 ${r2(tw)} ${rad} L${r2(tw)} ${r2(th)} L${W} ${r2(th)} L${W} ${H} Z`;
  }
  const rad = r2(Math.min(radiusPx || 0, w / 2, h / 2));
  if (!rad) return `M0 0 L${W} 0 L${W} ${H} L0 ${H} Z`;
  return `M${rad} 0 L${r2(w - rad)} 0 A${rad} ${rad} 0 0 1 ${W} ${rad} L${W} ${r2(h - rad)} A${rad} ${rad} 0 0 1 ${r2(w - rad)} ${H} L${rad} ${H} A${rad} ${rad} 0 0 1 0 ${r2(h - rad)} L0 ${rad} A${rad} ${rad} 0 0 1 ${rad} 0 Z`;
}

const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c.toLowerCase() : null);

// Render part of a spec (background only, or one element) to an image data URL.
function rasterize(spec, brand, page, assets, { box, k, background, type = 'image/png' }) {
  const geo = { W: page.width * k, H: page.height * k, trimW: page.width * k, trimH: page.height * k, bleedPx: 0 };
  const c = document.createElement('canvas');
  const b = box || { x: 0, y: 0, w: page.width, h: page.height };
  c.width = Math.max(1, Math.round(b.w * k));
  c.height = Math.max(1, Math.round(b.h * k));
  const ctx = c.getContext('2d');
  ctx.translate(-b.x * k, -b.y * k);
  const part = background ? { ...spec, elements: [] } : { ...spec, background: null };
  renderSpec(ctx, part, brand, geo, assets, { placeholders: false, transparent: !background });
  return c.toDataURL(type, 0.92);
}

export async function buildCanvaPackage(spec, brand, fmt, assets, title) {
  await ensureFonts(spec, brand);
  const page = canvaPage(fmt);
  const C = (t) => resolveColor(t, brand);
  const geo = { W: page.width, H: page.height, trimW: page.width, trimH: page.height, bleedPx: 0 };
  const m = Math.min(page.width, page.height);
  const S = (p) => (p / 100) * m;

  // Measure every element (boxes + fitted text) on a scratch canvas.
  const scratch = document.createElement('canvas');
  scratch.width = page.width; scratch.height = page.height;
  const hits = renderSpec(scratch.getContext('2d'), spec, brand, geo, assets, { placeholders: false });
  const hitOf = (i) => hits.find(h => h.index === i);

  const layers = [];
  const images = {};
  let n = 0;
  const addImage = (dataUrl, box, extra = {}) => {
    const ref = `img${++n}`;
    images[ref] = dataUrl;
    layers.push({ kind: 'image', ref, left: r2(box.x), top: r2(box.y), width: r2(box.w), height: r2(box.h), ...extra });
  };
  const rasterK = Math.min(page.raster, 6000 / Math.max(page.width, page.height));

  // Background: a plain colour stays a native shape; anything richer is flattened.
  const bg = spec.background || {};
  const plainBg = !bg.gradient && bg.photo == null && !bg.overlay?.color && (!bg.pattern || bg.pattern.type === 'none');
  if (plainBg && hex(C(bg.color || 'white'))) {
    layers.push({ kind: 'shape', role: 'background', left: 0, top: 0, width: page.width, height: page.height,
      path: shapePath('rect', page.width, page.height, {}, 0), viewBoxWidth: page.width, viewBoxHeight: page.height, color: hex(C(bg.color || 'white')) });
  } else {
    const k = bg.photo != null ? rasterK : Math.min(rasterK, 1.5);
    addImage(rasterize(spec, brand, page, assets, { k, background: true, type: 'image/jpeg' }),
      { x: 0, y: 0, w: page.width, h: page.height }, { role: 'background', alt: 'Background' });
  }

  (spec.elements || []).forEach((el, i) => {
    const h = hitOf(i);
    if (!h || el.hidden) return;
    const box = { x: h.x, y: h.y, w: h.w, h: h.h };
    const rotation = el.rotation ? Math.max(-180, Math.min(180, el.rotation)) : undefined;
    const opacity = el.opacity != null && el.opacity < 1 ? el.opacity : undefined;

    if (['rect', 'ellipse', 'folder', 'arch'].includes(el.type) && typeof el.fill === 'string' && hex(C(el.fill))) {
      layers.push({
        kind: 'shape', role: el.type, left: r2(box.x), top: r2(box.y), width: r2(box.w), height: r2(box.h),
        path: shapePath(el.type, box.w, box.h, el, S(el.radius || 0)), viewBoxWidth: r2(box.w), viewBoxHeight: r2(box.h),
        color: hex(C(el.fill)), opacity, rotation,
        ...(el.stroke && el.strokeWidth ? { strokeColor: hex(C(el.stroke)), strokeWeight: r2(S(el.strokeWidth)) } : {}),
      });
      return;
    }

    if (el.type === 'line' && (el.y1 === el.y2 || el.x1 === el.x2) && hex(C(el.color || 'dark'))) {
      const t = Math.max(1, S(el.width || 0.3));
      const horizontal = el.y1 === el.y2;
      const lb = horizontal ? { x: box.x, y: box.y + 2 - t / 2, w: box.w, h: t } : { x: box.x + 2 - t / 2, y: box.y, w: t, h: box.h };
      layers.push({ kind: 'shape', role: 'line', left: r2(lb.x), top: r2(lb.y), width: r2(lb.w), height: r2(lb.h),
        path: shapePath('rect', lb.w, lb.h, {}, 0), viewBoxWidth: r2(lb.w), viewBoxHeight: r2(lb.h), color: hex(C(el.color || 'dark')) });
      return;
    }

    if (el.type === 'logo') {
      const id = el.variant === 'white' ? (brand.canva?.logoWhiteAssetId || brand.canva?.logoAssetId) : brand.canva?.logoAssetId;
      if (id) {
        const aspect = brand.canva?.logoAspect || 1;
        const s = Math.min(box.w / aspect, box.h);
        const w = s * aspect, hh = s;
        const align = el.align || 'left';
        const x = align === 'center' ? box.x + (box.w - w) / 2 : align === 'right' ? box.x + box.w - w : box.x;
        layers.push({ kind: 'image', role: 'logo', canvaAssetId: id, left: r2(x), top: r2(box.y + (box.h - hh) / 2), width: r2(w), height: r2(hh), alt: `${brand.shortName} logo` });
        return;
      }
    }

    if (el.type === 'text') {
      const f = h.fit;
      if (!f) return;
      if (f.pill) {
        layers.push({ kind: 'shape', role: 'text-pill', left: r2(f.pill.x), top: r2(f.pill.y), width: r2(f.pill.w), height: r2(f.pill.h),
          path: shapePath('rect', f.pill.w, f.pill.h, {}, el.bgRadius != null ? S(el.bgRadius) : f.pill.h / 2),
          viewBoxWidth: r2(f.pill.w), viewBoxHeight: r2(f.pill.h), color: hex(C(el.bg)) });
      }
      let text = String(el.text || '').replace(/\*([^*]+)\*/g, '$1');
      if (el.uppercase) text = text.toUpperCase();
      const inPill = !!f.pill;
      // A little spare width: Canva's fonts measure slightly differently from the browser's.
      const left = inPill ? f.pill.x + f.pad * 0.5 : box.x;
      const width = inPill ? f.pill.w - f.pad : box.w * 1.04;
      layers.push({
        kind: 'text', role: el.role || 'text', text,
        left: r2(left), top: r2(f.textTop), width: r2(width),
        fontSize: Math.max(1, Math.min(800, Math.round(f.fs))),
        color: hex(C(el.color || 'ink')) || '#000000',
        bold: (el.weight || (el.font === 'heading' ? 700 : 400)) >= 600,
        align: inPill ? 'center' : ({ left: 'start', center: 'center', right: 'end' }[el.align || 'left']),
        lineHeight: Math.max(0.5, Math.min(2.5, f.lineHeight)),
        brandFont: brand.fonts[el.font || 'body'],
        rotation, opacity,
      });
      return;
    }

    // Everything else (photos, gradient shapes, QR codes, uploaded-logo fallback, diagonal lines) is flattened.
    addImage(rasterize({ ...spec, elements: [el] }, brand, page, assets, { box, k: rasterK }), box,
      { role: el.type, alt: el.type === 'photo' ? `School photo ${(el.slot ?? 0) + 1}` : el.type, rotation, opacity });
  });

  return {
    app: 'lmcs-design', kind: 'canva-package', version: 1, createdAt: new Date().toISOString(),
    title: title || 'LMS design',
    format: { id: fmt.id, name: fmt.name },
    canva: {
      brandKitId: brand.canva?.brandKitId || '',
      baseDesignId: brand.canva?.baseDesignId || '',
      folderName: brand.canva?.folderName || 'LMCS Design',
    },
    page: { width: page.width, height: page.height, note: page.note },
    layers, images,
  };
}
