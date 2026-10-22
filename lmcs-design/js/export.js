// Full-resolution exports: PNG/JPG for screens, print-ready PDF (with bleed, optional crop marks) for printers.

import { exportGeometry, pdfPage } from './formats.js';
import { renderSpec, ensureFonts } from './renderer.js';

export async function renderFull(spec, brand, fmt, assets) {
  await ensureFonts(spec, brand);
  const geo = exportGeometry(fmt);
  const canvas = document.createElement('canvas');
  canvas.width = geo.W;
  canvas.height = geo.H;
  const ctx = canvas.getContext('2d');
  renderSpec(ctx, spec, brand, geo, assets, { placeholders: false });
  return { canvas, geo };
}

const toBlob = (canvas, type, q) => new Promise((res, rej) =>
  canvas.toBlob(b => (b ? res(b) : rej(new Error('Export failed: image too large for this browser.'))), type, q));

export function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function fileBase(title, fmt) {
  const safe = (title || 'LMS design').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');
  return `${safe}_${fmt.id}`;
}

export async function exportImage(spec, brand, fmt, assets, title, type = 'png') {
  const { canvas, geo } = await renderFull(spec, brand, fmt, assets);
  const blob = await toBlob(canvas, type === 'png' ? 'image/png' : 'image/jpeg', 0.95);
  const dpi = geo.dpi ? `_${geo.dpi}dpi` : '';
  download(blob, `${fileBase(title, fmt)}${dpi}.${type === 'png' ? 'png' : 'jpg'}`);
  return geo;
}

export async function exportPDF(spec, brand, fmt, assets, title, { cropMarks = true } = {}) {
  const { canvas, geo } = await renderFull(spec, brand, fmt, assets);
  const page = pdfPage(fmt);
  const { jsPDF } = window.jspdf;
  // Crop marks need a slug outside the bleed.
  const slug = cropMarks && page.bleedPt ? Math.min(36, page.bleedPt * 2.5) : 0;
  const pw = page.wPt + slug * 2, ph = page.hPt + slug * 2;
  const pdf = new jsPDF({ unit: 'pt', format: [pw, ph], orientation: pw > ph ? 'landscape' : 'portrait', compress: true });
  const jpg = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(jpg, 'JPEG', slug, slug, page.wPt, page.hPt, undefined, 'FAST');
  if (slug) {
    const b = page.bleedPt, len = slug * 0.8;
    const tx1 = slug + b, ty1 = slug + b, tx2 = slug + page.wPt - b, ty2 = slug + page.hPt - b;
    pdf.setLineWidth(0.3);
    pdf.setDrawColor(0, 0, 0);
    for (const [x, y, dx, dy] of [[tx1, ty1, -1, -1], [tx2, ty1, 1, -1], [tx1, ty2, -1, 1], [tx2, ty2, 1, 1]]) {
      pdf.line(x, y + dy * b, x, y + dy * (b + len));       // vertical mark
      pdf.line(x + dx * b, y, x + dx * (b + len), y);       // horizontal mark
    }
    pdf.setFontSize(6);
    pdf.text(`${title || 'LMS design'} | ${fmt.name} | ${geo.dpi} dpi${page.scale > 1 ? ` | SCALE 1:${page.scale}` : ''}`, slug, slug * 0.5);
  }
  const blob = pdf.output('blob');
  download(blob, `${fileBase(title, fmt)}${page.scale > 1 ? `_scale1-${page.scale}` : ''}.pdf`);
  return { geo, page };
}

// Small JPEG data URL for the library grid.
export function thumbnail(canvas, max = 360) {
  const r = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * r);
  c.height = Math.round(canvas.height * r);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}
