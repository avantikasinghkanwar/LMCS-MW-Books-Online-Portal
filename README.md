# LMCS MW Books Online Portal

Interactive smart-panel companion to the LMCS Montessori English books (M1–M3). Each page of the book comes alive in class: letters that draw themselves in stroke order, letter sounds with Hindi cues, finger-tracing, picture games and teacher notes. Works online and offline on Android panels.

## Pilot (M1 English, Book 1)
- Standing Line (pages 2–3), A (pages 4–5), B (pages 6–7), A–Z chart (page 1)
- Placeholder pictures (emoji) and computer voices for now; real pictures and recorded voices come later.

## Files
| File | What it is |
|---|---|
| `index.html`, `style.css`, `app.js` | The portal itself |
| `audio/` | Sound clips |
| `sw.js` | Saves a copy on the panel after the first visit, so it opens without internet |
| `manifest.webmanifest`, `icon-*.png` | Lets the portal be installed like an app on the panel |

When files change, bump `VERSION` in `sw.js` so panels pick up the new copy.
