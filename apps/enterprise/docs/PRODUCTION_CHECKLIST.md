# Production Checklist

SORT Gateway v2.1 Enterprise を本番環境へデプロイする前後のチェックリストです。

## 1. Supabase プロジェクト

- [ ] [Supabase](https://supabase.com) で本番用プロジェクトを作成
- [ ] リージョン・プランを決定（日本向けは Tokyo 推奨）
- [ ] **Project Settings → API** から以下を控える
  - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`（サーバーのみ）

## 2. スキーマ適用

Supabase **SQL Editor** で以下を **1 ファイル** 実行（推奨）:

```text
supabase/production-setup.sql
```

または個別ファイルを順に実行:

1. `schema.sql`
2. `schema-phase5-tenant.sql`
3. `schema-phase6-security.sql`
4. `schema-phase7-lifecycle.sql`
5. `schema-phase8-integrations.sql`
6. `schema-phase9-scheduling.sql`
7. `schema-phase10-analytics.sql`
8. `schema-phase12-production.sql`

適用後の確認:

```sql
SELECT version, description, applied_at
FROM schema_migrations
ORDER BY applied_at;
-- 最新が phase10 であること
```

## 3. Storage バケット

`production-setup.sql` 末尾で `documents` バケットを作成します。

- [ ] Dashboard → **Storage** で `documents` バケットが存在する
- [ ] Public アクセスは **オフ**
- [ ] ファイルサイズ上限（既定 50MB）を確認

## 4. Auth 設定

- [ ] **Authentication → Providers** で Email を有効化
- [ ] 本番ドメインを **Site URL / Redirect URLs** に追加
- [ ] パスワードポリシーを社内基準に合わせる
- [ ] デモアカウント（`@sortgateway.local`）は **本番では作成しない**

## 5. 初期ユーザー作成

### super_admin（SORT 運営）

1. Authentication → Users → **Add user**
2. メール: `superadmin@<your-domain>`
3. UUID を控え、`seed-production-demo.sql` の `:SUPER_ADMIN_AUTH_UUID` に設定

### テナント admin

1. 同様に `admin@<your-domain>` を作成
2. UUID を `:ADMIN_AUTH_UUID` に設定
3. `supabase/seed-production-demo.sql` を実行（プレースホルダー置換後）

## 6. 初期 company

`seed-production-demo.sql` で以下を投入:

- `platform`（SORT 運営）
- `demo-company`（初回テナント・本番では実社名に変更可）

## 7. Vercel 環境変数

Root Directory: **`apps/enterprise`**

| 変数 | Production | Preview | 説明 |
|------|------------|---------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | Service role（秘密） |
| `OPENAI_API_KEY` | ✅ 推奨 | 任意 | 未設定時はモック回答 + `/api/ready` 警告 |
| `CRON_SECRET` | ✅ 必須 | ✅ | 定期同期ジョブ認証 |
| `INTEGRATION_CREDENTIALS_KEY` | ✅ 推奨 | 任意 | 連携資格情報の暗号化 |
| `NEXT_PUBLIC_APP_VERSION` | 任意 | 任意 | UI 表示用 |
| `BUILD_SHA` / `BUILD_TIME` | 任意 | 任意 | ビルド情報 |

`NODE_ENV=production` は Vercel が自動設定します。

## 8. CRON_SECRET

```bash
openssl rand -hex 32
```

Vercel → Settings → Environment Variables に `CRON_SECRET` を設定。

`vercel.json` の cron が毎時 `/api/jobs/sync-integrations` を呼び出します。

## 9. OPENAI_API_KEY

- [ ] OpenAI ダッシュボードで本番用キーを発行
- [ ] Vercel に `OPENAI_API_KEY` を設定
- [ ] 未設定の場合: アプリは起動するが AI はモック、`/api/ready` に警告

## 10. Vercel デプロイ

```bash
cd apps/enterprise
vercel link
vercel env pull .env.vercel.local   # 確認用
vercel deploy --prod
```

## 11. 本番 URL 確認

- [ ] `https://<your-app>.vercel.app/api/health` → `{ "status": "ok" }`
- [ ] `https://<your-app>.vercel.app/api/ready` → `ready: true`, `schema_version: "phase10"`
- [ ] ログインページにデモアカウント一覧が **表示されない**
- [ ] Supabase Auth で admin ログイン成功
- [ ] `/admin/system` でバージョン・ビルド情報を確認

## 12. デプロイ後検証

詳細手順: [DEPLOYMENT_VERIFICATION.md](./DEPLOYMENT_VERIFICATION.md)

## セキュリティ確認（本番）

- [ ] `x-sort-session` ヘッダーが API で拒否される（JWT のみ）
- [ ] デモパスワード `SortGateway2026!` でログインできない
- [ ] `CRON_SECRET` なしでは cron API が 503
- [ ] `service_role` キーがクライアントバンドルに含まれていない

## 関連ドキュメント

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [DEPLOYMENT_VERIFICATION.md](./DEPLOYMENT_VERIFICATION.md)
- [SECURITY.md](./SECURITY.md)
- [OPERATIONS.md](./OPERATIONS.md)
