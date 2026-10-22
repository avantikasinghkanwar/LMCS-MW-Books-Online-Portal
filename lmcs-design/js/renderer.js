// Draws a design spec onto a canvas at any resolution.
//
// Spec coordinates are percentages of the TRIM area (0-100 on both axes), so one spec renders
// identically as a 1080 px post preview or a 14,000 px flex export. Font sizes and radii are
// percentages of the trim's shorter side. Shapes and photos that touch a trim edge are extended
// into the bleed automatically, so print files never show a white sliver after cutting.

import { resolveColor, fontFamily } from './brand.js';

const EDGE = 0.6; // % from the trim edge that counts as "touching" it

export async function ensureFonts(spec, brand) {
  const fams = new Set([brand.fonts.heading, brand.fonts.body, brand.fonts.accent]);
  const loads = [];
  for (const f of fams) {
    for (const w of [400, 600, 700, 800]) loads.push(document.fonts.load(`${w} 40px "${f}"`).catch(() => {}));
  }
  await Promise.all(loads);
}

// geo: { W, H, trimW, trimH, bleedPx }   assets: { photos: [ImageBitmap|null], logo: {color, white} }
export function renderSpec(ctx, spec, brand, geo, assets, opts = {}) {
  const { W, H, trimW, trimH, bleedPx } = geo;
  const m = Math.min(trimW, trimH);
  const X = (p) => bleedPx + (p / 100) * trimW;
  const Y = (p) => bleedPx + (p / 100) * trimH;
  const S = (p) => (p / 100) * m;
  const C = (t) => resolveColor(t, brand);
  const hits = [];

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (!opts.transparent) drawBackground(ctx, spec.background || {}, brand, geo, assets, C);

  (spec.elements || []).forEach((el, i) => {
    if (!el || el.hidden) return;
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;
    let box = elementBox(el, geo, X, Y, S);
    let fit = null;
    if (el.rotation) {
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    switch (el.type) {
      case 'rect': case 'ellipse': case 'folder': case 'arch':
        drawShape(ctx, el, box, S, C);
        break;
      case 'photo':
        drawPhoto(ctx, el, box, S, C, assets.photos?.[el.slot ?? 0], opts.placeholders !== false);
        break;
      case 'logo':
        drawLogo(ctx, el, box, brand, assets.logo, C);
        break;
      case 'text':
        fit = drawText(ctx, el, box, S, C, brand);
        break;
      case 'line':
        drawLine(ctx, el, X, Y, S, C);
        break;
      case 'qr':
        drawQR(ctx, el, box, C);
        break;
    }
    ctx.restore();
    hits.push({ index: i, ...box, fit });
  });

  if (opts.selected != null && hits.find(h => h.index === opts.selected)) {
    const h = hits.find(h => h.index === opts.selected);
    ctx.save();
    ctx.strokeStyle = '#1a73e8';
    ctx.lineWidth = Math.max(2, W / 400);
    ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2]);
    ctx.strokeRect(h.x, h.y, h.w, h.h);
    ctx.restore();
  }
  if (opts.guides) drawGuides(ctx, geo, opts.format);
  ctx.restore();
  return hits;
}

function elementBox(el, geo, X, Y) {
  if (el.type === 'line') {
    const x1 = X(el.x1 ?? 0), y1 = Y(el.y1 ?? 0), x2 = X(el.x2 ?? 0), y2 = Y(el.y2 ?? 0);
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 4, h: Math.abs(y2 - y1) || 4 };
  }
  let x = X(el.x ?? 0), y = Y(el.y ?? 0);
  let x2 = X((el.x ?? 0) + (el.w ?? 10)), y2 = Y((el.y ?? 0) + (el.h ?? 10));
  if (['rect', 'folder', 'photo', 'arch'].includes(el.type) && geo.bleedPx) {
    if ((el.x ?? 0) <= EDGE) x -= geo.bleedPx;
    if ((el.y ?? 0) <= EDGE) y -= geo.bleedPx;
    if ((el.x ?? 0) + (el.w ?? 0) >= 100 - EDGE) x2 += geo.bleedPx;
    if ((el.y ?? 0) + (el.h ?? 0) >= 100 - EDGE) y2 += geo.bleedPx;
  }
  return { x, y, w: x2 - x, h: y2 - y };
}

