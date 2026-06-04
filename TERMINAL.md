# SORT Gateway — ターミナル運用メモ

このファイルは **ターミナルで必要な作業** をまとめた公式メモです。  
日常の起動・停止は `gateway.ps1` を使い、詳細はここを参照してください。

---

## 前提条件

| 項目 | 要件 |
|------|------|
| OS | Windows 10/11 |
| Node.js | 18 以上（`node -v` で確認） |
| シェル | PowerShell 5.1 以上 |
| 作業ディレクトリ | `C:\Users\mmtak\Desktop\SORTGetaway`（プロジェクト直下） |

---

## 初回セットアップ（ターミナルで一度だけ）

```powershell
cd C:\Users\mmtak\Desktop\SORTGetaway

# 1) 依存関係
cd server
npm install
cd ..

# 2) .env 生成（未作成の場合）
.\gateway.ps1 setup

# 3) server\.env を編集
#    - ANTHROPIC_API_KEY  … 実際の API キー
#    - GATEWAY_ACCESS_TOKEN … ログイン用（setup 時に表示された値）
notepad server\.env
```

**PowerShell でスクリプトが拒否される場合:**

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
# または 1 回だけ:
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\manage.ps1 status
```

**npm スクリプトが使えない場合**（実行ポリシー等）も、`node` 直接実行で可:

```powershell
cd server
npm install
node scripts/setup-env.js
node index.js
```

---

## 日常コマンド（プロジェクト直下）

```powershell
cd C:\Users\mmtak\Desktop\SORTGetaway

.\gateway.ps1 status              # 状態確認（最初に実行）
.\gateway.ps1 start              # フォアグラウンド起動（Ctrl+C で停止）
.\gateway.ps1 start -Background  # バックグラウンド起動
.\gateway.ps1 stop               # 停止
.\gateway.ps1 restart            # 再起動
.\gateway.ps1 open               # ブラウザで開く
.\gateway.ps1 setup              # .env 再生成（上書き注意）
```

`gateway.ps1` は内部で `scripts\manage.ps1` を呼び出します。

---

## 起動モードの選び方

| モード | コマンド | 向いている場面 |
|--------|----------|----------------|
| フォアグラウンド | `.\gateway.ps1 start` | Cursor の専用ターミナルでログを見ながら開発 |
| バックグラウンド | `.\gateway.ps1 start -Background` | ターミナルを閉じてもサーバーを残したい |
| バッチ | `start-server.bat` | エクスプローラからダブルクリック（= start と同じ） |

バックグラウンド時のログ: `logs\gateway.log`

---

## 状態確認で見る項目

`.\gateway.ps1 status` の表示:

| 表示 | 意味 |
|------|------|
| Health: OK | http://127.0.0.1:3001/health が成功 |
| Health: DOWN | サーバー未起動または応答なし |
| Listen: PID … | ポート 3001 で待ち受け中 |
| PID: (no pid file) | 古いプロセスのみ残っている可能性 |
| Env: MISSING | `server\.env` が無い → `.\gateway.ps1 setup` |

---

## Cursor / VS Code タスク

`Ctrl+Shift+P` → **Tasks: Run Task**

| タスク名 | 内容 |
|----------|------|
| SORT: 状態確認 | `manage.ps1 status` |
| SORT: サーバー起動 | 専用ターミナルで `node index.js` |
| SORT: サーバー停止 | `manage.ps1 stop` |
| SORT: 再起動 | stop → start |
| SORT: 開発一式（起動＋ブラウザ） | 起動後にブラウザを開く |

定義ファイル: `.vscode\tasks.json`

---

## 関連ファイル（ターミナル視点）

```
SORTGetaway/
  gateway.ps1              … 入口（ここから実行）
  scripts/manage.ps1       … 起動・停止ロジック
  apps/web/                … フロント v2（Codex リビルド）
  start-server.bat         … フォアグラウンド起動
  server/
    index.js               … サーバー本体
    .env                   … 秘密情報（Git 対象外）
    data/
      vault.enc            … 暗号化ドキュメント
      gateway.pid          … 起動中 PID（JSON）
  logs/
    gateway.log            … バックグラウンド起動時のログ
```

---

## ブラウザアクセス

- URL: **http://127.0.0.1:3001**
- `file://` で HTML を開かない（認証・CORS が動かない）
- ログイントークン: `server\.env` の `GATEWAY_ACCESS_TOKEN`

```powershell
.\gateway.ps1 open
```

---

## トラブルシュート

### ポート 3001 が使用中

```powershell
.\gateway.ps1 stop
.\gateway.ps1 status
.\gateway.ps1 start
```

### サーバーは動くが Health: DOWN

- ファイアウォール・別プロセスの確認
- `.env` の `PORT` が 3001 以外なら status の URL を確認

### 終了コード 4294967295

- 以前のターミナルで動いていた `node` が **停止された** ときに出る（正常な停止のことも多い）
- `.\gateway.ps1 status` で **今** 動いているか確認し、必要なら `start` または `start -Background`

### AI 接続テスト失敗

- `server\.env` の `ANTHROPIC_API_KEY` が正しいか
- サーバー再起動: `.\gateway.ps1 restart`

### 認証エラー（401）

- ブラウザで再ログイン（トークンは sessionStorage のみ）
- `.env` の `GATEWAY_ACCESS_TOKEN` と入力値が一致するか

---

## 推奨ワークフロー（毎日）

```powershell
cd C:\Users\mmtak\Desktop\SORTGetaway
.\gateway.ps1 status
.\gateway.ps1 start          # または start -Background
.\gateway.ps1 open
# 作業後
.\gateway.ps1 stop
```

---

## セキュリティ（ターミナルで守ること）

- `server\.env` を Git にコミットしない
- トークンをチャットやスクリーンショットに載せない
- 本番以外は `HOST=127.0.0.1` のまま（LAN 公開しない）

詳細: [SECURITY.md](SECURITY.md)
