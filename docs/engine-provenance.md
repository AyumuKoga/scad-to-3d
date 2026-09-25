# 配布エンジンと対応ソース（2026-09-25）

## 現行のソースビルド

- エンジンリリース：[engine-source-36078553836-1](https://github.com/AyumuKoga/scad-to-3d/releases/tag/engine-source-36078553836-1)。
- ビルドしたアプリリポジトリのcommit：`ca3017ad9847f8874c31d86088dfd402debfe784`。
- OpenSCAD本体：`ce5039f8a9545ad5a8cf197b3ca11c0939bc67f1`。
- SDK：`emscripten/emsdk:3.1.74@sha256:af45409f3199d88db4b1b03af0098532c8fb33a375ac257463eeb0a622870d06`。

`engine-build/release.json` でブラウザへ配布するJS/WASMとソースmanifest・ライセンス集のSHA-256を固定する。各入力ソースのURL・元配布元・commit・SHA-256は `engine-build/sources.lock.json` に保存する。

GitHubリリースには、実際に入力したOpenSCAD本体・サブモジュール・外部依存・Emscriptenランタイムのソース、元のライセンス、Dockerfile、ビルドスクリプトと変更内容を含む `engine-corresponding-source.tar.xz` を添付する。コンパイルはDocker内のコピーに対してネットワークを無効にして実行する。ソースへの手動変更は同梱スクリプトにあり、変更ファイルへ日付入りの表示を付加する。

同じアーカイブの20 MB分割ファイルをサイトの `source/` に配置し、全分割ファイルと結合後のSHA-256を検証してからビルドする。アプリ自身のソースは `source/scad-to-3d-source.zip` に同梱する。秘密情報・ローカル成果物は許可リストに含めない。

バイナリの採用前にChromium/WebKitで実際のモデル生成・STL保存を検証する。再ビルドでビット単位に同じバイナリになることを保証するものではない。構成と入力を追跡できる形でソースを提供する。

## 旧公式バイナリについて

以下は過去の配布物の調査記録で、現行ソースビルドとは別である。今回の切り替えは、過去の配布分の法的な扱いまで遡って解決したとの主張ではない。

### 2026-09-24時点の調査記録

### 当時確認できた内容

- 上流の変更していない公式配布物：`https://files.openscad.org/playground/OpenSCAD-2025.03.25.wasm24456-WebAssembly-web.zip`
- ZIP SHA-256：`0968af31b9c9b3bba68d9031de1695ccae51c32231a1aab4ef27b18c86379f3b`
- 実際のエンジンの `--info`：OpenSCAD 2025.03.25.wasm24456 / ce5039f8a。
- 本体の対応commit：`ce5039f8a9545ad5a8cf197b3ca11c0939bc67f1`。
- 本体ソースとその `.circleci/config.yml` を `public/source/openscad-ce5039f8a.tar.xz` で提供。
- ビルドは `emcmake cmake -B ../build . -DSNAPSHOT=ON -DEXPERIMENTAL=ON -DCMAKE_BUILD_TYPE=Release -DWASM_BUILD_TYPE=web` とバージョン引数、`make`。詳細は同commitのCircleCI設定を参照。

`--info` に含まれる依存情報：Emscripten 3.1.34、Boost 1.82、Eigen 3.3.90、CGAL 5.4.5-I-900、Clipper2 1.5.2、Manifold 3.0.1、GLib 2.75.0、lodepng 20230410、libzip 1.9.99、fontconfig 2.14.1、freetype 2.13.0、harfbuzz 7.1.0。

本体commitのgitlink：

| サブモジュール | revision |
| --- | --- |
| MCAD | 1ea402208c3127ffb443931e9bb1681c191dacca |
| Clipper2 | 6901921c4be75126d1de60bfd24bd86a61319fd0 |
| OpenCSG | 313018fbf997f484f66cb4a320bbd2abf79a4fc1 |
| manifold | 4edd442297e25bb1dc293559efc548bb0a89b053 |
| mimalloc | fe61be80bf8942e764e18d469e96f8dacab44728 |
| sanitizers-cmake | c3dc841af4dbf44669e65b82cb68a575864326bd |

### 当時確定できなかった内容

上流CIが使用した `openscad/wasm-base:latest` の当時のイメージdigestと、一部外部依存の正確なrevision・パッチは確定できていない。表示されたバージョン番号だけで全依存ソースが一致すると断定しない。アーカイブは本体ソースであり、完全な対応ソース一式とは呼ばない。

アプリ自身のソース・lockfile・ビルド設定は同じ配布場所の `source/scad-to-3d-source.zip` から取得可能。秘密情報とローカル成果物を含めない明示的な許可リストで生成する。

今後、上流の該当ビルドの完全な対応ソースを確保するか、依存ソース・toolchain・パッチを固定して再ビルドし、ソース一式とバイナリを同時に提供する。現在の資料だけでライセンス上の対応が完了したとは主張しない。