function fillStyle(ctx, fill, box, C) {
  if (fill && typeof fill === 'object' && fill.from) {
    const a = ((fill.angle ?? 90) * Math.PI) / 180;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const r = Math.hypot(box.w, box.h) / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.addColorStop(0, C(fill.from));
    g.addColorStop(1, C(fill.to || fill.from));
    return g;
  }
  return C(fill) || 'transparent';
}

function drawBackground(ctx, bg, brand, geo, assets, C) {
  const box = { x: 0, y: 0, w: geo.W, h: geo.H };
  ctx.fillStyle = fillStyle(ctx, bg.gradient || bg.color || 'white', box, C);
  ctx.fillRect(0, 0, geo.W, geo.H);
  if (bg.photo != null && assets.photos?.[bg.photo]) {
    ctx.save();
    ctx.globalAlpha = bg.photoOpacity ?? 1;
    drawCover(ctx, assets.photos[bg.photo], box);
    ctx.restore();
  }
  if (bg.overlay?.color) {
    ctx.save();
    ctx.globalAlpha = bg.overlay.opacity ?? 0.5;
    ctx.fillStyle = fillStyle(ctx, bg.overlay.color, box, C);
    ctx.fillRect(0, 0, geo.W, geo.H);
    ctx.restore();
  }
  const p = bg.pattern;
  if (p && p.type && p.type !== 'none') {
    ctx.save();
    ctx.globalAlpha = p.opacity ?? 0.12;
    ctx.fillStyle = ctx.strokeStyle = C(p.color || 'white');
    const step = Math.min(geo.trimW, geo.trimH) / 28;
    if (p.type === 'dots') {
      for (let y = step / 2; y < geo.H; y += step) for (let x = step / 2; x < geo.W; x += step) {
        ctx.beginPath(); ctx.arc(x, y, step * 0.09, 0, Math.PI * 2); ctx.fill();
      }
    } else if (p.type === 'grid') {
      ctx.lineWidth = step * 0.03;
      for (let x = 0; x < geo.W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, geo.H); ctx.stroke(); }
      for (let y = 0; y < geo.H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(geo.W, y); ctx.stroke(); }
    } else if (p.type === 'diagonal') {
      ctx.lineWidth = step * 0.12;
      for (let x = -geo.H; x < geo.W; x += step) { ctx.beginPath(); ctx.moveTo(x, geo.H); ctx.lineTo(x + geo.H, 0); ctx.stroke(); }
    }
    ctx.restore();
  }
}

function shapePath(ctx, kind, b, r, el, S) {
  ctx.beginPath();
  if (kind === 'ellipse' || kind === 'circle') {
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
  } else if (kind === 'arch') {
    const rr = Math.min(b.w / 2, b.h);
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x, b.y + rr);
    ctx.arc(b.x + b.w / 2, b.y + rr, b.w / 2, Math.PI, 0);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
  } else if (kind === 'folder') {
    // Panel with a rounded tab on the top-left - the LMS folder motif.
    const tw = b.w * ((el.tabW ?? 35) / 100);
    const th = Math.max(b.h * ((el.tabH ?? 7) / 100), 4);
    const rad = Math.min(r || th * 0.6, th, tw / 3);
    const top = b.y + th;
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x, b.y + rad);
    ctx.arcTo(b.x, b.y, b.x + rad, b.y, rad);
    ctx.lineTo(b.x + tw - rad, b.y);
    ctx.arcTo(b.x + tw, b.y, b.x + tw, b.y + rad, rad);
    ctx.lineTo(b.x + tw, top);
    ctx.lineTo(b.x + b.w, top);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
  } else {
    const rad = Math.min(r || 0, b.w / 2, b.h / 2);
    if (rad > 0 && ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, rad);
    else ctx.rect(b.x, b.y, b.w, b.h);
  }
}

