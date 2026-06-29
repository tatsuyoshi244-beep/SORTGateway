# SORT Gateway v2.1 Enterprise — 実装ノート

最終更新: 2026-06-04（第12段階追記）

## 実装概要

`apps/enterprise` に Next.js 14 (App Router) + TypeScript + Tailwind CSS で v2.1 Enterprise を新規構築した。  
旧 `apps/web`（HTML/Express）はレガシーとして残存。本番ターゲットは本アプリ + Supabase + Vercel。

## 画面一覧（仕様どおり 12 画面）

| # | 画面 | パス | 状態 |
|---|------|------|------|
| 1 | ログイン | `/login` | ✅ 実装済 |
| 2 | 社員用チャット | `/chat` | ✅ 実装済 |
| 3 | 社内ナレッジ検索 | `/knowledge` | ✅ 実装済 |
| 4 | 引継ぎ情報 | `/handover` | ✅ 実装済（登録は manager+） |
| 5 | 担当者検索 | `/contacts` | ✅ 実装済 |
| 6 | 管理者ダッシュボード | `/admin` | ✅ 実装済 |
| 7 | ナレッジ登録・編集 | `/admin/knowledge` | ✅ 実装済 |
| 8 | ユーザー・ロール管理 | `/admin/users` | ✅ 実装済 |
| 9 | トークンパス管理 | `/admin/token-passes` | ✅ 実装済 |
| 10 | 監査ログ | `/admin/audit` | ✅ 実装済 |
| 11 | 社内ファイル連携設定 | `/admin/files` | ✅ 実装済 |
| 12 | 設定 | `/settings` | ✅ 実装済 |

ログイン後ダッシュボード: `/dashboard`（仕様の「ログイン後のダッシュボード」）

## 権限・アクセス制御

仕様どおり 4 ロールを `src/lib/permissions.ts` で定義。

| ロール | 実装したアクセス |
|--------|------------------|
| employee | チャット、ナレッジ検索、担当者検索、引継ぎ閲覧、設定 |
| manager | 上記 + 管理者ダッシュボード、ナレッジ管理、監査ログ、引継ぎ登録 |
| executive | 上記 + 機密閲覧（役員限定は executive/admin のみ） |
| admin | 全管理機能（ユーザー、トークンパス、ファイル連携、監査全件） |

情報分類フィルタ: `canViewClassification()` in `permissions.ts` + `data-access.ts`

## 技術判断・妥協点

### 1. 認証

- **デモ**: `sessionStorage` + デモユーザー（`mock-data.ts`）
- **本番**: Supabase Auth + `public.users` プロフィール（`auth-context.tsx` / `auth/profile.ts`）
- 環境変数未設定時はデモに自動フォールバック

### 2. データ永続化

- **デモ**: モックデータ + セッション内 CRUD
- **本番**: `src/lib/repositories/*` 経由で Supabase（RLS 適用）

### 3. AI チャット

- **第2段階以降**: `/api/chat` + OpenAI（未設定時モック）。ナレッジ候補は `lib/knowledge/search.ts`
- **クライアント**: 構造化表示（回答・根拠・参照・注意事項）

### 4. 旧 Express サーバーとの関係

- **判断**: 削除せず共存。Enterprise は独立デプロイ（Vercel）
- **レガシー**: `apps/web` + `server/` は `/legacy` 相当の参考実装

### 5. デザイン

- 白・グレー・濃紺（`navy-*`）基調。仕様どおり派手さを抑えた SaaS UI
- Google Fonts は未使用（オフライン build 安定性のためシステムフォント）

## 未実装・今後の作業

