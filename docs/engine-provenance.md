# OpenSCADエンジンの来歴（2026-09-24）

## 確認済み

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

## 未完了・技術的負債

上流CIが使用した `openscad/wasm-base:latest` の当時のイメージdigestと、一部外部依存の正確なrevision・パッチは確定できていない。表示されたバージョン番号だけで全依存ソースが一致すると断定しない。アーカイブは本体ソースであり、完全な対応ソース一式とは呼ばない。

アプリ自身のソース・lockfile・ビルド設定は同じ配布場所の `source/scad-to-3d-source.zip` から取得可能。秘密情報とローカル成果物を含めない明示的な許可リストで生成する。

今後、上流の該当ビルドの完全な対応ソースを確保するか、依存ソース・toolchain・パッチを固定して再ビルドし、ソース一式とバイナリを同時に提供する。現在の資料だけでライセンス上の対応が完了したとは主張しない。
