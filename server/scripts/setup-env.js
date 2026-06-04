'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  console.log('.env は既に存在します:', envPath);
  console.log('上書きする場合はファイルを削除してから再実行してください。');
  process.exit(0);
}

const gatewayToken = crypto.randomBytes(32).toString('hex');
const encryptionKey = crypto.randomBytes(32).toString('hex');

const template = `# SORT Gateway — 秘密情報（Git にコミットしない）
NODE_ENV=production
HOST=127.0.0.1
PORT=3001

# Anthropic API（サーバー側のみ保持）
ANTHROPIC_API_KEY=sk-ant-ここにキーを入力

# クライアント認証トークン（設定画面で入力する値と同じ）
GATEWAY_ACCESS_TOKEN=${gatewayToken}

# ドキュメント暗号化キー（64 hex = 32 バイト）
ENCRYPTION_KEY=${encryptionKey}

# CORS 許可オリジン（カンマ区切り）
ALLOWED_ORIGINS=http://127.0.0.1:3001,http://localhost:3001
`;

fs.writeFileSync(envPath, template, { mode: 0o600 });
console.log('Created:', envPath);
console.log('\n次の手順:');
console.log('  1. ANTHROPIC_API_KEY を編集');
console.log('  2. GATEWAY_ACCESS_TOKEN をアプリの「アクセストークン」にコピー');
console.log('  3. node index.js で起動\n');
console.log('GATEWAY_ACCESS_TOKEN=' + gatewayToken);
