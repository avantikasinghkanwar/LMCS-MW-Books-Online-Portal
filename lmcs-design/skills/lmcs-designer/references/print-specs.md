# LMS print & screen specs

Sizes are finished (trim) sizes. Bleed is added on every side. Safe area is measured inward from the trim.

## Screen

| Format | Pixels | Notes |
|---|---|---|
| Instagram/Facebook post 4:5 | 1080 x 1350 | Default feed size. Bottom 10% may be covered by UI. |
| Square 1:1 | 1080 x 1080 | Grid, WhatsApp share |
| Story / Reel cover / WhatsApp status 9:16 | 1080 x 1920 | Keep text out of top 250 px and bottom 300 px |
| Landscape 16:9 | 1920 x 1080 | YouTube, LinkedIn, reception TV |

## Paper (300 dpi, 3 mm bleed, 6 mm safe)

| Format | Trim | With bleed | Pixels at 300 dpi (with bleed) |
|---|---|---|---|
| A4 | 210 x 297 mm | 216 x 303 mm | 2551 x 3579 |
| A3 | 297 x 420 mm | 303 x 426 mm | 3579 x 5031 |
| A2 | 420 x 594 mm | 426 x 600 mm | 5031 x 7087 |
| Newspaper ad | per paper (e.g. 7 x 8 cm) | none - papers trim to box | 827 x 945 for 7 x 8 cm |

Minimum type: 10 pt body on A4; scale up for larger sheets and viewing distance.

## Large format

| Format | Trim | Bleed / hem | Safe | Export dpi |
|---|---|---|---|---|
| Flex 6 x 3 ft | 72 x 36 in | 1 in | 2 in | 100 |
| Flex 8 x 4 ft | 96 x 48 in | 1 in | 2 in | 100 |
| Flex 10 x 4 ft | 120 x 48 in | 1 in | 2 in | 100 |
| Roll-up standee | 33 x 78 in | 0.5 in | 2 in sides, 8 in bottom | 150 |
| Stage backdrop 12 x 8 ft | 144 x 96 in | 1 in | 2 in | 72 |
| Stage backdrop 20 x 10 ft | 240 x 120 in | 1 in | 2 in | 50 (exported at 1:2 scale) |

Rule of thumb for letter height: 1 inch of capital height per 10 feet of viewing distance (minimum),
2-3 inches per 10 feet for roadside flexes.

## Colour

Browsers and the studio export RGB. Printers convert to CMYK; very saturated reds (#ce0000) and bright blues can
shift slightly duller. For critical jobs ask the printer for a proof. Avoid large areas of pure gold-yellow text on
white - it loses contrast once printed.

## Hand-off to printers

- Paper: send the PDF with crop marks. Mention size and "3 mm bleed included".
- Flex: send the full-size JPG or PDF. Mention size, "1 inch hem included", and the dpi.
- Files exported at a scale (e.g. `_scale1-2`) must be printed at 200% - say so explicitly.
