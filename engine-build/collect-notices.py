#!/usr/bin/env python3
"""Retain upstream notice texts; source archive remains the authoritative full tree."""
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--sources', default='.cache/engine-context/sources')
parser.add_argument('--output', default='.cache/engine-release/ENGINE-NOTICES.txt')
args = parser.parse_args()
root = Path(args.sources)
output = Path(args.output)
sections = ['OpenSCAD engine source notices\n\nThese are upstream license/notice files from the source inputs. Their scope is defined by each upstream project. Some apply only to optional, development or example files. The complete source archive preserves all inline copyright notices as well.\n']
for path in sorted(root.rglob('*')):
    if not path.is_file() or path.is_symlink():
        continue
    name = path.name.lower()
    if not (name.startswith(('license', 'licence', 'copying', 'copyright', 'notice')) or 'LICENSES' in path.parts):
        continue
    try:
        body = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue
    sections.append(f'\n\n===== {path.relative_to(root)} =====\n\n{body}')
# These embedded libraries carry their primary notice in the source header.
for relative in ['openscad/src/ext/lodepng/lodepng.h', 'openscad/src/ext/libtess2/Include/tesselator.h', 'openscad/src/ext/json/json.hpp']:
    path = root / relative
    body = path.read_text(encoding='utf-8')
    sections.append(f'\n\n===== {relative} (first 80 lines; complete file in source archive) =====\n\n'+ '\n'.join(body.splitlines()[:80]))
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(''.join(sections), encoding='utf-8')
print(f'Collected {len(sections)-1} notice sections ({output.stat().st_size} bytes)')
