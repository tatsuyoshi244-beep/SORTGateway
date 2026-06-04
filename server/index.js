'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const {
  PORT,
  HOST,
  NODE_ENV,
  ANTHROPIC_API_KEY,
  ALLOWED_ORIGINS,
  LIMITS,
  validateConfig,
  WEB_DIR,
  ROOT_DIR,
} = require('./lib/config');
const { initAuth, requireAuth, verifyToken } = require('./lib/auth');
const { writePid, registerShutdown } = require('./lib/process-lock');
const vault = require('./lib/vault');
const {
  validateMessages,
  validateDocument,
  validateSettings,
  pickModel,
  clampMaxTokens,
  buildSystemPrompt,
  matchSources,
} = require('./lib/validate');

const errors = validateConfig();
if (errors.length > 0) {
  console.error('\n[SORT Gateway] 設定エラー:\n');
  errors.forEach((e) => console.error('  -', e));
  console.error('\n  node scripts/setup-env.js を実行して .env を生成してください。\n');
  process.exit(1);
}

initAuth();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error('CORS not allowed'));
    },
    credentials: false,
  })
);

app.use(express.json({ limit: LIMITS.maxBodyBytes }));

const apiLimiter = rateLimit({
  windowMs: LIMITS.rateWindowMs,
  max: LIMITS.rateMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'リクエストが多すぎます。しばらく待ってください。' } },
});

const chatLimiter = rateLimit({
  windowMs: LIMITS.rateWindowMs,
  max: 15,
  message: { error: { message: 'チャットのリクエスト制限に達しました。' } },
});

app.use('/api', apiLimiter);

function safeError(res, status, message) {
  return res.status(status).json({ error: { message } });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, secure: true });
});

app.post('/api/auth/verify', (req, res) => {
  const token = (req.body?.token || '').trim();
  if (!verifyToken(token)) {
    return res.status(401).json({ ok: false });
  }
  res.json({ ok: true });
});

const APP_HTML = path.join(WEB_DIR, 'index.html');
const LEGACY_HTML = path.join(ROOT_DIR, 'SORT GATEWAY MVA.html');

app.use(
  '/assets',
  express.static(path.join(WEB_DIR, 'assets'), {
    index: false,
    dotfiles: 'deny',
    maxAge: NODE_ENV === 'production' ? '1h' : 0,
  })
);

app.get('/', (_req, res) => {
  if (!fs.existsSync(APP_HTML)) {
    return safeError(res, 404, 'アプリケーションが見つかりません');
  }
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(APP_HTML);
});

app.get('/legacy', (_req, res) => {
  if (!fs.existsSync(LEGACY_HTML)) {
    return safeError(res, 404, 'レガシー版が見つかりません');
  }
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(LEGACY_HTML);
});

app.use('/api', requireAuth);

app.get('/api/documents', (_req, res) => {
  res.json({ documents: vault.listDocumentsPublic() });
});

app.post('/api/documents', (req, res) => {
  const all = vault.getAllDocuments();
  if (all.length >= LIMITS.maxDocuments) {
    return safeError(res, 400, 'ドキュメント数が上限に達しています');
  }
  const check = validateDocument(req.body || {});
  if (!check.ok) return safeError(res, 400, check.message);

  const doc = {
    id: Date.now() + Math.floor(Math.random() * 10000),
    name: check.data.name,
    content: check.data.content,
    category: check.data.category,
    date: new Date().toLocaleDateString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    charCount: check.data.content.length,
  };
  vault.addDocument(doc);
  res.status(201).json({
    document: {
      id: doc.id,
      name: doc.name,
      category: doc.category,
      date: doc.date,
      charCount: doc.charCount,
    },
  });
});

app.delete('/api/documents/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return safeError(res, 400, '不正な ID です');
  const existing = vault.getDocument(id);
  if (!existing) return safeError(res, 404, 'ドキュメントが見つかりません');
  vault.removeDocument(id);
  res.json({ ok: true });
});

app.get('/api/settings', (_req, res) => {
  res.json(vault.getSettings());
});

app.put('/api/settings', (req, res) => {
  const current = vault.getSettings();
  const patch = validateSettings(req.body || {});
  const next = {
    protocol: { ...current.protocol, ...patch.protocol },
    toggles: { ...current.toggles, ...patch.toggles },
  };
  if (!next.protocol.systemPrompt?.trim()) {
    return safeError(res, 400, 'プロトコルを入力してください');
  }
  vault.updateSettings(next);
  res.json(next);
});

async function callAnthropic({ model, max_tokens, system, messages }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens, system, messages }),
  });
  const data = await response.json();
  return { status: response.status, data };
}

app.post('/api/chat/test', chatLimiter, async (_req, res) => {
  try {
    const settings = vault.getSettings();
    const { status, data } = await callAnthropic({
      model: pickModel('claude-sonnet-4-20250514'),
      max_tokens: 32,
      system: buildSystemPrompt(settings, []),
      messages: [{ role: 'user', content: 'ping' }],
    });
    if (status >= 400 || data.error) {
      return safeError(res, 502, 'AI サービスへの接続に失敗しました');
    }
    res.json({ ok: true });
  } catch {
    safeError(res, 502, 'AI サービスへの接続に失敗しました');
  }
});

app.post('/api/chat', chatLimiter, async (req, res) => {
  const msgCheck = validateMessages(req.body?.messages);
  if (!msgCheck.ok) return safeError(res, 400, msgCheck.message);

  const settings = vault.getSettings();
  const documents = vault.getAllDocuments();

  let system;
  try {
    system = buildSystemPrompt(settings, documents);
  } catch (err) {
    return safeError(res, 400, err.message);
  }

  const model = pickModel(req.body?.model);
  const max_tokens = clampMaxTokens(req.body?.max_tokens);

  try {
    const { status, data } = await callAnthropic({
      model,
      max_tokens,
      system,
      messages: req.body.messages,
    });

    if (status >= 400 || data.error) {
      if (NODE_ENV === 'development' && data.error?.message) {
        return safeError(res, 502, data.error.message);
      }
      return safeError(res, 502, 'AI サービスでエラーが発生しました');
    }

    const reply = data.content?.[0]?.text || '';
    const lastUser = [...req.body.messages].reverse().find((m) => m.role === 'user');
    const sources =
      settings.toggles.sources && lastUser
        ? matchSources(lastUser.content, documents)
        : [];

    res.json({ content: reply, sources });
  } catch {
    safeError(res, 502, 'AI サービスへの接続に失敗しました');
  }
});

app.use((err, _req, res, _next) => {
  if (err.message === 'CORS not allowed') {
    return safeError(res, 403, '許可されていないオリジンです');
  }
  safeError(res, 500, 'サーバーエラーが発生しました');
});

const server = app.listen(PORT, HOST, () => {
  writePid();
  registerShutdown();
  console.log(`SORT Gateway v2 (Codex): http://${HOST}:${PORT}`);
  console.log(`  PID:      ${process.pid}`);
  console.log('  Stop:     .\\gateway.ps1 stop  (or Ctrl+C)');
  console.log(`  バインド: ${HOST}（LAN 公開時は HOST=0.0.0.0 とファイアウォールを設定）`);
  console.log(`  データ:   暗号化 vault（server/data/vault.enc）`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[SORT] ポート ${PORT} は使用中です。`);
    console.error(`  状態確認: .\\gateway.ps1 status`);
    console.error(`  停止:     .\\gateway.ps1 stop\n`);
  } else {
    console.error('[SORT]', err.message);
  }
  process.exit(1);
});
