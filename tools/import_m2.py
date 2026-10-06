#!/usr/bin/env python3
"""Reads the M2 English course map (Excel) and writes m2books.js for the portal.

Run from the portal folder:
  python3 tools/import_m2.py                      (uses the Excel on the Desktop, Book 1)
  python3 tools/import_m2.py path/to/file.xlsx    (another copy of the Excel)
  python3 tools/import_m2.py --books 1,2          (more books, once their page images are in pages/)

The Excel stays the master copy: edit it, run this, then push the portal.
One Excel row = one printed page = one teaching day. Canva is final, so page order and
page count must match the Canva book (the script checks the page images when they exist).
"""
import json
import os
import re
import sys
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_XLSX = os.path.expanduser('~/Desktop/LMCS MW Books/01_Course_Mapping/English/M2/English_M2_Course_Mapping.xlsx')
OUT = os.path.join(ROOT, 'm2books.js')

# One entry per book: sheet name, short range label shown on the Home card, portal key.
BOOKS = {
    '1': {'sheet': 'Book 1 Page Plan (PreW+Blk1-2)', 'title': 'Book 1', 'range': 'I L T F · E H U C', 'term': 'Term 1'},
    '2': {'sheet': 'Book 2 Page Plan (Blk3-4)', 'title': 'Book 2', 'range': 'O Q G S · J D P B', 'term': 'Term 1'},
    '3': {'sheet': 'Book 3 Page Plan (Blk5-6+AZ)', 'title': 'Book 3', 'range': 'R K A M · N V W X Y Z', 'term': 'Term 1'},
    '4': {'sheet': 'Book 4 Page Plan (a-m)', 'title': 'Book 4', 'range': 'a–m cursive', 'term': 'Term 2'},
    '5': {'sheet': 'Book 5 Page Plan (n-z)', 'title': 'Book 5', 'range': 'n–z cursive', 'term': 'Term 2'},
}


def clean(v):
    return ' '.join(str(v).split()) if v else ''


def kind_of(page_type):
    t = page_type.lower()
    if t.startswith('letter intro'):
        return 'intro'
    if t.startswith('letter practice'):
        return 'practice'
    if t.startswith('pre-writing') or t.startswith('cursive warm-up'):
        return 'prewrite'
    if 'chart' in t or 'colouring page' in t:
        return 'chart'
    if 'blank' in t:
        return 'blank'
    return 'revision'


class Part:
    def __init__(self, a, b):
        self.a, self.b = a, b

    def group(self, i):
        return self.a if i == 1 else self.b


def part_of(page_type):
    """'Letter Practice 1 (of 2)' or 'Block Revision (1/2)' -> Part('1', '2')."""
    m = re.search(r'(\d+)\s*\(of\s*(\d+)\)', page_type) or re.search(r'\((\d+)\s*/\s*(\d+)\)', page_type)
    return Part(m.group(1), m.group(2)) if m else None


def split_cw_hw(task):
    m = re.match(r'^CW:\s*(.*?)\s*HW:\s*(.*)$', task)
    if m:
        return m.group(1), m.group(2)
    return None, None


