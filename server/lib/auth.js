'use strict';

const crypto = require('crypto');
const { GATEWAY_ACCESS_TOKEN } = require('./config');

let tokenBuffer = null;

function initAuth() {
  tokenBuffer = Buffer.from(GATEWAY_ACCESS_TOKEN, 'utf8');
}

function verifyToken(provided) {
  if (!provided || typeof provided !== 'string') return false;
  const buf = Buffer.from(provided, 'utf8');
  if (buf.length !== tokenBuffer.length) return false;
  return crypto.timingSafeEqual(buf, tokenBuffer);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match || !verifyToken(match[1].trim())) {
    return res.status(401).json({ error: { message: '認証に失敗しました' } });
  }
  next();
}

module.exports = { initAuth, verifyToken, requireAuth };
