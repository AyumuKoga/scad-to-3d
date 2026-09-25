import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, readdir, unlink } from 'node:fs/promises';

// This manifest selects a tested source build, never an unreviewed "latest" asset.
const release = JSON.parse(await readFile('engine-build/release.json', 'utf8'));
if (!/^engine-source-\d+-\d+$/.test(release.tag)) throw new Error('Invalid engine release tag');
const base = `https://github.com/YumYum-cad/scad-to-3d/releases/download/${release.tag}`;
const cache = `.cache/engine-releases/${release.tag}`;
await mkdir(cache, { recursive: true });
await mkdir('public/engine', { recursive: true });
await mkdir('public/source', { recursive: true });
await mkdir('public/licenses/generated', { recursive: true });
async function asset(entry) {
  if (!/^[A-Za-z0-9._-]+$/.test(entry.file) || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
    throw new Error('Invalid pinned engine asset');
  }
  const path = `${cache}/${entry.file}`;
  let bytes;
  try { bytes = await readFile(path); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.log(`Downloading verified engine release file: ${entry.file}`);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`${base}/${entry.file}`, { signal: AbortSignal.timeout(180000) });
        if (!response.ok) throw new Error(`Engine download failed: HTTP ${response.status}`);
        bytes = new Uint8Array(await response.arrayBuffer());
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
  }
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256 || bytes.byteLength !== entry.bytes) {
    throw new Error(`Engine asset integrity check failed: ${entry.file}. Remove its cache file and retry.`);
  }
  await writeFile(path, bytes);
  return path;
}
if (release.binaries.length !== 2 || new Set(release.binaries.map(entry => entry.file)).size !== 2) throw new Error('Both engine files must be pinned');
for (const entry of release.binaries) {
  if (!['openscad.js', 'openscad.wasm'].includes(entry.file)) throw new Error('Unexpected engine binary');
  await copyFile(await asset(entry), `public/engine/${entry.file}`);
}
const parts = JSON.parse(await readFile(await asset(release.sourceManifest), 'utf8'));
if (!/^[a-f0-9]{64}$/.test(parts.completeSha256) || !Array.isArray(parts.parts) || !parts.parts.length) throw new Error('Invalid source manifest');
for (const file of await readdir('public/source')) {
  if (/^engine-source\.tar\.xz\.part\d{3}$/.test(file)) await unlink(`public/source/${file}`);
}
const completeHash = createHash('sha256');
for (const [index, entry] of parts.parts.entries()) {
  if (entry.file !== `engine-source.tar.xz.part${String(index + 1).padStart(3, '0')}`) throw new Error('Source parts must be consecutive');
  if (!/^engine-source\.tar\.xz\.part\d{3}$/.test(entry.file)) throw new Error('Unexpected source part');
  const verifiedPath = await asset(entry);
  completeHash.update(await readFile(verifiedPath));
  await copyFile(verifiedPath, `public/source/${entry.file}`);
}
if (completeHash.digest('hex') !== parts.completeSha256) throw new Error('Combined source archive checksum mismatch');
await copyFile(`${cache}/${release.sourceManifest.file}`, 'public/source/source-parts.json');
await copyFile(await asset(release.notices), 'public/licenses/generated/engine-notices.txt');
await copyFile('engine-build/release.json', 'public/source/engine-release.json');
const links = parts.parts.map(part => `<li><a href="./${part.file}">${part.file}</a> (${(part.bytes/1_000_000).toFixed(1)} MB) <code>${part.sha256}</code></li>`).join('\n');
await writeFile('public/source/index.html', `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>対応ソース — SCAD → 3D</title><style>body{font-family:system-ui;max-width:900px;margin:50px auto;padding:0 24px;line-height:1.8;background:#f5f6f3;color:#273d32}a{color:#237f68}code{overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere}li{margin:12px 0}</style><body><a href="../licenses.html">← ライセンス</a><h1>配布中のプログラムに対応するソース</h1><p><a href="./scad-to-3d-source.zip">アプリのソース・ビルド設定（ZIP）</a> ／ <a href="https://github.com/YumYum-cad/scad-to-3d">GitHubリポジトリ</a></p><h2>OpenSCADエンジン</h2><p><a href="${base}/engine-corresponding-source.tar.xz">依存ライブラリ・ライセンス・ビルド手順を含むソース一式（GitHub、単一ファイル）</a></p><p>このサイトからも同じ一式を分割ファイルで取得できます。下記をすべて同じフォルダーへ保存し、番号順に結合してください。合計 ${(parts.parts.reduce((sum, p)=>sum+p.bytes,0)/1_000_000).toFixed(1)} MB。</p><ol>${links}</ol><h2>結合・確認・展開（macOS / Linux）</h2><pre>cat engine-source.tar.xz.part* &gt; engine-source.tar.xz
shasum -a 256 engine-source.tar.xz
tar -xJf engine-source.tar.xz</pre><p>結合後のSHA-256：<code>${parts.completeSha256}</code></p><p>WindowsではGitHubの単一ファイルを取得し、tar対応ツールで展開できます。再ビルド手順は展開後の <code>engine-build/README.md</code> にあります。</p><p><a href="./source-parts.json">分割ファイルの検証情報</a> ／ <a href="./engine-release.json">配布エンジンの固定版・検証情報</a></p></body></html>`);
console.log(`Source-built engine and corresponding source ready: ${release.tag}`);
