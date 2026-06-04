'use strict';

const crypto = require('crypto');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '127.0.0.1';
const NODE_ENV = process.env.NODE_ENV || 'development';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GATEWAY_ACCESS_TOKEN = process.env.GATEWAY_ACCESS_TOKEN || '';
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY || '';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:3001,http://localhost:3001')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
]);

const LIMITS = {
  maxBodyBytes: 512 * 1024,
  maxDocumentChars: 200_000,
  maxDocuments: 100,
  maxMessageChars: 16_000,
  maxMessages: 40,
  maxSystemChars: 400_000,
  maxTokens: 4096,
  rateWindowMs: 60_000,
  rateMaxRequests: 30,
};

function getEncryptionKey() {
  if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY_HEX)) {
    return null;
  }
  return Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
}

function validateConfig() {
  const errors = [];
  if (!ANTHROPIC_API_KEY) {
    errors.push('ANTHROPIC_API_KEY が未設定です（server/.env を作成してください）');
  }
  if (!GATEWAY_ACCESS_TOKEN || GATEWAY_ACCESS_TOKEN.length < 24) {
    errors.push('GATEWAY_ACCESS_TOKEN は 24 文字以上で設定してください');
  }
  if (!getEncryptionKey()) {
    errors.push('ENCRYPTION_KEY は 64 文字の hex（32 バイト）で設定してください');
  }
  return errors;
}

function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = {
  PORT,
  HOST,
  NODE_ENV,
  ANTHROPIC_API_KEY,
  GATEWAY_ACCESS_TOKEN,
  ALLOWED_ORIGINS,
  ALLOWED_MODELS,
  LIMITS,
  getEncryptionKey,
  validateConfig,
  generateToken,
  DATA_DIR: path.join(__dirname, '..', 'data'),
  WEB_DIR: path.join(__dirname, '..', '..', 'apps', 'web'),
  ROOT_DIR: path.join(__dirname, '..', '..'),
};
