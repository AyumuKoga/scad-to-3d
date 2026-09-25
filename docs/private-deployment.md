# デプロイとパスワード認証

## ローカルでの確認

Node.js 22.12以降を使用する。初回の開発環境では次を実行する。

```sh
npm ci
node scripts/generate-site-password.mjs
npm run build
npm run preview:protected
```

`http://127.0.0.1:8788/` を開く。生成スクリプトは既存の認証情報を上書きしない。`npm run dev` / `npm run preview` は認証を実行しない。

## 認証情報

生成スクリプトはユーザー名 `scad` と暗号学的乱数24バイトの共通パスワードを作成する。

| ファイル | 用途 |
| --- | --- |
| `.secrets/site-credentials.txt` | 利用者へ渡す認証情報 |
| `.secrets/cloudflare-secrets.json` | サーバー設定用のSHA-256 |
| `.dev.vars` | ローカルのCloudflareランタイム用Secret |

各ファイルは所有者だけが読み書きできる0600で保存し、Gitと配布ソースから除外する。認証情報をCLI引数・ログ・ソース・公開アセットに出さない。

サーバーには `scad:パスワード` のSHA-256を `SITE_AUTH_SHA256` Secretとして設定する。共通認証のため個別の本人確認や個別失効は行わない。漏えい時は認証情報を更新し、本番・プレビューのSecretにも反映する。旧Secretを保持したデプロイにも対処する。

## Cloudflare Pagesへの配置

1. 自分のPagesプロジェクトを作成し、`wrangler.jsonc` の `name` を合わせる。
2. 本番・プレビューに `SITE_AUTH_SHA256` をSecretとして設定する。
3. 両環境を **Fail closed** に設定し、無料枠超過時も認証を迂回しないようにする。
4. `npm run build` で生成した `dist/` 全体を配置する。`_worker.js` と `_routes.json` を省略しない。
5. 本番・デプロイ・ブランチURLで、未認証と誤認証の拒否、認証後のモデル生成とSTL保存を確認する。
6. ソース・ライセンスの取得と、公開アセットに秘密情報が混入していないことを確認する。

認証は全パスが対象。Secret不備と配信障害は503、未認証・誤認証は401で拒否する。認証成功後にだけASSETSを呼び、Authorizationは転送しない。応答は `private, no-store` とする。

Cloudflare用の認証ゲートは他の静的ホストでは動作しない。他の環境でアクセスを制限する場合は、そのホストの認証機能を用意する。取得済みのファイルを回収する仕組みではない。

## 費用と上限

3D生成は端末内で実行し、AI APIは使用しない。ホスティング費用は配置先の契約に依存する。

Cloudflare Workers Freeでは、認証Functionへのリクエストはアカウント共通の日次枠に算入される。2026-09-25確認時点の上限は1日100,000リクエストで、UTC午前0時にリセットされる。人数やページ閲覧数ではなくHTTPリクエスト数であり、1回の表示でも複数消費する。

無料運用ではFree契約とFail closedを確認し、有料プラン・有料リソースを追加しない。契約や上限の変更は配置先の公式資料を確認する。

- [Pages Functions料金](https://developers.cloudflare.com/pages/functions/pricing/)
- [Workers料金](https://developers.cloudflare.com/workers/platform/pricing/)
- [Fail closed設定](https://developers.cloudflare.com/pages/functions/routing/#fail-open--closed)
- [Pages advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)