| 項目 | 優先度 | 内容 |
|------|--------|------|
| Supabase Auth 本番接続 | — | 第3段階で実装済 |
| 引継ぎ「編集」UI | 中 | 登録は実装済。既存行の編集フォームは未実装 |
| チャットログ DB 永続化 | 中 | `chat_logs` テーブルへの insert |
| 監査ログ自動記録 | 中 | API 経由 insert 済。全操作の網羅は未完了 |
| ファイル連携 OAuth | 高 | SharePoint/GDrive 実 OAuth（UI のみ） |
| manager 部署限定監査ログ | — | 第3段階で RLS 実装済 |
| E2E テスト | 低 | Playwright 等 |
| i18n | 低 | 設定画面の言語項目は UI のみ |

## ファイル構成

```
apps/enterprise/
  src/app/login/                 … ログイン
  src/app/(dashboard)/           … 認証後全画面
  src/components/layout/         … Sidebar, DashboardShell
  src/components/auth/           … RouteGuard, TokenPassModal
  src/lib/auth/profile.ts          … Supabase プロフィール取得
  src/lib/repositories/            … Supabase CRUD + モックフォールバック
  src/lib/permissions.ts         … RBAC（仕様準拠）
  src/lib/mock-data.ts           … デモデータ
  supabase/schema.sql            … RLS 付き DB 設計
```

## デモアカウント

| メール | ロール | パスワード |
|--------|--------|------------|
| employee@sortgateway.local | 一般社員 | SortGateway2026! |
| manager@sortgateway.local | 責任者 | 同上 |
| executive@sortgateway.local | 役員 | 同上 |
| admin@sortgateway.local | 管理者 | 同上 |

トークンパス例: `EXEC-2026-Q2-A1B2`

## ビルド確認

```powershell
cd apps/enterprise
npm run build
```

## 仕様変更について

本実装ではユーザー指定仕様（12 画面・4 ロール・4 分類・技術スタック）を変更していない。  
追加した `/dashboard` は仕様の「ログイン後のダッシュボード」に対応する導線であり、新規仕様追加ではない。

---

## 第2段階（2026-06-04 追記）

### 今回実装した内容

| 項目 | 実装 |
|------|------|
| Supabase 接続準備 | `.env.example`、`client` / `server` / `admin` クライアント、未設定時 null フォールバック |
| `/api/chat` | ナレッジ候補検索 → OpenAI or モック → 構造化レスポンス |
| チャット UI 強化 | 回答 / 根拠 / 参照ナレッジ / 注意事項を分離表示（`AssistantMessage`） |
| 監査ログ | `lib/audit.ts` + `/api/audit`、チャット・ナレッジ閲覧・トークン・管理者操作 |
| `/api/token-pass/verify` | 有効期限・利用回数・権限スコープ検証、未接続時デモトークン有効 |
| ドキュメント | README / 本ファイル更新 |

### API レスポンス構造（チャット）

```json
{
  "payload": {
    "answer": "…",
    "rationale": "…",
    "sources": [],
    "references": [],
    "warnings": [],
    "has_knowledge": true
  }
}
```

`has_knowledge: false` のとき注意事項に「推測で断定しない」旨を表示。

### まだモックの部分（第2段階時点・第3段階で一部解消）

| 項目 | 第3段階後の状態 |
|------|----------------|
| ログイン認証 | ✅ Supabase Auth + デモフォールバック |
| ナレッジ一覧 | ✅ DB 取得（管理画面 CRUD は state のまま） |
| 監査ログ表示 | ✅ DB 取得（書き込みは API 経由） |
| 引継ぎ・担当者・ファイル連携 | ✅ DB 取得 |
| chat_logs テーブル | insert 未実装 |

### 本番化に必要な残作業（第2段階時点・第3段階で一部解消）

1. ~~Supabase Auth 連携~~ → 第3段階で実装済
2. ~~audit_logs 管理画面を Supabase から読み込み~~ → 実装済
3. ~~ナレッジ・引継ぎの repository 移行~~ → 一覧・一部 CRUD 実装済
4. `token_passes` を Supabase にシードし本番検証
5. Rate limiting / API 認証（セッション JWT 検証）
6. OpenAI 以外のモデル切替・コスト監視

---

## 第3段階（2026-06-04 追記）

### 今回実装した内容

