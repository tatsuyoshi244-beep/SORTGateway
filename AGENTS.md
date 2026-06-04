# SORT Gateway — Codex / Agent 向けガイド

## プロジェクト概要

社内ドキュメントを参照するセキュア AI ゲートウェイ。Node.js サーバー + 静的 Web UI。

## ディレクトリ

```
apps/web/           … フロントエンド（編集はここ）
  index.html
  assets/styles.css
  assets/app.js
server/             … API・認証・暗号化 vault
  index.js
  lib/
  data/vault.enc
scripts/manage.ps1  … ターミナル管理
gateway.ps1         … manage.ps1 の入口
```

## 開発コマンド

```powershell
.\gateway.ps1 status
.\gateway.ps1 restart
.\gateway.ps1 open
```

URL: http://127.0.0.1:3001

## セキュリティ（変更禁止の原則）

- `ANTHROPIC_API_KEY` は `server/.env` のみ。クライアントに載せない
- ドキュメント本文は API 一覧に含めない（メタデータのみ）
- チャット履歴はサーバーに保存しない
- RAG コンテキストは `server/lib/validate.js` の `buildSystemPrompt` でサーバー側組み立て

## 変更時の注意

| 変更したいこと | 触るファイル |
|----------------|--------------|
| UI / レイアウト | `apps/web/assets/styles.css`, `index.html` |
| クライアントロジック | `apps/web/assets/app.js` |
| API | `server/index.js`, `server/lib/*` |
| 認証・暗号化 | `server/lib/auth.js`, `vault.js`, `crypto-util.js` |

レガシー単一 HTML: `SORT GATEWAY MVA.html`（`/legacy` で参照可・非推奨）

## テスト

1. `.\gateway.ps1 status` → Health OK
2. ブラウザログイン（`GATEWAY_ACCESS_TOKEN`）
3. ドキュメント登録 → チャット応答
