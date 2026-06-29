# SORT Gateway v2.1 Enterprise

企業向け社内 AI チャットボット兼ナレッジゲートウェイ。

## 完成状態（2026-06）

**v2.1 Enterprise** は第12段階まで完了し、本番デプロイ準備済みです。

| 領域 | 状態 |
|------|------|
| 機能 | マルチテナント・RAG・外部連携・定期同期・利用分析 |
| 品質 | Vitest / Playwright / GitHub Actions CI |
| 本番 | `production-setup.sql`、JWT 認証、Ready チェック、Vercel 設定 |
| ドキュメント | [implementation-notes.md](implementation-notes.md)（第1〜12段階） |

```powershell
cd apps/enterprise
npm install
npm run lint && npm test && npm run build && npm run test:e2e
```

本番チェックリスト: [apps/enterprise/docs/PRODUCTION_CHECKLIST.md](apps/enterprise/docs/PRODUCTION_CHECKLIST.md)

## メインアプリ（v2.1 Enterprise）

```powershell
cd apps/enterprise
cp .env.example .env.local   # 任意（未設定でもデモ可）
npm install
npm run dev
```

→ http://localhost:3000/login

詳細: [apps/enterprise/README.md](apps/enterprise/README.md)

### 環境変数

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 公開キー |
| `SUPABASE_SERVICE_ROLE_KEY` | 監査ログ（サーバーのみ） |
| `OPENAI_API_KEY` | AI チャット（未設定時モック） |

### デモログイン

| メール | ロール |
|--------|--------|
| employee@sortgateway.local | 一般社員 |
| manager@sortgateway.local | 責任者 |
| executive@sortgateway.local | 役員 |
| admin@sortgateway.local | 管理者 |
| superadmin@sortgateway.local | SORT運営（super_admin） |

パスワード: `SortGateway2026!`  
トークンパス: `EXEC-2026-Q2-A1B2`

### API（第2–3段階）

- `POST /api/chat` — AI チャット
- `POST /api/token-pass/verify` — トークン検証
- `POST /api/audit` — 監査ログ

### Supabase 本番接続（第3段階）

管理者初期化の詳細は [apps/enterprise/README.md](apps/enterprise/README.md) を参照。

### RAG 基盤（第4段階）

- `/admin/documents` でドキュメントアップロード・管理
- チャットは `knowledge_items` + `document_chunks` を検索
- 回答に「参考資料」セクションを表示

### マルチテナント（第5段階）

- `companies` テーブル + 全データに `company_id`
- `super_admin` + `/admin/companies`
- 詳細: [implementation-notes.md](implementation-notes.md) 第5段階

### セキュリティ強化（第6段階）

- API 401/403、`token_hash`、監査ログ強化
- `/admin/security`
- 詳細: [implementation-notes.md](implementation-notes.md) 第6段階

### ナレッジライフサイクル（第7段階）

- 承認ワークフロー、`knowledge_versions`、鮮度管理、AIフィードバック
- `/admin/knowledge-health`、`/admin/feedback`、`/notifications`
- 詳細: [implementation-notes.md](implementation-notes.md) 第7段階

### 外部連携（第8段階）

- `/admin/integrations` + アダプター構造（モック）
- Google Drive / M365 / Slack / Teams / Notion / Box
- 詳細: [implementation-notes.md](implementation-notes.md) 第8段階

### 定期同期・自動運用（第9段階）

- `POST /api/jobs/sync-integrations` + CRON_SECRET
- 同期スケジュール・連続エラー管理・documents upsert
- 詳細: [implementation-notes.md](implementation-notes.md) 第9段階

### 利用分析（第10段階）

- `/admin/analytics` / 部署別 / 未解決質問管理
- chat_logs 拡張・CSVエクスポート
- 詳細: [implementation-notes.md](implementation-notes.md) 第10段階

### 本番品質（第11段階）

- Vitest + Playwright + GitHub Actions CI
- Health/Ready API、`/admin/system`
- 詳細: [implementation-notes.md](implementation-notes.md) 第11段階

### 本番デプロイ（第12段階）

- `production-setup.sql` / `seed-production-demo.sql`
- 本番モード: デモログイン無効・JWT 必須・Ready 強化
- 詳細: [apps/enterprise/docs/PRODUCTION_CHECKLIST.md](apps/enterprise/docs/PRODUCTION_CHECKLIST.md)
- 検証: [apps/enterprise/docs/DEPLOYMENT_VERIFICATION.md](apps/enterprise/docs/DEPLOYMENT_VERIFICATION.md)

### テスト・CI

```powershell
cd apps/enterprise
npm test
npm run test:e2e
```

### ビルド

```powershell
cd apps/enterprise
npm run build
```

またはプロジェクト直下:

```powershell
npm run build
```

## ドキュメント

| ファイル | 内容 |
|----------|------|
| [implementation-notes.md](implementation-notes.md) | 実装判断・未実装点（必読） |
| [apps/enterprise/supabase/schema.sql](apps/enterprise/supabase/schema.sql) | DB 設計（RLS 付き） |
| [TERMINAL.md](TERMINAL.md) | レガシー Express 版ターミナル運用 |
| [SECURITY.md](SECURITY.md) | レガシー版セキュリティ |

## レガシー（v2 HTML + Express）

旧版は `apps/web` + `server/`。ターミナル管理は `gateway.ps1`。

```powershell
.\gateway.ps1 start
# http://127.0.0.1:3001
```

## 構成

```
apps/enterprise/     … v2.1 Enterprise（Next.js）← 本番ターゲット
apps/web/            … v2 レガシー HTML
server/              … Express API（レガシー）
implementation-notes.md
```