| 項目 | 実装 |
|------|------|
| Supabase Auth | email/password ログイン・ログアウト、未設定時デモログイン維持 |
| ユーザープロフィール | `auth.users` ↔ `public.users` 連携、`fetchUserProfile`、失敗時 `employee` |
| ロール別アクセス | メニュー・RouteGuard 更新、`executive_only` は executive/admin のみ |
| Supabase CRUD | `lib/repositories/*` — knowledge / handover / contacts / audit / token-pass / files / users |
| schema.sql 強化 | `auth.uid()` 連携トリガー、classification RLS、監査ログ部署制限、token/files は admin のみ |
| ドキュメント | README 管理者初期化手順、本ファイル更新 |

### 認証フロー

- **Supabase 未設定**: `sessionStorage` + デモユーザー（従来どおり）
- **Supabase 設定済**: `signInWithPassword` → `public.users` から role / department / full_name 取得
- 未ログイン → `/login`、ログイン済み → `/dashboard`

### データ取得フロー

各画面は `useRepositoryData` + `lib/repositories` 経由でデータ取得。

- 環境変数未設定 → モックデータ
- 設定済み → Supabase Client（RLS 適用）→ 失敗時モックにフォールバック

### 権限変更（第3段階）

| 変更 | 内容 |
|------|------|
| `executive_only` | トークンパスでは解除不可（executive / admin のみ） |
| トークンパス管理 | admin のみ（ルート・RLS とも） |
| 監査ログ | manager は同一部署ユーザーのログのみ（RLS）、executive は閲覧不可 |

### まだ未完成の部分

| 項目 | 状態 |
|------|------|
| ナレッジ管理画面 CRUD | 管理画面はクライアント state（一覧は `/knowledge` で DB 取得） |
| 引継ぎ編集 UI | 新規登録のみ DB 対応 |
| chat_logs 永続化 | insert 未実装 |
| API ルート JWT 検証 | `/api/chat` 等はセッション検証なし（要強化） |
| SSO / MFA | Email/password のみ |
| ファイル連携 OAuth | UI + DB 読み取りのみ |

### 本番運用前の注意点

1. **service_role キー**は Vercel のサーバー環境変数のみに配置（クライアントに露出しない）
2. **初回管理者**は Supabase Dashboard でユーザー作成後、必ず `public.users.role = 'admin'` を SQL で付与
3. **RLS**は schema.sql のポリシーに依存。カスタムポリシー変更時はアプリの `permissions.ts` と整合を確認
4. **監査ログ**の manager 閲覧範囲は DB 側 RLS で制限。admin は全件
5. デモモードと本番モードの切替は環境変数のみ。ステージングでも本番 Supabase を指さないこと

---

## 第4段階（2026-06-04 追記）— RAG 基盤

### 今回追加した内容

| 項目 | 実装 |
|------|------|
| `/admin/documents` | 一覧・アップロード・削除、状態・部署・公開範囲表示 |
| DB テーブル | `documents`, `document_chunks`（schema.sql） |
| アップロード API | `POST /api/documents/upload` |
| ストレージ | Supabase Storage `documents` バケット or ローカル `.data/uploads/` |
| テキスト抽出 | PDF（pdf-parse v2）/ DOCX（mammoth）/ TXT / MD |
| チャンク分割 | `lib/rag/chunk.ts`（約500文字・50文字オーバーラップ） |
| Embedding 基盤 | `lib/rag/embed.ts`（ダミー、プロバイダー差し替え可能） |
| RAG 検索 | `lib/rag/search.ts` — knowledge + document_chunks キーワード検索 |
| チャット API | `searchRagCandidates` → OpenAI / モック回答 |
| 回答根拠 UI | `AssistantMessage` に「参考資料」セクション、`/documents/[id]` へリンク |
| 管理ダッシュボード | ドキュメント件数 / Indexed / Processing / Error カード |

### モジュール構成

