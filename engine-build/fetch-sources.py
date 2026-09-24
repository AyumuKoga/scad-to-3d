#!/usr/bin/env python3
"""Fetch only hash-pinned sources; keep downloads and source trees for redistribution."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import shutil
import tarfile
import time
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent
LOCK = json.loads((ROOT / 'sources.lock.json').read_text())


def checked_relative(value):
    path = PurePosixPath(value)
    if path.is_absolute() or '..' in path.parts or not path.parts:
        raise ValueError(f'Unsafe source path: {value}')
    return path


def fetch(entry, cache):
    destination = cache / entry['filename']
    checked_relative(entry['filename'])
    if not destination.exists():
        if not entry['url'].startswith('https://'):
            raise ValueError('Only HTTPS sources are allowed')
        print(f'Downloading source: {entry["name"]}', flush=True)
        for attempt in range(3):
            try:
                request = urllib.request.Request(entry['url'], headers={'User-Agent': 'SCAD-to-3D-source-builder'})
                with urllib.request.urlopen(request, timeout=60) as response, destination.with_suffix('.part').open('wb') as output:
                    shutil.copyfileobj(response, output)
                destination.with_suffix('.part').replace(destination)
                break
            except (OSError, TimeoutError):
                if attempt == 2:
                    raise
                time.sleep(2 ** attempt)
    with destination.open('rb') as verified_input:
        digest = hashlib.file_digest(verified_input, 'sha256').hexdigest()
    if digest != entry['sha256']:
        raise ValueError(f'Source checksum mismatch: {entry["name"]}')
    return destination


def unpack(entry, archive, sources):
    target = sources / checked_relative(entry['name'])
    target.mkdir(parents=True, exist_ok=True)
    if entry.get('format') == 'zip-overlay':
        with zipfile.ZipFile(archive) as bundle:
            for info in bundle.infolist():
                checked_relative(info.filename)
            bundle.extractall(target)
    else:
        with tarfile.open(archive) as bundle:
            # Archives are rooted in a versioned directory; preserve safe internal links.
            members = bundle.getmembers()
            for member in members:
                checked_relative(member.name)
                parts = PurePosixPath(member.name).parts
                if len(parts) == 1:
                    continue
                member.name = str(PurePosixPath(*parts[1:]))
                bundle.extract(member, target, filter='data')
    print(f'Verified source: {entry["name"]}', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--context', default='.cache/engine-context')
    parser.add_argument('--cache', default='.cache/engine-downloads')
    args = parser.parse_args()
    context, cache = Path(args.context), Path(args.cache)
    if context.exists():
        raise SystemExit(f'Refusing to overwrite source tree: {context}')
    cache.mkdir(parents=True, exist_ok=True)
    context.mkdir(parents=True)
    # Download independent archives concurrently, then extract in dependency order.
    with ThreadPoolExecutor(max_workers=4) as pool:
        archives = list(pool.map(lambda entry: fetch(entry, cache), LOCK['sources']))
    for entry, archive in zip(LOCK['sources'], archives):
        unpack(entry, archive, context / 'sources')
    shutil.copytree(ROOT, context / 'engine-build', ignore=shutil.ignore_patterns('__pycache__'))
    print(f'Source context ready: {context}', flush=True)


if __name__ == '__main__':
    main()