function drawShape(ctx, el, box, S, C) {
  shapePath(ctx, el.type, box, S(el.radius || 0), el, S);
  if (el.fill) { ctx.fillStyle = fillStyle(ctx, el.fill, box, C); ctx.fill(); }
  if (el.stroke && el.strokeWidth) {
    ctx.strokeStyle = C(el.stroke);
    ctx.lineWidth = S(el.strokeWidth);
    ctx.stroke();
  }
}

function drawCover(ctx, img, b, focusX = 50, focusY = 50) {
  const ir = img.width / img.height, br = b.w / b.h;
  let sw, sh;
  if (ir > br) { sh = img.height; sw = sh * br; } else { sw = img.width; sh = sw / br; }
  const sx = (img.width - sw) * (focusX / 100), sy = (img.height - sh) * (focusY / 100);
  ctx.drawImage(img, sx, sy, sw, sh, b.x, b.y, b.w, b.h);
}

function drawPhoto(ctx, el, box, S, C, img, placeholder) {
  const kind = el.shape === 'circle' ? 'ellipse' : el.shape === 'rounded' ? 'rect' : (el.shape || 'rect');
  const radius = el.shape === 'rounded' ? S(el.radius || 3) : S(el.radius || 0);
  ctx.save();
  shapePath(ctx, kind, box, radius, el, S);
  ctx.clip();
  if (img) {
    drawCover(ctx, img, box, el.focusX ?? 50, el.focusY ?? 40);
  } else if (placeholder) {
    ctx.fillStyle = '#d9dee5';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = '#8a94a3';
    ctx.font = `600 ${Math.max(10, Math.min(box.w, box.h) / 9)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Photo ${(el.slot ?? 0) + 1}`, box.x + box.w / 2, box.y + box.h / 2);
  }
  ctx.restore();
  if (el.stroke && el.strokeWidth) {
    shapePath(ctx, kind, box, radius, el, S);
    ctx.strokeStyle = C(el.stroke);
    ctx.lineWidth = S(el.strokeWidth);
    ctx.stroke();
  }
}

function drawLogo(ctx, el, box, brand, logo, C) {
  const img = el.variant === 'white' ? (logo?.white || logo?.color) : (logo?.color || logo?.white);
  if (img) {
    const r = Math.min(box.w / img.width, box.h / img.height);
    const w = img.width * r, h = img.height * r;
    const align = el.align || 'left';
    const x = align === 'center' ? box.x + (box.w - w) / 2 : align === 'right' ? box.x + box.w - w : box.x;
    ctx.drawImage(img, x, box.y + (box.h - h) / 2, w, h);
    return;
  }
  // No logo uploaded yet: typeset wordmark so layouts still read correctly.
  const color = C(el.variant === 'white' ? 'white' : (el.color || 'primary'));
  const sub = C(el.variant === 'white' ? 'white' : 'secondary');
  const fam = fontFamily('heading', brand);
  const mark = brand.shortName || 'LMS';
  let fs = box.h * 0.62;
  ctx.font = `800 ${fs}px "${fam}"`;
  const mw = ctx.measureText(mark).width;
  if (mw > box.w * 0.45) { fs *= (box.w * 0.45) / mw; ctx.font = `800 ${fs}px "${fam}"`; }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  const cy = box.y + box.h / 2;
  const markW = ctx.measureText(mark).width;
  const nameFs = fs * 0.28;
  ctx.font = `600 ${nameFs}px "${fam}"`;
  const words = (brand.name || '').split(' ');
  const half = Math.ceil(words.length / 2);
  const l1 = words.slice(0, half).join(' '), l2 = words.slice(half).join(' ');
  const nameW = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width);
  const total = markW + fs * 0.25 + nameW;
  const align = el.align || 'left';
  let x = align === 'center' ? box.x + (box.w - total) / 2 : align === 'right' ? box.x + box.w - total : box.x;
  ctx.font = `800 ${fs}px "${fam}"`;
  ctx.fillStyle = color;
  ctx.fillText(mark, x, cy);
  x += markW + fs * 0.25;
  ctx.font = `600 ${nameFs}px "${fam}"`;
  ctx.fillStyle = sub;
  ctx.fillText(l1, x, cy - nameFs * 0.6);
  ctx.fillText(l2, x, cy + nameFs * 0.6);
}

