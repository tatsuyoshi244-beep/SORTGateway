# SORT Gateway v2.1 Enterprise

企業向け社内 AI チャットボット兼ナレッジゲートウェイ。

## 開発環境の起動

```powershell
cd apps/enterprise
cp .env.example .env.local   # 初回のみ（未設定でもデモ動作可）
npm install
npm run dev
```

ブラウザ: http://localhost:3000/login

### デモログイン（Supabase 未設定時）

| アカウント | ロール |
|------------|--------|
| employee@sortgateway.local | 一般社員 |
| manager@sortgateway.local | 責任者 |
| executive@sortgateway.local | 役員 |
| admin@sortgateway.local | 管理者（自社テナント） |
| superadmin@sortgateway.local | SORT運営（super_admin・全企業管理） |

パスワード: `SortGateway2026!`  
デモトークンパス: `EXEC-2026-Q2-A1B2`

**テナント**: デモデータは `demo-company`（デモ株式会社）に紐付いています。  
`superadmin` ログイン後、ヘッダーまたは `/admin/companies` で企業を切り替えできます。

Supabase 設定後は Supabase Auth のメール/パスワードでログインします（上記デモアカウントは無効）。

## 環境変数（.env.local）

| 変数 | 必須 | 説明 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 本番 | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 本番 | 公開 anon キー |
| `SUPABASE_SERVICE_ROLE_KEY` | 本番 | 監査ログ書き込み用（サーバーのみ） |
| `OPENAI_API_KEY` | 任意 | 未設定時はモック回答 |
| `OPENAI_MODEL` | 任意 | 既定: `gpt-4o-mini` |

**未設定でも UI は動作します**（モックデータ・モック回答・コンソール監査）。

## Supabase セットアップ（本番）

### 1. プロジェクト作成

