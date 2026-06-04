'use strict';

const { ALLOWED_MODELS, LIMITS } = require('./config');

function sanitizeString(str, maxLen) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLen);
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, message: 'messages が必要です' };
  }
  if (messages.length > LIMITS.maxMessages) {
    return { ok: false, message: 'メッセージ数が上限を超えています' };
  }
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) {
      return { ok: false, message: '不正なメッセージ形式です' };
    }
    if (typeof m.content !== 'string') {
      return { ok: false, message: '不正なメッセージ内容です' };
    }
    if (m.content.length > LIMITS.maxMessageChars) {
      return { ok: false, message: 'メッセージが長すぎます' };
    }
  }
  return { ok: true };
}

function validateDocument({ name, content, category }) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { ok: false, message: 'ドキュメント名が必要です' };
  }
  if (!content || typeof content !== 'string') {
    return { ok: false, message: '内容が必要です' };
  }
  if (content.length > LIMITS.maxDocumentChars) {
    return { ok: false, message: 'ドキュメントが長すぎます' };
  }
  const cat = sanitizeString(category || 'その他', 64);
  return {
    ok: true,
    data: {
      name: sanitizeString(name.trim(), 200),
      content: content.trim(),
      category: cat,
    },
  };
}

function validateSettings(body) {
  const out = {};
  if (body.protocol) {
    out.protocol = {
      name: sanitizeString(body.protocol.name || '', 100),
      desc: sanitizeString(body.protocol.desc || '', 300),
      systemPrompt: sanitizeString(body.protocol.systemPrompt || '', 8000),
    };
  }
  if (body.toggles && typeof body.toggles === 'object') {
    out.toggles = {
      sources: !!body.toggles.sources,
      honest: !!body.toggles.honest,
      ja: !!body.toggles.ja,
      concise: !!body.toggles.concise,
    };
  }
  return out;
}

function pickModel(model) {
  const m = model || 'claude-sonnet-4-20250514';
  if (!ALLOWED_MODELS.has(m)) return 'claude-sonnet-4-20250514';
  return m;
}

function clampMaxTokens(n) {
  const v = parseInt(n, 10);
  if (Number.isNaN(v) || v < 1) return 1000;
  return Math.min(v, LIMITS.maxTokens);
}

function buildSystemPrompt(settings, documents) {
  const { protocol, toggles } = settings;
  let sys = sanitizeString(protocol.systemPrompt, 8000);

  if (documents.length > 0) {
    const blocks = documents.map(
      (d) => `【${d.category}：${d.name}】\n${d.content}`
    );
    const ctx = blocks.join('\n\n');
    if (ctx.length + sys.length > LIMITS.maxSystemChars) {
      throw new Error('コンテキストが上限を超えています。ドキュメントを削減してください');
    }
    sys +=
      '\n\n---\n以下は社内に登録されたドキュメントです。回答の参考にしてください：\n\n' +
      ctx +
      '\n---';
  }

  if (toggles.honest) {
    sys += '\n\n登録ドキュメントに情報がない場合は「登録情報には該当する内容がありません」と正直に伝えてください。';
  }
  if (toggles.ja) {
    sys += '\n\n必ず日本語で回答してください。';
  }
  if (toggles.concise) {
    sys += '\n\n回答はできるだけ簡潔に、箇条書きを活用してください。';
  }

  return sys;
}

function matchSources(question, documents) {
  const q = question.toLowerCase();
  const words = q
    .replace(/[？。、！]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  return documents
    .filter((d) => {
      const combined = (d.name + d.content).toLowerCase();
      return words.some((w) => combined.includes(w));
    })
    .slice(0, 3)
    .map((d) => ({ id: d.id, name: d.name, category: d.category }));
}

module.exports = {
  sanitizeString,
  validateMessages,
  validateDocument,
  validateSettings,
  pickModel,
  clampMaxTokens,
  buildSystemPrompt,
  matchSources,
};