```
src/lib/documents/
  extract.ts        … テキスト抽出
  document-store.ts … 永続化（Supabase / ローカル）
  local-store.ts    … ローカル JSON + ファイル
  stats.ts          … 件数集計
src/lib/rag/
  chunk.ts          … チャンク分割
  embed.ts          … Embedding（差し替えポイント）
  search.ts         … RAG 検索統合
```

### Embedding 差し替え方法

1. `EMBEDDING_PROVIDER=openai`（または `azure` / `vertex`）を設定
2. `lib/rag/embed.ts` の `embedTexts()` にプロバイダー実装を追加
3. `document_chunks` に `embedding` カラム（pgvector）を追加（schema 拡張）
4. `lib/rag/search.ts` をキーワード検索からベクトル類似度検索に切り替え
5. バッチジョブで `embedding_status: pending` のチャンクを処理

現状は **ダミーベクトル** を生成するが検索には未使用。検索は簡易キーワードマッチ。

### 未完成部分

| 項目 | 状態 |
|------|------|
| XLSX / PPTX テキスト抽出 | アップロード可、抽出失敗 → `Error` |
| ベクトル検索 | キーワード検索のみ |
| Embedding 本番 API 呼び出し | `embed.ts` にスタブのみ |
| 非同期インデックス | アップロード API 内で同期処理（大容量はタイムアウト注意） |
| ドキュメント編集 | 削除・再アップロードのみ |

### 本番運用手順

1. `schema.sql` を実行（`documents` / `document_chunks` 含む）
2. Supabase Storage に `documents` バケットを作成（非公開）
3. manager 以上で `/admin/documents` からファイルアップロード
4. 状態が `Indexed` になることを確認
5. `/chat` で関連質問 → 「参考資料」にファイル名・ページ・部署が表示されることを確認
6. 本番 Embedding 導入時は `EMBEDDING_PROVIDER` と `embed.ts` を更新

### デモ確認

Supabase 未設定でもローカルストレージでアップロード・チャンク生成が動作。  
モックデータ（就業規則.pdf 等）でチャットの参考資料表示を確認可能。

---

## 第5段階（2026-06-04 追記）— マルチテナント SaaS

### 今回追加した内容

| 項目 | 実装 |
|------|------|
| `companies` テーブル | id / name / slug / plan / status / timestamps |
| `company_id` | 全主要テーブル + モックデータ（`demo-company`） |
| データ分離 | リポジトリ・RAG 検索・API で `effectiveCompanyId` フィルタ |
| RLS | `same_company()` / `is_super_admin()` — `schema-phase5-tenant.sql` |
| `super_admin` ロール | SORT 運営専用。企業内 `admin` とは別 |
| `/admin/companies` | 企業一覧・登録・ステータス変更・統計・切替 |
| UI | ヘッダーに企業名、super_admin は `TenantSwitcher` |
| 企業初期化 | README に SQL 手順 |

### super_admin と admin の違い

| | admin | super_admin |
|---|--------|-------------|
| 所属 | 1 社のテナント | SORT 運営（platform） |
| 管理範囲 | **自社のみ**（users / ナレッジ / 監査等） | **全企業**（`/admin/companies`） |
| 他社データ | 閲覧不可（RLS + アプリ層） | 企業切替後に当該テナントとして操作 |
| ロール付与 | 自社ユーザーのみ | テナント横断（DB 上は service role 推奨） |

### 未完成部分

| 項目 | 状態 |
|------|------|
| 全テーブル RLS の company 条件 | 主要テーブルのみ Phase 5 SQL で更新。残りは本番前に統一 |
| サブドメイン / slug ルーティング | `company_id` はセッション・DB。URL は未連動 |
| 課金・プラン制限 | `plan` カラムのみ。機能制限は未実装 |
| 企業オンボーディング UI | SQL / API 手動。ウィザード未実装 |

### 本番運用時の注意点

