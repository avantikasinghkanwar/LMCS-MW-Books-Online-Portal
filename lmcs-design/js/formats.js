// Output formats. Sizes are the finished (trim) size; bleed is added on every side for print.
// unit: 'px' (screen), 'mm' (paper print), 'in' (large-format print).

const MM_PER_IN = 25.4;

export const FORMATS = [
  // Social media
  { id: 'ig-portrait', group: 'social', name: 'Instagram / Facebook post (4:5)', w: 1080, h: 1350, unit: 'px',
    note: 'Best-performing feed size. Keep key text off the bottom 10% (profile overlay).' },
  { id: 'ig-square', group: 'social', name: 'Square post (1:1)', w: 1080, h: 1080, unit: 'px',
    note: 'Instagram grid, WhatsApp share, Facebook.' },
  { id: 'story', group: 'social', name: 'Story / Reel cover / WhatsApp status (9:16)', w: 1080, h: 1920, unit: 'px',
    note: 'Keep text out of the top 250px and bottom 300px (app UI).' },
  { id: 'landscape', group: 'social', name: 'Landscape (16:9) - YouTube, LinkedIn, screens', w: 1920, h: 1080, unit: 'px',
    note: 'Also works for school-reception TV screens.' },

  // Paper print (300 dpi, 3 mm bleed)
  { id: 'a4', group: 'print', name: 'A4 poster / flyer', w: 210, h: 297, unit: 'mm', dpi: 300, bleed: 3,
    note: 'Notice boards, handouts. Body text no smaller than 10 pt.' },
  { id: 'a3', group: 'print', name: 'A3 poster', w: 297, h: 420, unit: 'mm', dpi: 300, bleed: 3,
    note: 'Corridors, reception. Headline readable from 3 m.' },
  { id: 'a2', group: 'print', name: 'A2 poster', w: 420, h: 594, unit: 'mm', dpi: 300, bleed: 3,
    note: 'Gate and lobby posters. Headline readable from 5 m.' },
  { id: 'news-ad', group: 'print', name: 'Newspaper ad (7 x 8 cm)', w: 70, h: 80, unit: 'mm', dpi: 300, bleed: 0,
    note: 'Newsprint spreads ink: use bold type, high contrast, no fine detail. Change size in Custom if the paper asks.' },

  // Large format (flex, vinyl, standee)
  { id: 'flex-6x3', group: 'large', name: 'Flex 6 x 3 ft (landscape)', w: 72, h: 36, unit: 'in', dpi: 100, bleed: 1,
    note: 'Gate/wall flex. Eyelets go in the 1 in hem - keep everything 2 in from the edge.' },
  { id: 'flex-10x4', group: 'large', name: 'Flex 10 x 4 ft (landscape)', w: 120, h: 48, unit: 'in', dpi: 100, bleed: 1,
    note: 'Road-facing banner. Read in 3 seconds from a moving vehicle: headline + one line + phone.' },
  { id: 'flex-8x4', group: 'large', name: 'Flex 8 x 4 ft (landscape)', w: 96, h: 48, unit: 'in', dpi: 100, bleed: 1,
    note: 'Event venue banner.' },
  { id: 'standee', group: 'large', name: 'Roll-up standee 2.75 x 6.5 ft', w: 33, h: 78, unit: 'in', dpi: 150, bleed: 0.5,
    note: 'Bottom 8 in hides in the stand base - nothing important there. Logo at eye level or above.' },
  { id: 'backdrop-12x8', group: 'large', name: 'Stage backdrop 12 x 8 ft', w: 144, h: 96, unit: 'in', dpi: 72, bleed: 1,
    note: 'Photographed behind people: keep the centre-lower third calm; title high, logo top corner.' },
  { id: 'backdrop-20x10', group: 'large', name: 'Stage backdrop 20 x 10 ft', w: 240, h: 120, unit: 'in', dpi: 50, bleed: 1,
    note: 'Viewed from 10 m+. Low dpi is normal at this size.' },
];

export const GROUP_LABELS = { social: 'Social media', print: 'Print', large: 'Flex & large format' };

// Browser canvas limits: keep exports well inside them.
const MAX_SIDE = 14000;
const MAX_AREA = 90_000_000;

