# SORT Gateway v2（Codex リビルド）

社内ドキュメントを参照する AI ゲートウェイ（セキュリティ重視版）。

## 構成

```
apps/web/              … フロントエンド（HTML + CSS + JS）
server/                … セキュア API サーバー
gateway.ps1            … ターミナル管理
AGENTS.md              … Codex / AI エージェント向けガイド
TERMINAL.md            … ターミナル運用メモ
SECURITY.md            … セキュリティ設計
```

レガシー単一ファイル版: `SORT GATEWAY MVA.html` → http://127.0.0.1:3001/legacy

## クイックスタート

```powershell
cd C:\Users\mmtak\Desktop\SORTGetaway
.\gateway.ps1 setup      # 初回のみ
# server\.env を編集（ANTHROPIC_API_KEY, GATEWAY_ACCESS_TOKEN）
.\gateway.ps1 restart
.\gateway.ps1 open
```

## セキュリティ概要

- API キーは **server/.env のみ**
- ドキュメントは **暗号化 vault**（`server/data/vault.enc`）
- 認証トークンは **sessionStorage** のみ
- チャット履歴は永続化しない

→ [SECURITY.md](SECURITY.md)

## ターミナル

→ [TERMINAL.md](TERMINAL.md)

## Codex / Cursor Agent で編集する場合

→ [AGENTS.md](AGENTS.md)

| 変更 | ファイル |
|------|----------|
| UI | `apps/web/assets/styles.css`, `apps/web/index.html` |
| フロントロジック | `apps/web/assets/app.js` |
| API | `server/index.js`, `server/lib/*` |

## API

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/auth/verify` | トークン検証 |
| GET | `/api/documents` | ドキュメント一覧 |
| POST | `/api/documents` | 登録 |
| DELETE | `/api/documents/:id` | 削除 |
| GET/PUT | `/api/settings` | プロトコル・トグル |
| POST | `/api/chat` | チャット |
| POST | `/api/chat/test` | 接続テスト |

認証: `Authorization: Bearer <GATEWAY_ACCESS_TOKEN>`
