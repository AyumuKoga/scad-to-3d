# 共通パスワードでの限定提供・費用0円

## 現状（2026-09-25）

共通パスワードによる限定提供を開始済み。専用プロジェクトは `scad-to-3d-private`、公開先は https://scad-to-3d-private.pages.dev/ 。

- 管理画面で Workers Free / $0 / Current plan を2026-09-24に確認。有料プラン・課金対象リソースの追加なし。
- 公開URLでChromium / WebKitの認証・生成・STL保存テスト4件成功。
- production・previewの両方に `SITE_AUTH_SHA256` Secretを設定。
- 両環境の `fail_open: false` をAPI応答で確認。
- 入力ソースを固定して再ビルドしたエンジンと、依存を含む対応ソースを同時提供。[来歴](engine-provenance.md) に記録。旧公式バイナリのデプロイは削除済み。

## パスワード管理

ユーザー名は `scad`。パスワードは暗号学的乱数24バイト（192ビット）から生成し、`.secrets/site-credentials.txt` に所有者のみ読み書きできる0600で保存。Gitと公開ビルドから除外する。

サーバー側には `scad:パスワード` のSHA-256を `SITE_AUTH_SHA256` Secretとして設定する。登録用の `.secrets/cloudflare-secrets.json` とローカル検証用 `.dev.vars` も0600・Git除外。値をCLI引数・ログ・ソース・公開assetへ出さない。

共通パスワードを知る人は利用可能。個別の本人確認や個別失効は行わない。漏えい時は全員分を変更し、本番・プレビューにも反映。古いSecretを保持するデプロイは削除する。Basic認証の保持はブラウザに依存するため、共有端末ではプライベートウィンドウを使い利用後に閉じる。

## 配信とローカル確認

`npm run build` は `dist/_worker.js` と `_routes.json` を作る。全パス `/*` が認証対象で、HTML・JS・CSS・WASM・画像・ライセンスも除外しない。Secret不備は503、未認証と誤認証は401。認証後だけASSETSを呼び、Authorizationは転送しない。assetエラーも503で閉じる。

全応答を `private, no-store` にする。取得済みファイルの回収を保証する仕組みではない。SCAD入力・3D生成・STL保存は引き続き端末内で完結する。

```sh
npm run build
npm test
npm run test:protected
npm run preview:protected
```

認証付き確認は `http://127.0.0.1:8788/`。`npm run dev` / `npm run preview` は端末内のUI開発用で認証を実行しないため外部公開には使わない。新しい開発環境の初回だけ `node scripts/generate-site-password.mjs` を実行する。既存の認証情報があれば上書きせず停止する。

## 料金

| 処理 | 料金・上限 |
| --- | --- |
| 現在のローカル利用 | ホスティング費用なし |
| 3D生成・STL保存 | 端末内で実行。サーバーCPUやAI APIの課金なし |
| Functionsを通らないPages静的配信 | 無料・リクエスト数無制限 |
| 今回の保護付き配信 | 全ファイルが認証Functionを通る。Freeプランのアカウント共通1日100,000リクエストに算入 |
| 無料上限到達 | Fail closedでエラーを返す。追加料金で継続しない。日本時間9時に枠をリセット |
| Workers Paid | 最低月額5米ドル＋使用量の超過料金。今回は変更しない |
| 有料API・DB・ストレージ・独自ドメイン | 今回は追加・購入しない |

人数や閲覧数ではなくHTTPリクエスト数。1回の表示で複数のファイルを読む。再生成時もエンジン取得が起こり得るため、再生成が全て0リクエストとは扱わない。不正ログインや同アカウントの他のWorkers利用も無料枠を消費する。Free契約不明なら公開しない。将来のプラン変更時も無料条件を再確認する。

## 公開手順

1. Free契約を確認し、ソース提供状況と残件を確認する。
2. 専用Pagesプロジェクトを作成。既存の別サイトは変更しない。
3. 本番・プレビューにSecretを設定し、RuntimeのFail open / closedを **Fail closed** にする。
4. 認証ゲートと全パスのルーティングを含むビルドを配置。静的ファイルだけを先にアップロードしない。
5. 本番URL・デプロイURL・ブランチ別URL全てで、未認証・誤認証を拒否し、正しい認証で生成・保存可能なことを確認。
6. Secretの公開asset混入がないことを確認。認証や料金条件に不備があれば提供停止・デプロイ削除とし、保護を解除しない。

## 公式資料（2026-09-24確認）

- [Pages Functions料金](https://developers.cloudflare.com/pages/functions/pricing/)
- [Workers料金](https://developers.cloudflare.com/workers/platform/pricing/)
- [上限時のFail closed設定](https://developers.cloudflare.com/pages/functions/routing/#fail-open--closed)
- [Pages advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)
