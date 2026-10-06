# 研修マニュアル AIガイド

単一企業向けの小規模な研修マニュアルアプリです。既存サービスの複製はせず、VercelとSupabaseを使わずに独立して動きます。

## 機能

- Cloudflare Accessのメールワンタイムコードでログイン
- 管理者が社員メールを登録し、閲覧者・編集者・管理者を設定
- PC・スマートフォンからマニュアルの本文を貼り付けて共有
- PDF、Office文書、画像、テキストを添付し、アプリ内から開く
- Workers AIで登録本文を検索し、日本語で回答。参照元を併記
- D1に社員・マニュアル・検索本文、R2に添付ファイルを保存
- AIに接続できないときも、該当本文とマニュアルを返す

## 検索の範囲

この初版では、検索可能な本文を入力欄へ貼り付けます。PDFや画像は原本として添付・閲覧できますが、OCRによる自動文字起こしは行いません。紙面からコピーできる文字は本文欄へ貼り付けてください。スキャン資料を自動検索するOCRは次段階で追加します。

## ローカル確認

Node.js 20+が必要です。

```sh
npm install
cp .dev.vars.example .dev.vars
npm test
npm run db:migrate:local
npm run dev:local
```

`.dev.vars`のローカル確認モードでは、Cloudflare Accessを使わず`owner@example.test`として動作します。これはローカル限定です。公開環境では`ENVIRONMENT=development`を設定しないでください。

## Cloudflareへ公開する時

1. Cloudflareで新しいD1データベースとR2バケットを作ります。
2. `wrangler.jsonc`の`database_id`とバケット名を実リソースに合わせます。
3. `COMPANY_NAME`、`INITIAL_ADMIN_EMAIL`、`INITIAL_ADMIN_NAME`、`ALLOWED_EMAIL_DOMAIN`を対象会社の値に変更します。
4. Cloudflare Workers AIを有効にし、`npm run deploy`で公開します。
5. Accessのアプリを作成し、このアプリのURLを保護します。IDプロバイダーはEmail one-time PIN、ポリシーは対象会社のメールドメインに限定します。
6. AccessアプリのAudience TagとTeam DomainをWorkerの`CF_ACCESS_AUD`、`CF_ACCESS_TEAM_DOMAIN`変数に設定します。
7. `npx wrangler d1 migrations apply training-manual-ai --remote`でマイグレーションを適用します。
8. 管理者の会社メールで初回ログインし、社員メールを登録します。

本番ではCloudflare Accessのポリシーとアプリ内の社員許可リストの両方でアクセスを制限します。最初にログインした`INITIAL_ADMIN_EMAIL`のみ初期管理者として自動登録されます。

## 料金上の注意

Workers FreeのCPU上限は1リクエスト10msです。静的画面と小さな検索は無料枠で試せますが、添付処理やAI検索の負荷で制限に達する場合があります。Workers Paidへ変更する場合は月額最低料金が発生します。Workers AI、D1、R2の各利用枠もCloudflareの現行料金を確認してください。
