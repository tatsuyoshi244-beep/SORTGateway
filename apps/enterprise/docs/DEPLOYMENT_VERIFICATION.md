# Deployment Verification

本番デプロイ後の動作確認手順です。順番に実施し、問題があれば [OPERATIONS.md](./OPERATIONS.md) のトラブルシュートを参照してください。

**前提**

- `production-setup.sql` 適用済み
- `seed-production-demo.sql`（または同等の初期データ）投入済み
- Vercel 本番デプロイ完了
- `/api/ready` が `ready: true`

```bash
curl -s https://<your-app>/api/ready | jq
```

---

## 1. ログイン

| 手順 | 期待結果 |
|------|----------|
| `/login` を開く | デモアカウント一覧が **ない** |
| テナント admin でサインイン | `/dashboard` に遷移 |
| ヘッダーに会社名・ユーザー名表示 | `デモ株式会社` 等 |
| ログアウト | `/login` に戻る |

**super_admin** の場合: ログイン後 `/admin/companies` でテナント切替が可能。

---

## 2. Company 分離

| 手順 | 期待結果 |
|------|----------|
| admin で `/admin/knowledge` | 自社ナレッジのみ表示 |
| super_admin で別テナントに切替 | ナレッジ一覧が切り替わる |
| 他社 `company_id` の API 直叩き | 403（JWT 改ざんテスト） |

---

## 3. AI チャット

| 手順 | 期待結果 |
|------|----------|
| `/chat` で質問入力 | 数秒以内に回答 |
| `OPENAI_API_KEY` 設定時 | 実 AI 回答（ナレッジ根拠付き） |
| 未設定時 | モック回答 + 警告表示の可能性 |

例: 「見積承認のルールを教えてください」

---

## 4. ドキュメントアップロード

| 手順 | 期待結果 |
|------|----------|
| admin → `/admin/documents` | 一覧表示 |
| `.txt` または `.pdf` をアップロード | 成功メッセージ |
| Supabase Storage → `documents` | オブジェクトが追加 |
| ドキュメント詳細 → チャンク | インデックス状態を確認 |

---

## 5. トークンパス

| 手順 | 期待結果 |
|------|----------|
| admin → `/admin/token-passes` | 一覧表示 |
| ヘッダー「トークンパス入力」 | モーダル表示 |
| 有効コードを入力 | スコープが適用される |
| 期限切れ / 無効コード | エラー |

---

## 6. 外部連携

| 手順 | 期待結果 |
|------|----------|
| `/admin/integrations` | 連携一覧（初期は空またはモック） |
| モック接続を追加 | 接続済みステータス |
| 「手動同期」 | 同期ログに記録 |
| `/admin/integrations/logs` | ログ詳細 |

---

## 7. Cron（定期同期）

| 手順 | 期待結果 |
|------|----------|
| Vercel Dashboard → Cron Jobs | 毎時ジョブが登録 |
| 手動実行（curl） | 200 + 同期結果 |

```bash
curl -X POST "https://<your-app>/api/jobs/sync-integrations" \
  -H "Authorization: Bearer $CRON_SECRET"
```

`CRON_SECRET` 未設定・不一致 → 503 / 401

---

## 8. Analytics（利用分析）

| 手順 | 期待結果 |
|------|----------|
| manager 以上で `/admin/analytics` | KPI カード表示 |
| 「AI質問数」等の数値 | 0 以上（チャット後は増加） |
| `/admin/analytics/departments` | 部署別集計 |
| `/admin/unresolved-questions` | 未解決一覧 |

---

## 9. Export（CSV）

| 手順 | 期待結果 |
|------|----------|
| `/admin/analytics` → CSV ボタン | ファイルダウンロード |
| 監査ログエクスポート | `audit-logs.csv` |
| チャットログエクスポート | `chat-logs.csv` |

---

## 10. システム状態

| 手順 | 期待結果 |
|------|----------|
| `/admin/system` | バージョン・ビルド SHA |
| `/api/health` | `status: ok` |
| `/api/ready` | 全必須チェック `true` |

---

## チェックリスト（サマリー）

- [ ] ログイン / ログアウト
- [ ] Company 分離
- [ ] AI チャット
- [ ] ドキュメントアップロード
- [ ] トークンパス
- [ ] 外部連携 + 手動同期
- [ ] Cron 手動実行
- [ ] Analytics 表示
- [ ] CSV エクスポート
- [ ] Health / Ready / System ダッシュボード

問題が解決しない場合は `implementation-notes.md` 第12段階の残課題を確認してください。
