// Default LMS brand, taken from the La Montessori School Canva designs.
// Everything here is editable on the Brand tab and saved in the LMCS Design database.

export const FONT_CHOICES = [
  'Poppins', 'Montserrat', 'Nunito', 'Open Sans', 'Lato', 'Raleway',
  'Baloo 2', 'Fredoka', 'Playfair Display', 'DM Serif Display', 'Caveat',
];

export const DEFAULT_BRAND = {
  name: 'La Montessori Chain of Schools',
  shortName: 'LMS',
  tagline: 'Passion | Purpose | Progress',
  milestone: 'Celebrating 30 years of Excellence',
  phone: '78766-22626',
  website: '',
  instagram: '',
  colors: {
    primary: '#ce0000',   // LMS Red
    secondary: '#0046aa', // LMS Blue
    accent: '#e1b104',    // LMS Gold
    dark: '#073a5c',      // Deep navy
    ink: '#2c2c2c',       // Body text on light
    light: '#faf7f2',     // Warm white
    white: '#ffffff',
  },
  colorNames: {
    primary: 'LMS Red', secondary: 'LMS Blue', accent: 'LMS Gold',
    dark: 'Deep Navy', ink: 'Ink', light: 'Warm White', white: 'White',
  },
  fonts: { heading: 'Poppins', body: 'Open Sans', accent: 'Caveat' },
  branches: ['Kullu', 'Kelheli', 'Dunkhra', 'Nerchowk', 'Sayoli', 'Joginder Nagar'],
  motifs: 'Folder-tab panels (rounded tab on the top-left of a panel), layered colour panels offset behind each other, a pointer/cursor accent in gold.',
  voice: [
    'Clear, modern, student-focused, parent-friendly, institutionally strong.',
    'Simple but polished words. Emotionally intelligent, never dramatic.',
    'No exaggerated marketing, no cliches ("best school in town", "world-class", "unlock potential"), no excessive exclamation marks or emojis.',
    'Short headlines (2-6 words). One idea per design.',
  ].join(' '),
  rules: [
    'Logo always present, never stretched, never on a busy photo without a calm panel behind it.',
    'Maximum two typefaces per design (heading + body); accent script only for one short phrase.',
    'Red, Blue and Gold are the brand trio; at most one of them dominates a design.',
    'Contact line (phone) on every print and flex.',
  ].join(' '),
};

export function resolveColor(token, brand) {
  if (!token) return null;
  if (token.startsWith('#') || token.startsWith('rgb')) return token;
  return brand.colors[token] || token;
}

export function fontFamily(role, brand) {
  return brand.fonts[role] || brand.fonts.body;
}

// One Google Fonts stylesheet for every choice so any brand change renders without a reload.
export function googleFontsHref() {
  const fam = FONT_CHOICES.map(f => {
    const name = f.replace(/ /g, '+');
    if (f === 'Caveat' || f === 'DM Serif Display') return `family=${name}`;
    return `family=${name}:wght@400;600;700;800`;
  });
  return `https://fonts.googleapis.com/css2?${fam.join('&')}&display=swap`;
}
