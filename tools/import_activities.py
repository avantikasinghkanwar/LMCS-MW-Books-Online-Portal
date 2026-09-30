#!/usr/bin/env python3
"""Reads the M1 course map (Excel) and writes activities.js for the portal.

Run from the portal folder:  python3 tools/import_activities.py
The Excel stays the master copy: edit activities there, run this, then push the portal.
"""
import json
import os
import openpyxl

XLSX = os.path.expanduser('~/Desktop/LMCS MW Books/01_Course_Mapping/English/M1/English_M1_Course_Mapping.xlsx')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'activities.js')


def clean(v):
    return ' '.join(str(v).split()) if v else ''


def main():
    ws = openpyxl.load_workbook(XLSX)['M1 English']
    rows = list(ws.iter_rows())
    hdr = [c.value for c in rows[0]]
    col = {h: i for i, h in enumerate(hdr)}
    out = {}
    for r in rows[1:]:
        letter = r[col['Letter (Capital)']].value
        if not letter or len(str(letter)) != 1:
            continue
        cue_cell = r[col['Hindi Cue — Letter Sound (teacher bridge)']]
        tip = ''
        if cue_cell.comment:  # the note on the sound cell: how to say it
            tip = cue_cell.comment.text.split('\n', 1)[-1]
        out[letter] = {
            'montessori': clean(r[col['Montessori Activity — Vocabulary/Practical Life']].value),
            'materials': clean(r[col['Materials Needed']].value),
            'speaking': clean(r[col['Listening-Speaking Activity']].value),
            'sound': clean(tip),
        }
    body = json.dumps(out, ensure_ascii=False, indent=2)
    open(OUT, 'w', encoding='utf-8').write(
        '/* Generated from the M1 course map by tools/import_activities.py — do not edit by hand. */\n'
        'var ACTIVITIES = ' + body + ';\n')
    print('activities.js: %d letters' % len(out))


if __name__ == '__main__':
    main()
