# SORT Gateway セキュリティ設計

## 原則

| 項目 | 方針 |
|------|------|
| API キー | **サーバーの `.env` のみ**。ブラウザ・localStorage に保存しない |
| 社内ドキュメント | **AES-256-GCM** で `server/data/vault.enc` に暗号化保存 |
| チャット履歴 | **メモリのみ**（サーバー・localStorage に永続化しない） |
| 認証 | `GATEWAY_ACCESS_TOKEN` を Bearer トークンで送信（**sessionStorage** のみ） |
| ネットワーク | 既定で **127.0.0.1** にバインド（LAN 非公開） |
| CORS | `ALLOWED_ORIGINS` で許可オリジンを限定 |
| レート制限 | API 全体 30 req/分、チャット 15 req/分（IP 単位） |

## 初回セットアップ

```powershell
cd server
npm install
node scripts/setup-env.js
```

1. `server/.env` を開き `ANTHROPIC_API_KEY` を設定
2. 表示された `GATEWAY_ACCESS_TOKEN` を控える（ログイン画面で使用）
3. `node index.js` で起動
4. ブラウザで **http://127.0.0.1:3001** を開く（`file://` は不可）

## 本番運用のチェックリスト

- [ ] `.env` を Git にコミットしない（`.gitignore` 済み）
- [ ] `vault.enc` をバックアップし、暗号化キーを別途安全に保管
- [ ] トークンを定期的にローテーション（`setup-env.js` で再生成後、全ユーザーに配布）
- [ ] 社内利用のみ: `HOST=127.0.0.1` を維持
- [ ] リバースプロキシ + HTTPS（nginx 等）で TLS 終端
- [ ] ファイアウォールで 3001 番ポートを必要最小限に開放

## 脅威と対策

| 脅威 | 対策 |
|------|------|
| API キー漏洩 | クライアントから除去、サーバー側のみ保持 |
| XSS によるトークン窃取 | CSP（Helmet）、`escHtml` による表示エスケープ |
| ブルートフォース | レート制限 + 長いランダムトークン |
| ディレクトリトラバーサル | HTML のみ配信（静的ディレクトリ公開なし） |
| 過大リクエスト | JSON サイズ上限、メッセージ/ドキュメント文字数上限 |
| タイミング攻撃（認証） | `crypto.timingSafeEqual` |
| エラー情報漏洩 | 本番では汎用エラーメッセージのみ返却 |

## データの場所

```
server/.env              ← 秘密（API キー、トークン、暗号化キー）
server/data/vault.enc    ← 暗号化されたドキュメント＋設定
ブラウザ sessionStorage  ← アクセストークンのみ（タブ終了で消去）
```

## ログアウト

「ログアウト」または「セッション終了」で sessionStorage のトークンを削除し、画面上のチャットをクリアします。
