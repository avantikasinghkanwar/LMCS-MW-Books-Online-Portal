# LMCS MW Books Online Portal

Interactive smart-panel companion to the LMCS Montessori English books (M1–M3). Each page of the book comes alive in class: letters that draw themselves in stroke order, letter sounds with Hindi cues, finger-tracing, picture games and teacher notes. Works online and offline on Android panels.

## What's in it (M1 English)
- Book 1 (A–N, 47 pages) and Book 2 (O–Z, 43 pages), in the same page order as the printed books
- Letters: stroke-order drawing, finger-tracing, name / sound / Hindi cue, words + "which one starts with…?" game
- Pre-writing: trace-the-picture + practice rows for every skill
- A–Z chart, colour-the-alphabet revision, teacher notes on every page
- Class records (time per page, touches, traces, game answers) sent to a Google Sheet; no student names
- Placeholder pictures (emoji) and computer voices for now

## Files
| File | What it is |
|---|---|
| `index.html`, `style.css`, `app.js` | The portal itself |
| `content.js` | All book content: page order, words, Hindi cues, stroke order |
| `config.js` | Google Sheet link and campus list |
| `audio/` | Sound clips (made by `tools/build.py`; a recorded clip with the same name replaces the computer voice) |
| `sw.js` | Saves a copy on the panel after the first visit, so it works without internet |
| `tools/apps-script.gs` | Code for the Google Sheet that collects class records |

After editing `content.js`, run `python3 tools/build.py` to make any new clips and refresh the offline list.
