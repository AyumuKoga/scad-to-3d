# 検証結果（2026-09-20）

## 2026-09-24 パスワード保護の追加検証

- ビルド成功。単体テスト17件成功（認証3件追加）。
- Cloudflareローカルランタイム上の認証テスト4件成功（Chromium/WebKit各2件）。未認証・誤認証の拒否、認証後の実WASM生成・STLダウンロードを確認。
- Secret未設定で503、認証前にはASSETSを呼ばない、配信障害も503、認証情報をASSETSへ転送しないことを検証。
- 生成パスワード・Secretのdist混入なし、認証ファイルの0600権限、再生成を実行しても既存認証情報を上書きしないことを確認。
- 外部デプロイは未実施。Free契約の確認、PagesのFail closed、対応エンジンソースの提供を残件として記録。

以下は従来のUI・エンジン検証結果。

## 実施環境

- macOS / Node.js 25.5.0
- Playwright 1.63.0、Chromium 153.0.8010.12、WebKit 26.6
- WebKitではiPad（第7世代）の画面・タッチ設定を使用。実iPadOSではない。
- Google Chrome実製品のheadless起動でも初回の生成を確認。
- Codex内ブラウザでもブラケットを生成し、808三角形・保存可能な状態を確認。
- Bambu Studio 02.08.02.61（インストール済みMacアプリのCLI）。

## 自動テスト

`npm test`：14件成功（cm換算とモデルサイズに応じたグリッド間隔の検証を含む）。

- 空入力・コメントのみ・サイズ上限・Markdown囲み
- 外部ファイル参照の禁止、コメントや文字列内の語を誤検出しないこと
- 日本語エラーと行番号
- 制限時間到達時のWorker終了、次回の生成
- 中止・遅延応答・入力検証失敗時のWorker非生成

`npm run test:e2e`：20件成功（Chromium 10件、WebKit 10件、約36秒）。`npm run build` の静的出力を使用。

両ブラウザで以下17種類、計34回の実WASMレンダリングを実施。

| モデル | 主な対象 |
| --- | --- |
| cube | 寸法10×20×30、STL体積6000の検証 |
| cylinder / sphere | 曲面 |
| union / difference / intersection | CSG演算 |
| rotate / translate / scale | 座標変換 |
| hull / minkowski | 包絡・ミンコフスキー和 |
| module_for | module・for・変数 |
| extrude / rotate_extrude | 2Dから立体への変換 |
| scale_if_math | if・数式 |
| bracket / phone / holder | 実用モデル |
| largeBox | 22×14×8cmの持ち手付き収納ボックス |

追加検証：大きめのモデルでcm/mmの寸法とグリッド表示が対応すること、表示単位変更前後でSTLの全バイトが同一であること、STLの最大座標が220×140×80mmであることを両ブラウザで確認。床面定規はモデル左端を0とする相対距離で、グリッドと同じ間隔の目盛りを表示する。

各STLはバイナリヘッダ・三角形数・ファイルサイズの整合性、有限座標、正の符号付き体積を検証。cubeは期待する体積と一致。外部originへの通信・ページ例外がないことも確認。

その他：構文エラーの行番号と原文、空モデル、エラー後の再生成、変更後の保存無効化、7視点と全体表示、画像変化による回転・ズーム・パン、WebKitのタッチPointer Events経路、中止、エンジン取得失敗と再試行、390pxでの縦配置と横はみ出し防止、サンプル置換のキャンセルと確定を検証。

サンプル切替を素早く繰り返すと古いdialog closeイベントが次の選択を消す問題を発見し、選択状態を同期的に消す処理へ修正。上下面への変更時にOrbitControlsの上方向キャッシュが古くなる問題も修正済み。

## 本番向けUIの追加検証

