#!/usr/bin/env python3
"""Refreshes the offline file list (sw.js) and the version stamps (index.html).

Run from the portal folder after anything changes:  python3 tools/refresh_offline.py
(tools/build.py, tools/import_m2.py and tools/prepare_pages.py do not need this run again; run it once at the end.)
Core files and sound clips must all download for the offline copy to install; page pictures are saved
one by one, so a missing picture never stops the rest from working offline.
"""
import json
import os
import re
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORE = ['./', 'index.html', 'style.css', 'content.js', 'm2books.js', 'activities.js', 'app.js', 'config.js',
        'manifest.webmanifest', 'icon-192.png', 'icon-512.png']


def listing(folder, ext):
    base = os.path.join(ROOT, folder)
    out = []
    for dp, _, fns in os.walk(base):
        for fn in fns:
            if fn.endswith(ext):
                out.append(os.path.relpath(os.path.join(dp, fn), ROOT).replace(os.sep, '/'))
    return sorted(out)


def main():
    files = [f for f in CORE if f == './' or os.path.exists(os.path.join(ROOT, f))] + listing('audio', '.m4a')
    pages = listing('pages', '.webp')
    stamp = int(time.time())
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    sw = re.sub(r"var VERSION = '[^']*';", "var VERSION = 'v%d';" % stamp, sw)
    sw = re.sub(r'var FILES = \[.*?\];', 'var FILES = ' + json.dumps(files, indent=2, ensure_ascii=False) + ';', sw, flags=re.S)
    sw = re.sub(r'var PAGES = \[.*?\];', 'var PAGES = ' + json.dumps(pages, indent=2, ensure_ascii=False) + ';', sw, flags=re.S)
    open(sw_path, 'w', encoding='utf-8').write(sw)
    idx_path = os.path.join(ROOT, 'index.html')
    idx = open(idx_path, encoding='utf-8').read()
    idx = re.sub(r'((?:src|href)="(?:style|config|content|m2books|activities|app)\.(?:css|js))(?:\?v=\d+)?"', r'\1?v=%d"' % stamp, idx)
    open(idx_path, 'w', encoding='utf-8').write(idx)
    print('sw.js: %d core files, %d page pictures; version v%d' % (len(files), len(pages), stamp))


if __name__ == '__main__':
    main()
