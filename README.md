# LMCS MW Books Online Portal

Interactive smart-panel companion to the LMCS Montessori English books (M1–M3). Each page of the book comes alive in class: letters that draw themselves in stroke order, letter sounds with Hindi cues, finger-tracing, picture games and teacher notes. Works online and offline on Android panels.

## What's in it (M1 English)
- Book 1 (A–N, 47 pages) and Book 2 (O–Z, 43 pages), in the same page order as the printed books
- Letters: stroke-order drawing, finger-tracing, name / sound / Hindi cue, words + "which one starts with…?" game
- Pre-writing: trace-the-picture + practice rows for every skill
- A–Z chart, colour-the-alphabet revision, teacher notes on every page
- Class records (time per page, touches, traces, game answers) sent to a Google Sheet; no student names
- Placeholder pictures (emoji) and computer voices for now

## M2 English (page by page from Canva)
M2 books are shown as the real Canva pages, in book order, with the course map's plan beside each page: day, sound cue, Montessori activity and materials, classwork and homework. Teachers can finger-trace on the page; a letter's strokes can be replayed. There is no audio in M2 yet.
- Book 1 (I L T F · E H U C, 50 pages) is built. Books 2–5 follow the same steps.
- To add or refresh a book: export it from Canva as PNG (all pages), then run
  `python3 tools/prepare_pages.py 1 <folder of PNGs>` → `python3 tools/import_m2.py` → `python3 tools/refresh_offline.py`
- `m2books.js` is generated from `English_M2_Course_Mapping.xlsx` (one Excel row = one page = one day). Edit the Excel, not the file.

## Files
| File | What it is |
|---|---|
| `index.html`, `style.css`, `app.js` | The portal itself |
| `content.js` | All M1 book content: page order, words, Hindi cues, stroke order |
| `m2books.js` | M2 page plan, generated from the M2 Excel by `tools/import_m2.py` |
| `pages/` | M2 page pictures made from the Canva exports by `tools/prepare_pages.py` |
| `config.js` | Google Sheet link and campus list |
| `audio/` | Sound clips (made by `tools/build.py`; a recorded clip with the same name replaces the computer voice) |
| `sw.js` | Saves a copy on the panel after the first visit, so it works without internet |
| `tools/apps-script.gs` | Code for the Google Sheet that collects class records |

After editing `content.js`, run `python3 tools/build.py` to make any new clips and refresh the offline list.