- BETA・英文の装飾・重複する説明を削除し、サンプル・使い方・cm/mm表示を維持。
- UTF-8日本語を含むSCADの読込→編集→保存がバイト内容を保持。元ファイル名に対応するSTL名で保存。
- 形式不正・空・バイナリ・UTF-8不正・200KB超過・ファイルI/O失敗を拒否。読み込み・貼り付け拒否時にエディタ内容を保持。
- 編集中のファイル置換は確認ダイアログでキャンセル・確定可能。
- `webglcontextlost` イベントを模擬し、再開操作後に入力・寸法・保存可否が復元され、canvasが1枚だけであることを確認。GPU障害やOSによるタブ強制終了の再現試験ではない。
- Worker起動失敗に日本語案内を表示し、次の試行を妨げないことを単体テスト。
- production HTMLのCSPから開発用WebSocket許可を除去。静的ホスト向けヘッダーはnoindex・private/no-storeに変更（ホスト上の適用は未検証）。
- 外部公開と認証設定は保留。デプロイ・有料サービス登録は実施していない。

## Bambu StudioによるSTL読込

ブラウザからダウンロードしたSTLを `BambuStudio --info` で読み込んだ結果。

| ファイル | 寸法(mm) | 三角形 | manifold | 部品数 | 体積(mm³) |
| --- | --- | ---: | --- | ---: | ---: |
| bracket.stl | 40×30×35 | 808 | yes | 1 | 9446.729492 |
| phone.stl | 65×65×68 | 110 | yes | 1 | 46818.773438 |
| holder.stl | 76×76×45 | 1708 | yes | 1 | 37833.730469 |

成果物は `artifacts/` に保存。Bambu Studioが形状として認識したことを確認しており、実機での3Dプリント・造形強度・G-code生成は実施していない。

## 配布・品質

- TypeScript strict型チェックとVite production build成功。
- npm install時の全依存auditおよび `npm audit --omit=dev` は既知脆弱性0件（実行時点）。
- OSS license metadataをpackage-lock全件について確認。開発ツールの依存はMIT / Apache-2.0 / MPL-2.0 / ISC / BSD-3-Clause。固定した一覧をビルド時に `public/licenses/generated/dependencies.json` として作成。
- デスクトップとモバイルの画面をPNGで確認。`artifacts/desktop.png` と `artifacts/mobile.png`。

## 未検証・未完了

Windows実機Chrome/Edge、実製品Safari、実iPadのSafari/ファイル保存/マルチタッチ/メモリ、40人同時の学校回線、PrusaSlicer/Cura、一般公開先は未検証。WebKitエミュレーションで実端末対応済みとは断定しない。

他の利用者への提供前にGPL対応ソースとWASM内部依存の照合・提供が必要。詳しくは [公開チェックリスト](release-checklist.md) を参照。


## 2026-09-24 外部公開確認

- 本番URL：https://scad-to-3d-private.pages.dev/
- デプロイURL：https://180c42b8.scad-to-3d-private.pages.dev/
- Cloudflare管理画面で Workers Free / $0 / Current plan を確認。有料機能・独自ドメインは追加していない。
- 本番・プレビューの Secret が secret_text、fail_open が false であることをデプロイ後にもAPIで再確認。
- 本番とデプロイURLそれぞれ8パス（HTML・JS・WASM・ソース等）で未認証と誤認証の401を確認。ブランチエイリアス・プレビューデプロイは作成していない。
- 認証後の本番WASMがローカルとバイト一致。Content-Type: application/wasm、Cache-Control: private, no-store。
- 公開先に対するChromium / WebKit E2E 4件成功。10×20×30mmの立方体を生成し、cm寸法表示・12三角形のbinary STLダウンロードを確認。
- 単体17件、サーバー型チェック、本番ビルド成功。
- 公開ファイルと展開したアプリソースZIPにパスワード・認証ハッシュが含まれないことを確認。
- 証跡：artifacts/cloudflare-deployment.json、artifacts/deployment-verification.json。
- OpenSCAD外部依存revisionの完全な照合は未完了。docs/engine-provenance.mdに残件を記録。