function drawLine(ctx, el, X, Y, S, C) {
  ctx.beginPath();
  ctx.moveTo(X(el.x1 ?? 0), Y(el.y1 ?? 0));
  ctx.lineTo(X(el.x2 ?? 0), Y(el.y2 ?? 0));
  ctx.strokeStyle = C(el.color || 'dark');
  ctx.lineWidth = S(el.width || 0.3);
  ctx.lineCap = 'round';
  if (el.dash) ctx.setLineDash([S(el.width || 0.3) * 3, S(el.width || 0.3) * 2]);
  ctx.stroke();
}

function drawQR(ctx, el, box, C) {
  if (!el.data || typeof qrcode === 'undefined') return;
  const qr = qrcode(0, 'M');
  qr.addData(el.data);
  qr.make();
  const n = qr.getModuleCount();
  const size = Math.min(box.w, box.h);
  const quiet = size * 0.08;
  const cell = (size - quiet * 2) / n;
  const x0 = box.x + (box.w - size) / 2, y0 = box.y + (box.h - size) / 2;
  ctx.fillStyle = C(el.bg || 'white');
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = C(el.color || 'dark');
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.isDark(r, c)) ctx.fillRect(x0 + quiet + c * cell, y0 + quiet + r * cell, Math.ceil(cell), Math.ceil(cell));
  }
}

// ---- Text ----

// Split "Admissions *open* now" into runs; *starred* words take the emphasis colour.
function runs(text) {
  const out = [];
  text.split(/(\*[^*]+\*)/).forEach(part => {
    if (!part) return;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) out.push({ t: part.slice(1, -1), em: true });
    else out.push({ t: part, em: false });
  });
  return out;
}

function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of text.split('\n')) {
    const words = runs(para).flatMap(r => r.t.split(/(\s+)/).filter(Boolean).map(w => ({ w, em: r.em })));
    let line = [], width = 0;
    for (const tok of words) {
      const tw = ctx.measureText(tok.w).width;
      const isSpace = /^\s+$/.test(tok.w);
      if (!isSpace && width + tw > maxW && line.length) {
        while (line.length && /^\s+$/.test(line[line.length - 1].w)) line.pop();
        lines.push(line); line = []; width = 0;
      }
      if (isSpace && !line.length) continue;
      line.push(tok); width += tw;
    }
    while (line.length && /^\s+$/.test(line[line.length - 1].w)) line.pop();
    lines.push(line);
  }
  return lines;
}

const lineWidth = (ctx, line) => line.reduce((s, t) => s + ctx.measureText(t.w).width, 0);

