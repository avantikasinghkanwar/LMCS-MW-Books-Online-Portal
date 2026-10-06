#!/usr/bin/env python3
"""Turns Canva page exports (PNG) into the page pictures the portal shows.

Export the book from Canva as PNG (all pages), put the files in one folder, then run from the portal folder:
  python3 tools/prepare_pages.py 1 ~/Downloads/M2-English-Book-1

  1  = M2 English book number (Book 1 -> pages/m2b1/)
Canva names the files in page order (e.g. ...-1.png, ...-2.png, ...-10.png); the script sorts them by the
number in the name, so page 10 comes after page 9. It writes NN.webp (the page) and tNN.webp (small picture
for the page list).
Needs Pillow:  pip3 install pillow
"""
import os
import re
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE_WIDTH, THUMB_WIDTH = 900, 240


def page_number(name):
    nums = re.findall(r'\d+', os.path.splitext(name)[0])
    return int(nums[-1]) if nums else 0


def save(im, path, width, quality):
    h = round(im.height * width / im.width)
    im.convert('RGB').resize((width, h), Image.LANCZOS).save(path, 'WEBP', quality=quality, method=6)


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    book, src = sys.argv[1], os.path.expanduser(sys.argv[2])
    files = sorted([f for f in os.listdir(src) if f.lower().endswith('.png')], key=page_number)
    if not files:
        sys.exit('No PNG files found in ' + src)
    out = os.path.join(ROOT, 'pages', 'm2b%s' % book)
    os.makedirs(out, exist_ok=True)
    for n, f in enumerate(files, 1):
        im = Image.open(os.path.join(src, f))
        save(im, os.path.join(out, '%02d.webp' % n), PAGE_WIDTH, 82)
        save(im, os.path.join(out, 't%02d.webp' % n), THUMB_WIDTH, 70)
    size = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)) / 1e6
    print('Book %s: %d pages written to pages/m2b%s (%.1f MB)' % (book, len(files), book, size))
    print('Next: python3 tools/import_m2.py   (checks the page count against the Excel)')
    print('Then: python3 tools/refresh_offline.py   (updates the offline list), and push the portal.')


if __name__ == '__main__':
    main()