1. **admin は他社データに絶対アクセスできないこと**を RLS で担保（`same_company`）
2. **super_admin アカウント**は最小人数・強力な MFA を推奨
3. 新規企業は必ず `companies` → `departments` → `users.company_id` の順で初期化
4. デモ環境は `demo-company` 固定。本番では企業ごとに UUID またはスラッグ ID を使用
5. `schema.sql` 実行後に **必ず** `schema-phase5-tenant.sql` を実行

---

## 第6段階（2026-06-04 追記）— セキュリティ強化

### 今回追加した内容

| 項目 | 実装 |
|------|------|
| API ロールガード | `auth-guard.ts` — 401/403、`company_id` 強制 |
| 入力検証 | `validate.ts` — 軽量バリデーション、ファイル MIME/サイズ |
| 監査ログ強化 | `company_id`, `result`, `user_agent` + 9種アクション |
| token_hash | SHA-256 ハッシュ保存、平文は発行時1回のみ |
| `/admin/security` | ポリシー参照画面 |
| UI 警告 | 機密/役員限定バナー、AI 資料なし注意 |

### API 権限マトリクス

| エンドポイント | 必要権限 |
|----------------|----------|
| `GET/POST/PATCH /api/companies` | super_admin |
| `POST /api/documents/upload` | manager 以上 |
| `DELETE /api/documents/[id]` | manager 以上 + 自社 |
| `POST /api/token-pass/verify` | ログインユーザー |
| `POST /api/audit` | ログインユーザー |
| `POST /api/chat` | ログインユーザー + 自社テナント |

### セキュリティ上まだ弱い部分

| 項目 | 状態 |
|------|------|
| デモモード認証 | `X-Sort-Session` は改ざん可能（本番は JWT 必須） |
| CSRF トークン | Same-Origin + セッションヘッダーのみ。専用 CSRF トークン未実装 |
| Rate limiting | API 全体に未実装 |
| ファイルマルウェアスキャン | `scan_on_upload: false` |
| 監査ログ改ざん防止 | `immutable_storage: false` |

### 本番前に必ず確認する項目

1. `schema-phase6-security.sql` 適用と `token_hash` 移行完了
2. 全 API が未認証で 401 を返すこと
3. admin が他社 `company_id` で 403 になること
4. トークンパス平文が DB・ログに残っていないこと
5. `SUPABASE_SERVICE_ROLE_KEY` がクライアントバンドルに含まれていないこと
6. HTTPS 強制とセキュア Cookie（Supabase Auth 本番設定）

---

## 第7段階（2026-06-04 追記）— ナレッジライフサイクル

### 今回追加した内容

| 項目 | 実装 |
|------|------|
| `knowledge_versions` | 更新履歴（version, change_reason, approval_status） |
| 承認ワークフロー | Draft → Review → Approved → Published |
| AI品質メタデータ | confidence_score, version, source_count, 担当者, 鮮度警告 |
| `/admin/knowledge-health` | 30/90/180/365日バケット、赤表示 |
| `feedback` テーブル | 👍/👎 + `/admin/feedback` |
| `notifications` | Published 時通知 + `/notifications` 既読 |
| 管理者ダッシュボード | AI利用・古いナレッジ・未承認・FB件数 |

### 未完成部分

| 項目 | 状態 |
|------|------|
| メール/Slack 通知 | DB 通知のみ。外部連携未実装 |
| 承認者の複数段階 | admin 単一承認のみ |
| バージョン差分 UI | 履歴は DB 保存。diff 表示未実装 |
| 自動リマインダー | 鮮度超過の定期通知未実装 |
| Supabase 本番 CRUD | デモは `.data/lifecycle-store.json` |

### 運用ルール（推奨）

1. **Published のみ** を AI 回答根拠にする（実装済み）
2. 180日超ナレッジは四半期レビューで更新 or アーカイブ
3. 👎 フィードバックは週次で担当者が確認
4. 内容変更時は変更理由を必ず記録し Draft から再承認
5. 機密・役員限定は Published 前に admin が分類を再確認

---

## 第8段階（2026-06-04 追記）— 外部連携基盤

### 今回追加した内容