function drawText(ctx, el, box, S, C, brand) {
  let text = String(el.text ?? '');
  if (!text.trim()) return;
  if (el.uppercase) text = text.toUpperCase();
  const fam = fontFamily(el.font || 'body', brand);
  const weight = el.weight || (el.font === 'heading' ? 700 : 400);
  const lh = el.lineHeight || (el.font === 'heading' ? 1.08 : 1.3);
  const hasBg = !!el.bg;
  const padRatio = hasBg ? 0.45 : 0;
  let fs = S(el.size || 4);
  let lines;
  const setFont = () => {
    ctx.font = `${el.italic ? 'italic ' : ''}${weight} ${fs}px "${fam}"`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(el.letterSpacing || 0) * fs}px`;
  };
  // Shrink until the text fits its box (never grow past the requested size).
  for (let guard = 0; guard < 60; guard++) {
    setFont();
    const pad = fs * padRatio;
    lines = wrap(ctx, text, box.w - pad * 2);
    const tooWide = lines.some(l => lineWidth(ctx, l) > box.w - pad * 2 + 0.5);
    const tooTall = lines.length * fs * lh + pad * 2 > box.h + 0.5;
    if ((!tooWide && !tooTall) || fs < 6) break;
    fs *= 0.94;
  }
  const pad = fs * padRatio;
  const blockH = lines.length * fs * lh;
  const valign = el.valign || 'top';
  let y = valign === 'middle' ? box.y + (box.h - blockH) / 2 : valign === 'bottom' ? box.y + box.h - blockH - pad : box.y + pad;
  const align = el.align || 'left';
  const maxLine = Math.max(...lines.map(l => lineWidth(ctx, l)));

  if (hasBg) {
    const bw = maxLine + pad * 2, bh = blockH + pad * 2;
    const bx = align === 'center' ? box.x + (box.w - bw) / 2 : align === 'right' ? box.x + box.w - bw : box.x;
    ctx.beginPath();
    const r = el.bgRadius != null ? S(el.bgRadius) : bh / 2;
    if (ctx.roundRect) ctx.roundRect(bx, y - pad, bw, bh, Math.min(r, bh / 2)); else ctx.rect(bx, y - pad, bw, bh);
    ctx.fillStyle = C(el.bg);
    ctx.fill();
  }

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const base = C(el.color || 'ink');
  const em = C(el.emphasisColor || 'accent');
  for (const line of lines) {
    const lw = lineWidth(ctx, line);
    let x = align === 'center' ? box.x + (box.w - lw) / 2 : align === 'right' ? box.x + box.w - lw - pad : box.x + pad;
    const baseline = y + fs * (lh - 1) / 2 + fs * 0.82;
    for (const tok of line) {
      ctx.fillStyle = tok.em ? em : base;
      ctx.fillText(tok.w, x, baseline);
      x += ctx.measureText(tok.w).width;
    }
    y += fs * lh;
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  // Fit result, used by the Canva bridge to place native text at the same size.
  const textTop = valign === 'middle' ? box.y + (box.h - blockH) / 2 : valign === 'bottom' ? box.y + box.h - blockH - pad : box.y + pad;
  const pillW = maxLine + pad * 2;
  const pillX = align === 'center' ? box.x + (box.w - pillW) / 2 : align === 'right' ? box.x + box.w - pillW : box.x;
  return { fs, pad, lineHeight: lh, lines: lines.length, textTop, blockH, maxLine, pill: hasBg ? { x: pillX, y: textTop - pad, w: pillW, h: blockH + pad * 2 } : null };
}

// ---- Guides (preview only) ----

function drawGuides(ctx, geo, fmt) {
  const { W, H, bleedPx, trimW, trimH } = geo;
  const lw = Math.max(1, W / 700);
  ctx.save();
  ctx.lineWidth = lw;
  ctx.setLineDash([lw * 6, lw * 4]);
  if (bleedPx) {
    ctx.strokeStyle = 'rgba(220,0,0,.9)';
    ctx.strokeRect(bleedPx, bleedPx, trimW, trimH);
  }
  const inset = safeInset(geo, fmt);
  ctx.strokeStyle = 'rgba(0,150,255,.9)';
  ctx.strokeRect(bleedPx + inset.l, bleedPx + inset.t, trimW - inset.l - inset.r, trimH - inset.t - inset.b);
  ctx.restore();
}

export function safeInset(geo, fmt) {
  const { trimW, trimH } = geo;
  if (!fmt || fmt.group === 'social') {
    const s = Math.round(Math.min(trimW, trimH) * 0.05);
    if (fmt?.id === 'story') return { l: s, r: s, t: Math.round(trimH * 0.13), b: Math.round(trimH * 0.16) };
    return { l: s, r: s, t: s, b: s };
  }
  const pxPerUnit = trimW / fmt.w;
  const unitInset = fmt.group === 'print' ? 6 : 2; // 6 mm paper, 2 in flex
  const s = Math.round(unitInset * pxPerUnit);
  if (fmt.id === 'standee') return { l: s, r: s, t: s, b: Math.round(8 * pxPerUnit) };
  return { l: s, r: s, t: s, b: s };
}