export function getFormat(id, custom) {
  if (id === 'custom' && custom) return customFormat(custom);
  return FORMATS.find(f => f.id === id) || FORMATS[0];
}

export function customFormat({ w, h, unit }) {
  const base = { id: 'custom', name: `Custom ${w} x ${h} ${unit}`, w: +w, h: +h, unit };
  if (unit === 'px') return { ...base, group: 'social' };
  if (unit === 'mm') return { ...base, group: 'print', dpi: 300, bleed: 3 };
  if (unit === 'cm') return { ...base, w: w * 10, h: h * 10, unit: 'mm', group: 'print', dpi: 300, bleed: 3 };
  if (unit === 'ft') return { ...base, w: w * 12, h: h * 12, unit: 'in', group: 'large', dpi: 72, bleed: 1 };
  return { ...base, unit: 'in', group: 'large', dpi: 100, bleed: 1 };
}

function toInches(v, unit) {
  return unit === 'mm' ? v / MM_PER_IN : v;
}

// Pixel geometry of a format at full export resolution.
// Returns trim size, bleed in px, total canvas size and the dpi actually achieved.
export function exportGeometry(fmt) {
  if (fmt.unit === 'px') {
    return { trimW: fmt.w, trimH: fmt.h, bleedPx: 0, W: fmt.w, H: fmt.h, dpi: null, scaled: false };
  }
  const inW = toInches(fmt.w, fmt.unit), inH = toInches(fmt.h, fmt.unit);
  const inB = toInches(fmt.bleed || 0, fmt.unit);
  let dpi = fmt.dpi || 300;
  const totalIn = (x) => x + 2 * inB;
  // Lower the dpi until the canvas fits browser limits.
  while ((totalIn(inW) * dpi > MAX_SIDE || totalIn(inH) * dpi > MAX_SIDE ||
          totalIn(inW) * totalIn(inH) * dpi * dpi > MAX_AREA) && dpi > 20) {
    dpi -= 5;
  }
  const trimW = Math.round(inW * dpi), trimH = Math.round(inH * dpi);
  const bleedPx = Math.round(inB * dpi);
  return { trimW, trimH, bleedPx, W: trimW + 2 * bleedPx, H: trimH + 2 * bleedPx, dpi, scaled: dpi < (fmt.dpi || 300) };
}

// Physical size line shown in the UI, e.g. "120 x 48 in (10 x 4 ft)".
export function sizeLabel(fmt) {
  if (fmt.unit === 'px') return `${fmt.w} x ${fmt.h} px`;
  if (fmt.unit === 'mm') return `${fmt.w} x ${fmt.h} mm` + (fmt.bleed ? ` + ${fmt.bleed} mm bleed` : '');
  const ft = (v) => +(v / 12).toFixed(2);
  return `${ft(fmt.w)} x ${ft(fmt.h)} ft` + (fmt.bleed ? ` + ${fmt.bleed} in bleed` : '');
}

// Physical size in PDF points (1/72 in) including bleed, and a scale if it exceeds the PDF page limit.
export function pdfPage(fmt) {
  const inW = toInches(fmt.w, fmt.unit), inH = toInches(fmt.h, fmt.unit);
  const inB = toInches(fmt.bleed || 0, fmt.unit);
  const wIn = inW + 2 * inB, hIn = inH + 2 * inB;
  const LIMIT_IN = 199; // PDF pages max out at 200 in per side
  const scale = Math.max(1, Math.ceil(Math.max(wIn, hIn) / LIMIT_IN));
  return { wPt: (wIn / scale) * 72, hPt: (hIn / scale) * 72, scale, bleedPt: (inB / scale) * 72 };
}

// Short description for the AI: shape, medium and how it is viewed.
export function formatBrief(fmt) {
  const ratio = fmt.w / fmt.h;
  const shape = ratio > 1.15 ? 'landscape' : ratio < 0.87 ? 'portrait' : 'square';
  const medium = { social: 'screen (phone feed)', print: 'paper print', large: 'large-format flex/vinyl print' }[fmt.group];
  return `${fmt.name} - ${sizeLabel(fmt)}, ${shape} (aspect ${ratio.toFixed(2)}:1), medium: ${medium}. ${fmt.note || ''}`;
}