| 項目 | 実装 |
|------|------|
| `integration_connections` | provider, status, config_json, encrypted_credentials |
| `integration_sync_logs` | スキャン/取込/スキップ/エラー件数 |
| アダプター | `src/lib/integrations/adapters/*` 6プロバイダー |
| `/admin/integrations` | 連携カード・手動同期・切断・ログテーブル |
| API | GET/POST integrations, sync, disconnect, sync-logs |
| documents 取込 | `importSyncedDocument()` モック同期 |
| 監査 | integration.connect / sync / disconnect |
| `/settings` | 外部連携状態サマリー |

### モック部分

| 項目 | 状態 |
|------|------|
| OAuth フロー | 未実装。接続時に mock トークンを保存 |
| アダプター API 呼び出し | 全プロバイダーが固定モックデータを返す |
| 永続化 | `.data/integrations-store.json`（Supabase 未接続時） |
| `encryptCredentials` | base64 スタブ（本番非推奨） |

### 本番化に必要な残作業

1. **OAuth 2.0** — 各プロバイダーの認可 URL / コールバック `/api/integrations/oauth/callback`
2. **Google Drive API** — `files.list` + `files.export` でテキスト抽出
3. **Microsoft Graph** — `/sites/{id}/drive/root/children` + SharePoint 権限
4. **Slack API** — `conversations.history` + ファイルダウンロード
5. **Teams** — Graph `channels/{id}/filesFolder`
6. **Notion API** — `blocks.children.list` 再帰取得
7. **Box API** — `folders/{id}/items` + ダウンロード
8. **KMS 暗号化** — `crypto.ts` を AES-256-GCM + マスターキーに差し替え
9. **定期同期** — Cron / Supabase Edge Functions で `scheduled` sync
10. **RLS** — `integration_connections` の company スコープポリシー

### 接続予定 API 一覧

