#!/usr/bin/env python3
"""Make the audio clips from content.js and refresh the offline file list in sw.js.

Run from the portal folder:  python3 tools/build.py        (only makes missing clips)
                              python3 tools/build.py --all  (remakes every clip)
Uses the Mac's built-in voices: Rishi (Indian English) and Lekha (Hindi).
A recorded clip with the same file name simply replaces the computer voice.
"""
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'audio')
ENGLISH, HINDI = 'Rishi', 'Lekha'

# How the computer voice should say a word, where the spelling misleads it.
SAY_AS = {'X-MAS': 'Ex-mas', 'YO-YO': 'Yo-yo', 'QUESTION MARK': 'Question mark'}


def load_content():
    js = ('ObjC.import("Foundation");'
          'var s=$.NSString.stringWithContentsOfFileEncodingError("content.js",4,null).js;'
          'eval(s+";this.C=CONTENT"); JSON.stringify(C)')
    out = subprocess.run(['osascript', '-l', 'JavaScript', '-e', js], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def clips(c):
    """Every clip the portal plays: file name -> (voice, text)."""
    out = {
        'p_well_done': (ENGLISH, 'Well done!'),
        'p_try_again': (ENGLISH, 'Try again!'),
        'p_chart': (ENGLISH, 'Point to a letter, and say its name and sound.'),
        'p_colour_letters': (ENGLISH, 'Read the letters, and colour them.'),
    }
    for key, L in c['LETTERS'].items():
        k = key.lower()
        sound = re.search(r'says (.+?),', L['cue']).group(1)
        out['l_%s_name' % k] = (ENGLISH, key + '.')
        out['l_%s_sound' % k] = (HINDI, sound)
        out['l_%s_cue' % k] = (HINDI, L['cue'] + '.')
        out['l_%s_question' % k] = (ENGLISH, 'Which one starts with %s?' % key)
        for w in L['words']:
            out[w['audio']] = (ENGLISH, SAY_AS.get(w['name'], w['name'].capitalize()) + '.')
    for book in c['BOOKS'].values():
        for item in book['items']:
            if item['type'] == 'prewriting':
                skill = c['SKILLS'][item['skill']]['title']
                out['pw_' + item['word']] = (ENGLISH, '%s. %s' % (skill, item['say']))
    return out


def make(name, voice, text):
    aiff = os.path.join(AUDIO, '_tmp.aiff')
    subprocess.run(['say', '-v', voice, '-r', '145', '-o', aiff, text], check=True)
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', aiff, os.path.join(AUDIO, name + '.m4a')], check=True)
    os.remove(aiff)


def write_sw_list(names):
    files = ['./', 'index.html', 'style.css', 'content.js', 'activities.js', 'app.js', 'config.js',
             'manifest.webmanifest', 'icon-192.png', 'icon-512.png']
    files += ['audio/%s.m4a' % n for n in sorted(names)]
    sw_path = os.path.join(ROOT, 'sw.js')
    stamp = int(time.time())
    sw = open(sw_path, encoding='utf-8').read()
    sw = re.sub(r"var VERSION = '[^']*';", "var VERSION = 'v%d';" % stamp, sw)
    sw = re.sub(r'var FILES = \[.*?\];', 'var FILES = ' + json.dumps(files, indent=2, ensure_ascii=False) + ';',
                sw, flags=re.S)
    open(sw_path, 'w', encoding='utf-8').write(sw)
    # Stamp every script/style link in index.html with the same version, so a panel never mixes an old file with a new one.
    idx_path = os.path.join(ROOT, 'index.html')
    idx = open(idx_path, encoding='utf-8').read()
    idx = re.sub(r'((?:src|href)="(?:style|config|content|activities|app)\.(?:css|js))(?:\?v=\d+)?"', r'\1?v=%d"' % stamp, idx)
    open(idx_path, 'w', encoding='utf-8').write(idx)


def main():
    os.makedirs(AUDIO, exist_ok=True)
    wanted = clips(load_content())
    redo = '--all' in sys.argv
    made = 0
    for name, (voice, text) in wanted.items():
        if redo or not os.path.exists(os.path.join(AUDIO, name + '.m4a')):
            make(name, voice, text)
            made += 1
    # Remove clips nothing uses any more.
    removed = 0
    for f in os.listdir(AUDIO):
        if f.endswith('.m4a') and f[:-4] not in wanted:
            os.remove(os.path.join(AUDIO, f))
            removed += 1
    write_sw_list(wanted)
    print('clips: %d total, %d made, %d removed' % (len(wanted), made, removed))


if __name__ == '__main__':
    main()