1. [Supabase](https://supabase.com) で新規プロジェクトを作成
2. **Project Settings → API** から URL / `anon` key / `service_role` key を控える

### 2. スキーマ適用

**本番推奨**: SQL Editor で `supabase/production-setup.sql` を一括実行。

個別適用する場合は以下を順に実行（RLS・トリガー・シード含む）。

1. `supabase/schema.sql`
2. `supabase/schema-phase5-tenant.sql`（マルチテナント）
3. `supabase/schema-phase6-security.sql`（セキュリティ強化）
4. `supabase/schema-phase7-lifecycle.sql`（ナレッジライフサイクル）
5. `supabase/schema-phase8-integrations.sql`（外部連携）
6. `supabase/schema-phase9-scheduling.sql`（定期同期スケジュール）
7. `supabase/schema-phase10-analytics.sql`（利用分析・chat_logs 拡張）
8. `supabase/schema-phase12-production.sql`（スキーマバージョン・Storage）

### 2b. 初期データ（本番デモ）

Auth ユーザー作成後、`supabase/seed-production-demo.sql` を実行（UUID プレースホルダーを置換）。

### 3. 新規企業（テナント）の初期化

```sql
-- 1. 企業作成
INSERT INTO companies (id, name, slug, plan, status)
VALUES ('acme-corp', 'ACME商事', 'acme-corp', 'standard', 'active');

-- 2. 初期部署
INSERT INTO departments (company_id, name, code)
VALUES ('acme-corp', '本社', 'HQ');

-- 3. Supabase Auth で管理者ユーザーを作成後、users に紐付け
UPDATE public.users
SET
  company_id = 'acme-corp',
  role = 'admin',
  full_name = 'ACME 管理者',
  department_id = (SELECT id FROM departments WHERE company_id = 'acme-corp' AND code = 'HQ' LIMIT 1)
WHERE id = '<auth.users の UUID>';
```

SORT 運営用 `super_admin` は `company_id = 'platform'`（または NULL）とし、アプリから全テナントを管理します。

### 4. 管理者ユーザーの作成（初回テナント）

1. **Authentication → Users → Add user** で管理者用メール/パスワードを作成
2. 作成されたユーザーの UUID を控える（`auth.users.id`）
3. トリガーで `public.users` に `employee` ロールの行が自動作成される
4. SQL Editor で管理者ロールを付与:

```sql
UPDATE public.users
SET role = 'admin', full_name = 'システム管理者', company_id = 'demo-company'
WHERE id = '<auth.users の UUID>';
```

必要に応じて部署を紐付け:

```sql
INSERT INTO departments (name, code) VALUES ('経営企画', 'CORP') ON CONFLICT DO NOTHING;

UPDATE public.users
SET department_id = (SELECT id FROM departments WHERE code = 'CORP' LIMIT 1)
WHERE id = '<auth.users の UUID>';
```

### 4. 環境変数

`.env.local`（ローカル）または Vercel の Environment Variables に設定:

| 変数 | 説明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon 公開キー |
| `SUPABASE_SERVICE_ROLE_KEY` | 監査ログ書き込み用（サーバーのみ） |
| `OPENAI_API_KEY` | 任意（未設定時モック回答） |

### 5. 動作確認

```powershell
npm run dev
```

- ログイン画面が **Supabase Auth** モードになる（デモクイックログインは非表示）
- 管理者でログイン → 全管理メニューが表示される
- 一般ユーザーはロールに応じたメニューのみ

**未設定時**は従来どおりデモログイン（`sessionStorage`）で全画面を確認できます。

## OpenAI API セットアップ

1. OpenAI で API キーを発行
2. `.env.local` に `OPENAI_API_KEY=sk-...` を追加
3. チャットは `/api/chat` 経由で OpenAI を呼び出し（クライアントにキーは露出しない）

## API エンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/chat` | AI チャット（ナレッジ参照 + 回答構造化） |
| POST | `/api/token-pass/verify` | トークンパス検証 |
| POST | `/api/audit` | 監査ログ記録（クライアントトリガー） |

## ビルド

```powershell
cd apps/enterprise
npm run build
npm start
```

## 本番デプロイ（Vercel）

1. GitHub にプッシュ
2. Vercel → New Project → Root Directory: `apps/enterprise`
3. Environment Variables に以下を設定:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
4. Deploy

| POST | `/api/documents/upload` | ドキュメントアップロード・インデックス |
| GET | `/api/documents` | ドキュメント一覧・統計 |
| DELETE | `/api/documents/[id]` | ドキュメント削除 |

## RAG / ドキュメント管理（第4段階）

| パス | 画面 |
|------|------|
| `/admin/documents` | ドキュメント管理（アップロード・一覧・削除） |
| `/documents/[id]` | 資料詳細（チャット回答根拠から遷移） |

### 対応ファイル形式

PDF / DOCX / XLSX / PPTX / TXT / MD（テキスト抽出は PDF・DOCX・TXT・MD）

### ストレージ

- **Supabase 設定時**: Storage バケット `documents` + DB テーブル
- **未設定時**: ローカル `.data/uploads/` + JSON インデックス

### Embedding 差し替え

`EMBEDDING_PROVIDER` 環境変数（`dummy` / `openai` / `azure` / `vertex`）  
実装は `src/lib/rag/embed.ts` の `embedTexts()` のみ変更すればよい。

## マルチテナント（第5段階）

| パス | 画面 |
|------|------|
| `/admin/companies` | 企業一覧・登録・ステータス（super_admin） |

- 全データは `company_id` で分離。デモは `demo-company`
- ヘッダーに現在の企業名。super_admin は企業切替 UI あり
- スキーマ: `schema-phase5-tenant.sql` → `schema-phase6-security.sql` を順に実行

## セキュリティ（第6段階）

| パス | 画面 |
|------|------|
| `/admin/security` | セキュリティポリシー参照（admin / super_admin） |

### API 認証

- 全 API は `X-Sort-Session` ヘッダー（または Supabase Bearer）で認証
- 未認証 → **401**、権限不足 → **403**
- `company_id` はサーバー側で強制チェック

### 本番導入前チェックリスト

- [ ] `schema-phase6-security.sql` を適用
- [ ] 環境変数（下表）を本番値に設定
- [ ] `SUPABASE_SERVICE_ROLE_KEY` をサーバーのみに限定（クライアントに露出しない）
- [ ] トークンパス `code` 列を `token_hash` に移行（下記手順）
- [ ] super_admin アカウントに MFA を設定
- [ ] Storage バケット `documents` を非公開に設定
- [ ] HTTPS / リバースプロキシで `X-Forwarded-For` を正しく設定

### 環境変数（セキュリティ関連）

| 変数 | 必須 | 説明 |
|------|------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | 本番 | 監査ログ・管理 API（サーバーのみ） |
| `DOCUMENT_UPLOAD_DIR` | 任意 | ローカル保存時のパス（本番は Supabase Storage 推奨） |

### token_hash 移行手順

```sql
-- 1. schema-phase6-security.sql を実行

-- 2. 既存平文 code をハッシュ化（pgcrypto 有効化後）
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE token_passes
SET token_hash = encode(digest(upper(trim(code)), 'sha256'), 'hex')
WHERE token_hash IS NULL AND code IS NOT NULL;

-- 3. 移行確認後、平文 code 列を削除
-- ALTER TABLE token_passes DROP COLUMN code;
```

新規発行時は平文トークンを **一度だけ** 画面表示し、DB には `token_hash` のみ保存します。

### セキュリティ注意点

- デモモードの `X-Sort-Session` は開発用。本番は Supabase JWT Bearer を使用
- トークンパス平文はログ・監査に記録しない
- 機密・役員限定ナレッジ閲覧は監査ログに記録される

## ナレッジライフサイクル（第7段階）

| パス | 画面 |
|------|------|
| `/admin/knowledge` | ナレッジ管理・承認ワークフロー |
| `/admin/knowledge-health` | 鮮度管理（30/90/180/365日） |
| `/admin/feedback` | AIフィードバック一覧 |
| `/notifications` | 更新通知・既読 |

### 承認ワークフロー

`Draft` → `Review`（manager+）→ `Approved`（admin）→ `Published`（admin）

- **Published のみ** AI 検索対象
- 更新時は `knowledge_versions` に履歴を保存

### AI回答品質

チャット回答に表示: 信頼度スコア、ナレッジバージョン、参照数、最終更新、担当部署・担当者。180日超で鮮度警告。

### 運用ルール（推奨）

1. 四半期ごとに `/admin/knowledge-health` で180日超をレビュー
2. フィードバック 👎 が多いナレッジは担当者が更新
3. Published 変更は必ず変更理由を記録
4. 機密ナレッジは Review 前に分類ラベルを確認

## 外部連携（第8段階）

| パス | 画面 |
|------|------|
| `/admin/integrations` | 外部連携管理（admin / super_admin） |

### 対応プロバイダー（モック段階）

Google Drive · Microsoft 365 / SharePoint · Slack · Teams · Notion · Box

### 設計

```
src/lib/integrations/
  adapters/     # プロバイダー別アダプター（差し替えポイント）
  registry.ts   # getIntegrationAdapter(provider)
  sync-service.ts
  integration-store.ts
  crypto.ts       # encryptCredentials() — 本番は KMS に差し替え
```

- `integration_connections` — 接続設定・暗号化 credentials
- `integration_sync_logs` — 同期履歴
- 手動同期 → モックファイルを `documents` / `document_chunks` に取り込み
- 接続・同期・切断は `audit_logs` に記録

### 実接続前の注意

現時点は **モック OAuth** です。本番では各アダプターの `sync()` / `testConnection()` を実 API に差し替えます。

### OAuth 拡張ポイント

| プロバイダー | 想定 API |
|-------------|----------|
| Google Drive | Google Drive API v3 + OAuth 2.0 |
| Microsoft 365 | Microsoft Graph（Sites/Drive） |
| Slack | Slack Web API + Bot Token |
| Teams | Microsoft Graph（Teams チャネル） |
| Notion | Notion API |
| Box | Box Platform API |

### credentials 暗号化

- API レスポンスに平文 credentials は **含めません**
- `encrypted_credentials` に `encryptCredentials()` で保存（スタブ: base64）
- 本番は **KMS / AES-256-GCM** + 環境変数 `INTEGRATION_CREDENTIALS_KEY` を推奨
- ローテーション時は接続を切断 → 再認証

## 定期同期・自動運用（第9段階）

| パス | 画面 / API |
|------|------------|
| `/admin/integrations` | 同期 ON/OFF・間隔・次回予定・連続エラー警告 |
| `/admin/integrations/logs` | 同期ログ詳細（実行時間含む） |
| `POST /api/jobs/sync-integrations` | 定期同期ジョブ（Cron 用） |

### スケジュール項目（`integration_connections`）

- `sync_enabled` / `sync_frequency`（manual / hourly / daily / weekly）
- `next_sync_at` / `last_successful_sync_at` / `consecutive_error_count`

### CRON_SECRET

```env
CRON_SECRET=your-random-secret-here
```

本番では **必須**。未設定時は開発環境（`NODE_ENV=development`）のみジョブ実行可。

### Vercel Cron 設定例

`vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/jobs/sync-integrations",
      "schedule": "0 * * * *"
    }
  ]
}
```

Vercel ダッシュボードで `CRON_SECRET` を設定し、Cron リクエストに Bearer トークンを付与します（Vercel Cron は `Authorization: Bearer ${CRON_SECRET}` を自動送信）。

### 手動実行（開発・検証）

```powershell
# CRON_SECRET 未設定時（開発のみ）
curl -X POST http://localhost:3000/api/jobs/sync-integrations

# CRON_SECRET 設定時
curl -X POST http://localhost:3000/api/jobs/sync-integrations `
  -H "Authorization: Bearer your-random-secret-here"
```

### 運用フロー

1. `/admin/integrations` で定期同期を ON + 間隔を選択
2. Cron が `next_sync_at <= now` の接続を同期
3. 成功 → `next_sync_at` 更新・`documents` に upsert（既存は chunks 再生成）
4. 失敗 → admin 通知・`consecutive_error_count` 増加
5. 連続 3 回失敗 → `status = error` + critical 通知

### 本番運用時の注意

- Cron は **1時間ごと** 推奨（`hourly` 連携向け）。`daily` / `weekly` は `next_sync_at` で制御
- 大量テナント時はジョブをキュー化（SQS / BullMQ）を検討
- GitHub Actions / Supabase Edge Functions からも同エンドポイントを呼び出し可能
- 同期失敗通知は `/notifications` に表示（admin 向け）

## 利用分析（第10段階）

| パス | 画面 |
|------|------|
| `/admin/analytics` | 利用分析ダッシュボード |
| `/admin/analytics/departments` | 部署別分析 |
| `/admin/unresolved-questions` | 未解決質問管理 |

### 分析カード

AI質問数・アクティブユーザー・参照ナレッジ数・根拠あり/なし率・フィードバック・低評価・未解決・古いナレッジ参照

### chat_logs 拡張

各チャット POST で `chat_logs` に記録（`has_knowledge`, `confidence_score`, `source_count`, `feedback_result`, `unresolved`, `department` 等）

### CSVエクスポート

| エンドポイント | 内容 |
|---------------|------|
| `GET /api/export/audit` | 監査ログ |
| `GET /api/export/chat-logs` | AI質問ログ |
| `GET /api/export/unresolved-questions` | 未解決質問 |
| `GET /api/export/feedback` | フィードバック |

manager 以上。`/admin/analytics` 画面からもダウンロード可能。

### 管理者の改善フロー（推奨）

1. `/admin/analytics` で根拠なし率・未解決数を確認
2. `/admin/unresolved-questions` で頻出テーマを「ナレッジ化」→ Draft 作成
3. `/admin/analytics/departments` で部署別の弱点を担当者に割当
4. `/admin/knowledge-health` と連携し古いナレッジを更新
5. 四半期ごとに CSV エクスポートで経営報告

## 本番品質（第11段階）

### テスト

```powershell
npm test          # Vitest ユニット/API/権限/RAG
npm run test:e2e  # Playwright E2E
npm run typecheck
npm run lint
```

### Health / Ready

| API | 用途 |
|-----|------|
| `GET /api/health` | Liveness（uptime, version） |
| `GET /api/ready` | Readiness（本番: Supabase/Storage/CRON/schema） |
| `GET /api/admin/system` | 遅延クエリ・エラーログ（admin） |

### システム画面

`/admin/system` — バージョン・ビルド SHA・依存チェック・パフォーマンス

### CI/CD

`.github/workflows/enterprise-ci.yml` — lint, typecheck, test, build, e2e

### ドキュメント

| ファイル | 内容 |
|---------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | アーキテクチャ |
| [docs/SECURITY.md](docs/SECURITY.md) | セキュリティ |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | デプロイ |
| [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) | 本番チェックリスト |
| [docs/DEPLOYMENT_VERIFICATION.md](docs/DEPLOYMENT_VERIFICATION.md) | デプロイ後検証 |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | 運用・バックアップ |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | API 一覧 |

### バックアップ（概要）

- DB: `pg_dump` / Supabase dump（日次推奨）
- Storage: `documents` バケット同期
- デモ: `.data/` を tar 保管
- 詳細: [docs/OPERATIONS.md](docs/OPERATIONS.md)

## 本番デプロイ（第12段階）

### 本番モードの挙動

| 項目 | 開発 | 本番 (`NODE_ENV=production`) |
|------|------|------------------------------|
| デモログイン | Supabase 未設定時のみ可 | **不可** |
| `x-sort-session` | デモ API 認証に使用 | **拒否**（JWT のみ） |
| `/api/ready` | `.data` 書き込み | Supabase・Storage・CRON・schema |
| Cron API | `CRON_SECRET` 未設定可 | **必須** |

### Vercel 設定

| 項目 | 値 |
|------|-----|
| Root Directory | `apps/enterprise` |
| Build Command | `npm run build` |
| Output | `.next` |
| Cron | 毎時 `/api/jobs/sync-integrations` |

環境変数一覧は [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) および [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) を参照。

### SQL

| ファイル | 用途 |
|---------|------|
| `supabase/production-setup.sql` | 本番スキーマ一括適用 |
| `supabase/seed-production-demo.sql` | 初期 company / ユーザー / サンプルデータ |

### デプロイ後検証

[docs/DEPLOYMENT_VERIFICATION.md](docs/DEPLOYMENT_VERIFICATION.md) のチェックリストに従って確認。

## 画面一覧

| パス | 画面 |
|------|------|
| `/login` | ログイン |
| `/dashboard` | ダッシュボード |
| `/chat` | AIチャット |
| `/knowledge` | ナレッジ検索 |
| `/handover` | 引継ぎ情報 |
| `/contacts` | 担当者検索 |
| `/admin` | 管理者ダッシュボード |
| `/admin/knowledge` | ナレッジ管理 |
| `/admin/users` | ユーザー・ロール |
| `/admin/token-passes` | トークンパス |
| `/admin/audit` | 監査ログ |
| `/admin/files` | ファイル連携 |
| `/admin/documents` | ドキュメント管理 |
| `/admin/companies` | 企業管理（super_admin のみ） |
| `/admin/security` | セキュリティ設定 |
| `/admin/knowledge-health` | ナレッジ鮮度 |
| `/admin/feedback` | AIフィードバック |
| `/notifications` | 通知 |
| `/admin/integrations` | 外部連携 |
| `/admin/integrations/logs` | 同期ログ詳細 |
| `/admin/analytics` | 利用分析 |
| `/admin/analytics/departments` | 部署別分析 |
| `/admin/unresolved-questions` | 未解決質問 |
| `/admin/system` | システム状態 |
| `/documents/[id]` | 資料詳細 |
| `/settings` | 設定 |

## ドキュメント

- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)
- [implementation-notes.md](../../implementation-notes.md)
- [supabase/schema.sql](./supabase/schema.sql)