def build_book(key, ws):
    rows = list(ws.iter_rows())
    hdr = [clean(c.value) for c in rows[0]]

    def col(prefix):
        for i, h in enumerate(hdr):
            if h.startswith(prefix):
                return i
        return None

    c = {
        'day': col('Day'), 'page': col('Page #'), 'block': col('Block'), 'type': col('Page Type'),
        'letter': col('Letter'), 'title': col('Chapter / Topic Title'), 'vocab': col('Vocabulary'),
        'cue': col('Hindi Cue'), 'activity': col('Montessori Activity'), 'materials': col('Materials Needed'),
        'colouring': col('Colouring Task'), 'stroke': col('Stroke Group'), 'formation': col('Formation Cue'),
        'task': col('Page Content'), 'covers': col('Letters Covered'), 'check': col('Assessment Checkpoint'),
        'notes': col('Notes'),
    }

    def get(r, name):
        i = c[name]
        return clean(r[i].value) if i is not None and r[i].value is not None else ''

    items = []
    for r in rows[1:]:
        if not get(r, 'page'):
            continue
        page_type = get(r, 'type')
        kind = kind_of(page_type)
        n = int(float(get(r, 'page')))
        letter = get(r, 'letter')
        stroke = get(r, 'stroke')
        notes = get(r, 'notes')
        task = get(r, 'task')

        # Hindi cue + the teacher's note on how to say the sound (a comment on the cue cell).
        tip = ''
        if c['cue'] is not None:
            cell = r[c['cue']]
            if cell.comment:
                tip = clean(cell.comment.text.split('\n', 1)[-1])

        # Canva is final: the Excel says left/right curve on four pages that Canva built as Circle pages.
        if kind == 'prewrite' and 'Canva shows Circle' in notes:
            stroke = 'Circle'
            q = re.search(r"'([^']+)'", task)
            task = ('On the page: ' + q.group(1)) if q else ''

        # Revision and spare pages: the Excel text is a design note, so give the teacher a plain instruction instead.
        if kind == 'revision':
            if 'cumulative' in page_type.lower():
                task = ''
                cw, hw = 'Trace, then write, the first group of letters (top half of the page).', 'Trace, then write, the second group (bottom half).'
            else:
                task = 'Children trace each dashed letter, then write it on the guide dots below.'
                cw = hw = None
        elif kind == 'blank':
            task = 'Spare ruled page for extra writing practice. No new letters.'
            cw = hw = None
        elif kind == 'intro':
            task = 'Teacher shows %s and models its sound; children repeat it.' % letter
            cw = hw = None
        else:
            cw, hw = split_cw_hw(task)
        pt = part_of(page_type)
        if kind == 'intro':
            title = get(r, 'title')
        elif kind == 'practice' and pt:
            title = '%s · Practice %s of %s' % (letter, pt.group(1), pt.group(2))
        elif kind == 'prewrite':
            title = stroke + (' · %s of %s' % (pt.group(1), pt.group(2)) if pt else '')
        elif kind == 'chart':
            title = 'A–Z Chart'
        elif kind == 'blank':
            title = 'Revision Practice' + (' · %s of %s' % (pt.group(1), pt.group(2)) if pt else '')
        else:
            title = re.sub(r'\s*\(\d+/\d+\)', '', page_type) + (' · %s of %s' % (pt.group(1), pt.group(2)) if pt else '')

        item = {
            'type': 'm2page', 'pages': [n], 'kind': kind, 'title': title, 'block': get(r, 'block'),
            'day': int(float(get(r, 'day'))) if get(r, 'day') else 0,
            'img': 'pages/m2b%s/%02d.webp' % (key, n),
            'thumb': 'pages/m2b%s/t%02d.webp' % (key, n),
            'check': get(r, 'check').upper() == 'Y',
        }
        optional = {
            'letter': letter, 'stroke': stroke, 'formation': get(r, 'formation'),
            'vocab': [w.strip() for w in get(r, 'vocab').split(',') if w.strip()],
            'cue': get(r, 'cue'), 'cueTip': tip, 'activity': get(r, 'activity'), 'materials': get(r, 'materials'),
            'colouring': get(r, 'colouring'), 'cw': cw, 'hw': hw,
            'task': '' if cw else task, 'covers': get(r, 'covers'),
        }
        for k, v in optional.items():
            if v:
                item[k] = v
        items.append(item)
    meta = BOOKS[key]
    return {'title': '%s · %s' % (meta['title'], meta['range']), 'pages': len(items), 'm2': True, 'items': items}


def main():
    args = sys.argv[1:]
    books = ['1']
    xlsx = DEFAULT_XLSX
    i = 0
    while i < len(args):
        if args[i] == '--books':
            books = args[i + 1].split(',')
            i += 2
        else:
            xlsx = args[i]
            i += 1
    wb = openpyxl.load_workbook(xlsx)
    out = ['/* Generated from the M2 English course map by tools/import_m2.py — do not edit by hand.',
           '   Each M2 book is shown page by page, using the Canva page images in pages/. */']
    for key in books:
        meta = BOOKS[key]
        book = build_book(key, wb[meta['sheet']])
        folder = os.path.join(ROOT, 'pages', 'm2b%s' % key)
        have = len([f for f in os.listdir(folder) if re.match(r'^\d+\.webp$', f)]) if os.path.isdir(folder) else 0
        if have and have != book['pages']:
            print('WARNING: Book %s has %d pages in the Excel but %d page images in %s' % (key, book['pages'], have, folder))
        out.append('CONTENT.BOOKS.m2b%s = %s;' % (key, json.dumps(book, ensure_ascii=False, indent=1)))
        out.append("CONTENT.CATALOGUE.push(%s);" % json.dumps(
            {'key': 'm2b%s' % key, 'subject': 'english', 'level': '2', 'title': meta['title'], 'range': meta['range'], 'term': meta['term']},
            ensure_ascii=False))
        print('Book %s: %d pages, %d page images found' % (key, book['pages'], have))
    open(OUT, 'w', encoding='utf-8').write('\n'.join(out) + '\n')


if __name__ == '__main__':
    main()