- Google: [Drive API v3](https://developers.google.com/drive/api/guides/about-sdk)
- Microsoft: [Microsoft Graph](https://learn.microsoft.com/graph/api/resources/sharepoint)
- Slack: [Web API](https://api.slack.com/web)
- Notion: [Notion API](https://developers.notion.com/)
- Box: [Box Platform](https://developer.box.com/)

---

## 第9段階（2026-06-04 追記）— 定期同期・自動運用

### 今回追加した内容

| 項目 | 実装 |
|------|------|
| スケジュール列 | `sync_enabled`, `sync_frequency`, `next_sync_at`, `last_successful_sync_at`, `consecutive_error_count` |
| `POST /api/jobs/sync-integrations` | CRON_SECRET 認証・期限到来接続の一括同期 |
| `scheduled-sync-job.ts` | `listConnectionsDueForSync()` → `runIntegrationSync(syncType: scheduled)` |
| `upsertSyncedDocument()` | 同一 `source_path` は更新 + chunks 再生成 |
| 通知 | 失敗 / 連続3回 critical / 新規・更新成功 |
| `/admin/integrations` | 同期 ON/OFF・間隔・次回予定・連続エラー警告 |
| `/admin/integrations/logs` | 実行時間・詳細ログ |
| `/settings`, `/admin/security` | 定期同期運用サマリー |
| `vercel.json` | Cron 設定例（毎時） |

### cron の設計

```
Vercel Cron (0 * * * *)
  → POST /api/jobs/sync-integrations
  → verifyCronAuth(CRON_SECRET)
  → listConnectionsDueForSync(now)
  → foreach: runIntegrationSync({ syncType: 'scheduled' })
  → success: next_sync_at = computeNextSyncAt(frequency)
  → failure: consecutive_error_count++, 3回で status=error
```

代替トリガー: GitHub Actions `schedule`, Supabase `pg_cron` + Edge Function

### モック部分

| 項目 | 状態 |
|------|------|
| Cron 実際のスケジュール実行 | ローカルは手動 POST のみ |
| アダプター | 第8段階と同様モック |
| 通知配信 | アプリ内通知のみ（メール/Slack 未実装） |
| Supabase スケジュール列 | スキーマのみ。アプリは JSON store |

### 未完成部分

1. **メール/Slack への critical 通知エスカレーション**
2. **ジョブの分散実行**（マルチテナント大量同期時のタイムアウト対策）
3. **同期中の重複実行防止**（分散ロック / advisory lock）
4. **部分失敗時のリトライポリシー**（指数バックオフ）
5. **Supabase 本番 CRUD** へのスケジュール列反映

### 本番化時の推奨構成

| 環境 | 推奨 |
|------|------|
| Vercel Pro | `vercel.json` crons + `CRON_SECRET` |
| 高負荷 | Supabase Edge Function + `pg_cron`、または AWS EventBridge → Lambda |
| 監視 | ジョブ結果を Datadog / Sentry に送信、`consecutive_error_count` アラート |
| 秘密管理 | `CRON_SECRET` は Vercel Environment Variables（Production のみ） |

手動検証:

```bash
curl -X POST https://your-app.vercel.app/api/jobs/sync-integrations \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 第10段階（2026-06-04 追記）— 利用分析ダッシュボード

### 今回追加した内容

| 項目 | 実装 |
|------|------|
| `/admin/analytics` | 9種の分析カード・根拠率バー・CSVエクスポート |
| `/admin/analytics/departments` | 部署別質問/未解決/低評価/古いナレッジ |
| `/admin/unresolved-questions` | ナレッジ化・担当割当・解決・非表示 |
| `chat_logs` 拡張 | has_knowledge, confidence_score, unresolved 等 |
| `chat-log-store.ts` | チャット POST 時に自動記録 |
| キーワードグルーピング | `grouping.ts` 簡易類似質問検出 |
| CSV API | audit / chat-logs / unresolved / feedback |

### モック部分

| 項目 | 状態 |
|------|------|
| 永続化 | `.data/chat-logs-store.json` + 10件デモデータ |
| グラフ | CSS バーのみ（Chart.js 等未導入） |
| 類似質問 | キーワード重複の簡易ロジック |
| Supabase chat_logs | スキーマのみ。アプリは JSON store |

### 未完成部分

1. **時系列グラフ** — 日次/週次の質問数トレンド
2. **セマンティッククラスタリング** — embedding ベースの類似質問グループ
3. **リアルタイムダッシュボード** — WebSocket / 定期リフレッシュ
4. **Supabase 本番 CRUD** — chat_logs への insert/select
5. **部署スコープ RLS** — manager は自部署のみ閲覧
6. **BigQuery / Snowflake 連携** — 大規模分析基盤へのエクスポート

### 本番分析基盤への拡張方針

| 層 | 推奨 |
|----|------|
| 収集 | チャット POST → Supabase `chat_logs` + イベントバス |
| 集計 | 日次バッチ（Edge Function）で materialized view |
| 可視化 | Metabase / Looker 連携、または embedded analytics |
| アラート | 未解決数閾値超過 → Slack 通知 |
| プライバシー | CSV エクスポート時の PII マスキング・監査 |

改善サイクル: **未解決検出 → Draft ナレッジ → レビュー → Published → 根拠率向上** を四半期 KPI として追跡。

---

## 第11段階（2026-06-04 追記）— 本番品質・運用基盤

### 今回追加した内容

| 項目 | 実装 |
|------|------|
| Vitest | 権限・API エラー・RAG・分析・タイミング・Health API・PageHeader・session-codec |
| Playwright | login, chat, documents, knowledge, integrations, analytics, health |
| GitHub Actions | `.github/workflows/enterprise-ci.yml` |
| Health / Ready | `/api/health`, `/api/ready` |
| `/admin/system` | バージョン・依存・遅延クエリ |
| エラー統一 | `src/lib/api/errors.ts` |
| オブザーバビリティ | logger, timing, middleware `X-Response-Time` |
| キャッシュ | `src/lib/cache/` + RAG 60s TTL |
| エラーページ | `error.tsx`, `global-error.tsx` |
| ドキュメント | `docs/ARCHITECTURE.md` 他 4 ファイル |

### モック / 未完成部分

| 項目 | 状態 |
|------|------|
| エラーログ永続化 | メモリバッファのみ（Datadog/Sentry 未接続） |
| Redis キャッシュ | MemoryCache のみ |
| E2E ナレッジ公開フロー | 画面表示確認まで（full workflow 未自動化） |
| API 全ルートの errors.ts 移行 | chat のみ統一済み、他はレガシー形式 |

### 第11段階で修正した不具合

- **ブラウザ API 認証**: `encodeSessionHeader` が Node 専用 `base64url` を使っていたため、クライアントの `apiFetch` が失敗し Analytics 等が「分析データを取得できませんでした」となる問題を `src/lib/api/session-codec.ts` でブラウザ対応エンコードに修正
| Supabase 本番テスト | CI はモックモード |

### 本番化への拡張方針

1. **Sentry / Datadog** — `logError` から外部送信
2. **Redis** — `getCache()` の本番実装
3. **Rate limiting** — middleware または API Gateway
4. **契約テスト** — OpenAPI + Pact
5. **負荷テスト** — k6 で `/api/chat` スパイク
6. **ステージング E2E** — デプロイ後 smoke on production-like env

### 品質ゲート

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```

すべて成功がマージ条件（CI 同等）。

---

## 第12段階（2026-06-04 追記）— 本番デプロイ準備

### 本番化で変更した内容

| 項目 | 実装 |
|------|------|
| 本番認証 | `NODE_ENV=production` で JWT のみ、`x-sort-session` / body user 拒否 |
| デモ無効化 | `allowsDemoAuth()` — 本番または Supabase 設定時はモックログイン不可 |
| API クライアント | Supabase セッションから `Authorization: Bearer` を付与 |
| `/api/ready` 強化 | DB 接続・Storage・CRON_SECRET・schema_version（phase10） |
| SQL | `production-setup.sql`（phase3〜12 統合）、`seed-production-demo.sql` |
| ドキュメント | `PRODUCTION_CHECKLIST.md`、`DEPLOYMENT_VERIFICATION.md` |
| schema 追跡 | `schema_migrations` テーブル + `schema-phase12-production.sql` |

### デモ無効化の詳細

- ログイン画面のクイックデモボタンは `allowsDemoAuth()` が false のとき非表示
- `sessionStorage` へのデモセッション保存も本番では行わない
- E2E / ローカル開発（Supabase 未設定）は従来どおりデモログイン可

### Supabase 本接続の注意点

1. **Auth ユーザーと `public.users` の UUID 一致** — Dashboard で作成後 `seed-production-demo.sql` で role / company_id を更新
2. **Storage `documents` バケット** — `production-setup.sql` で作成。アップロードは service_role 経由
3. **`schema_migrations`** — `/api/ready` は最新 version が `phase10` であることを要求
4. **JWT 認証** — ブラウザは Supabase `access_token` を API に送信。`x-sort-session` は本番不可
5. **OPENAI_API_KEY** — 未設定でも起動可だが `/api/ready` に警告、AI はモック

### 残課題

| 項目 | 状態 |
|------|------|
| Vercel デプロイ自動化 | CI は build/test のみ。deploy workflow は未追加 |
| ステージング環境 | Preview 用 Supabase プロジェクトの手順は checklist に記載のみ |
| 本番 E2E | Supabase 接続が必要なため CI ではモックモードのまま |
| マイグレーション drift 検出 | `schema_migrations` は手動 INSERT。Flyway/Supabase CLI 未導入 |
| Storage RLS ポリシー | service_role アップロード前提。クライアント直接アップロードは未実装 |
| 全 API の errors.ts 統一 | 第11段階から継続 |

### 本番チェックコマンド

```bash
curl -s https://<app>/api/ready | jq '.ready, .checks, .warnings'
```

