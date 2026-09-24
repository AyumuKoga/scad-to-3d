#!/usr/bin/env python3
"""Package the actual input tree, with 20 MB parts usable on Cloudflare Pages."""
import hashlib
import json
import subprocess
from pathlib import Path

out = Path('.cache/engine-release')
out.mkdir(parents=True, exist_ok=True)
archive = out / 'engine-corresponding-source.tar.xz'
subprocess.run(['tar', '--sort=name', '--mtime=@1770000000', '--owner=0', '--group=0', '--numeric-owner', '-cJf', str(archive), '-C', '.cache/engine-context', '.'], check=True, env=__import__('os').environ | {'XZ_OPT': '-T2 -6'})
parts = []
with archive.open('rb') as source:
    while chunk := source.read(20_000_000):
        file = out / f'engine-source.tar.xz.part{len(parts)+1:03}'
        file.write_bytes(chunk)
        parts.append({'file': file.name, 'bytes': len(chunk), 'sha256': hashlib.sha256(chunk).hexdigest()})
manifest = {'format': 'xz-compressed tar, split into numbered parts; concatenate in filename order', 'completeSha256': hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest(), 'parts': parts}
(out / 'source-parts.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(f'Packaged corresponding source in {len(parts)} parts', flush=True)
