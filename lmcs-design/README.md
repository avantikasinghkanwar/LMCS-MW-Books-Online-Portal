# LMCS Design Studio

A brand-locked design studio for La Montessori Chain of Schools. Give it reference pictures you like and a short
brief, and it designs on-brand social posts, posters, newspaper ads, flexes, standees and stage backdrops, ready to
post or send to the printer.

This project is separate from LMCS Books. It shares no code or data with it and keeps its own database. It lives in
this folder only until it has its own repository (`LMCS-Design`); copy the folder as-is to move it.

## What it does

- **Brief -> 3 designs.** Format, branch, purpose, headline, details, reference pictures, school photos.
  Claude reads the references for layout and mood and rebuilds them in LMS branding, in three directions:
  reference-led, brand-forward and editorial calm.
- **Quick layouts.** Three built-in LMS layouts that work without the AI or an API key.
- **Edit directly.** Click any element on the canvas to drag it, nudge it with the arrow keys, recolour it,
  resize it or delete it. Edit all the words from the Text panel. Wrap a word in `*asterisks*` to colour it.
- **Refine with AI.** "Make the headline bigger, add the date in a gold pill." Each refinement is kept as a new version.
- **Campaign adapt.** Rebuilds an approved post as a flex, A3 poster or story so the whole campaign matches.
- **Print-ready export.** PNG/JPG at exact social sizes. Print PDF with bleed and crop marks at 300 dpi for paper
  and 50-150 dpi for flex, with automatic scaling for backdrops larger than a PDF page allows.
- **Library.** Saved designs with branch and approval status. Assets: logos, school photos, a reference board.
- **Brand tab.** Colours, fonts, voice, motifs, rules and branches. Every design follows these settings.

## Run it

It is a static site with no build step.

- **Locally:** from this folder run `python3 -m http.server 8080`, then open http://localhost:8080.
- **Hosted:** publish the folder with GitHub Pages or Netlify, on its own site, separate from LMCS Books.

Then:
1. **Settings:** paste a Claude API key from console.anthropic.com.
2. **Assets:** upload the LMS logo as a transparent PNG, in a colour version and a white version.
3. **Studio:** fill the brief, add reference pictures, and press **Design with AI**.

## Database

The database is IndexedDB `lmcs-design` in the browser: brand, settings, assets and designs. It is browser-only for
this prototype, so use **Settings -> Download backup** regularly and **Restore** it on another computer.
The API key is never included in backups.

## Files

| Path | Purpose |
|---|---|
| `index.html`, `css/studio.css` | App shell and styles |
| `js/app.js` | UI: brief, canvas editing, library, assets, brand, settings |
| `js/renderer.js` | Draws a design spec at any resolution (preview to 14,000 px flex) |
| `js/formats.js` | Social, print and flex sizes; bleed, dpi, PDF page maths |
| `js/brand.js` | Default LMS brand (from the La Montessori School Canva designs) |
| `js/designer-brain.js` | The AI designer's system prompt: craft, medium rules, JSON contract |
| `js/ai.js` | Claude API calls (generate, refine, adapt) |
| `js/templates.js` | Built-in layouts |
| `js/export.js` | PNG/JPG/PDF export |
| `js/db.js` | IndexedDB database and backup |
| `skills/lmcs-designer/` | The same design knowledge as a Claude skill, for Claude Code / Cowork / claude.ai |
| `vendor/` | Bundled libraries: Anthropic SDK 0.132.1, jsPDF 2.5.1, qrcode-generator 1.4.4 |

## Notes

- AI model: `claude-opus-5-5` at high effort, with server-side refusal fallback enabled. A design run costs roughly
  US$0.10-0.40 (about Rs 10-35), depending on how many pictures you attach. Quick layouts cost nothing.
- Exports are RGB. Printers convert to CMYK, so strong reds can print slightly duller. Ask for a proof on big jobs.
- Photos are only placed, not generated. Use real school photos, which also suit the brand best.
