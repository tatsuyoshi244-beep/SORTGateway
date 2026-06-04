/**
 * SORT Gateway v2 — Codex rebuild
 * @see AGENTS.md
 */
// ── STATE ───────────────────────────────────────────────────────────
const SESSION_TOKEN_KEY = 'sort-gateway-token';
const LEGACY_STORAGE_KEY = 'sort-gateway-v1';
const API_BASE = '';

const state = {
  documents: [],
  messages: [],
  protocol: {
    name: '汎用ビジネスモード',
    desc: '社内の文脈を踏まえた丁寧な回答を行います。',
    systemPrompt: 'あなたは会社専用のAIアシスタントです。登録された社内ドキュメントの情報を参照しながら、社員からの質問に対して正確かつ丁寧に回答してください。情報が不明な場合は正直にその旨を伝えてください。',
  },
  toggles: { sources: true, honest: true, ja: true, concise: false },
  isLoading: false,
  authenticated: false,
};

// ── SECURITY: purge legacy local storage ─────────────────────────────
function purgeLegacyStorage() {
  try {
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      console.info('[SORT] 旧バージョンの localStorage を削除しました（機密データ保護）');
    }
  } catch (_) {}
}

function getAccessToken() {
  return sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
}

function setAccessToken(token) {
  if (token) sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  else sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getAccessToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    logout(false);
    throw new Error('認証の有効期限が切れました。再ログインしてください。');
  }
  if (!res.ok) {
    throw new Error(data.error?.message || res.statusText || 'リクエストに失敗しました');
  }
  return data;
}

function showAuthGate(show) {
  document.getElementById('auth-gate').classList.toggle('hidden', !show);
  document.getElementById('btn-logout').style.display = show ? 'none' : 'inline-block';
}

async function login() {
  const token = document.getElementById('access-token-input').value.trim();
  if (!token) {
    showToast('アクセストークンを入力してください', 'error');
    return;
  }
  try {
    const res = await fetch(API_BASE + '/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error('トークンが正しくありません');
    setAccessToken(token);
    state.authenticated = true;
    document.getElementById('access-token-input').value = '';
    showAuthGate(false);
    await bootstrapApp();
    showToast('✓ ログインしました', 'success');
  } catch (err) {
    showToast(err.message || 'ログインに失敗しました', 'error');
  }
}

function logout(showToastMsg = true) {
  setAccessToken('');
  state.authenticated = false;
  state.messages = [];
  state.documents = [];
  document.getElementById('chat-messages').innerHTML = `
    <div class="chat-welcome" id="chat-welcome">
      <div class="welcome-icon">🏢</div>
      <div class="welcome-title">SORT Gateway へようこそ</div>
      <div class="welcome-sub">登録された社内ドキュメントを参照しながら、あなたの会社専用のアドバイザーとして回答します。</div>
    </div>`;
  showAuthGate(true);
  updateApiStatus('idle', '未接続');
  if (showToastMsg) showToast('セッションを終了しました');
}

async function bootstrapApp() {
  await loadDocumentsFromServer();
  await loadSettingsFromServer();
  updateApiStatus('idle', '未テスト');
}

async function loadDocumentsFromServer() {
  const data = await apiFetch('/api/documents');
  state.documents = (data.documents || []).map((d) => ({ ...d, content: '' }));
  renderDocList();
  updateSidebarDocs();
}

async function loadSettingsFromServer() {
  const data = await apiFetch('/api/settings');
  if (data.protocol) state.protocol = { ...state.protocol, ...data.protocol };
  if (data.toggles) state.toggles = { ...state.toggles, ...data.toggles };
  applySettingsToUI();
}

function applySettingsToUI() {
  document.getElementById('system-prompt').value = state.protocol.systemPrompt;
  document.getElementById('sidebar-protocol-name').textContent = state.protocol.name;
  document.getElementById('sidebar-protocol-desc').textContent = state.protocol.desc;
  setToggle('toggle-sources', state.toggles.sources);
  setToggle('toggle-honest', state.toggles.honest);
  setToggle('toggle-ja', state.toggles.ja);
  setToggle('toggle-concise', state.toggles.concise);
}

function setToggle(id, on) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('on', on);
}

function readTogglesFromUI() {
  state.toggles = {
    sources: document.getElementById('toggle-sources')?.classList.contains('on'),
    honest: document.getElementById('toggle-honest')?.classList.contains('on'),
    ja: document.getElementById('toggle-ja')?.classList.contains('on'),
    concise: document.getElementById('toggle-concise')?.classList.contains('on'),
  };
}

function updateApiStatus(mode, message) {
  const dot = document.getElementById('api-dot');
  const text = document.getElementById('api-status-text');
  dot.className = 'api-dot';
  if (mode === 'connected') {
    dot.classList.add('connected');
    text.textContent = message || '接続済み';
  } else if (mode === 'error') {
    dot.classList.add('error');
    text.textContent = message || '接続エラー';
  } else {
    text.textContent = message || (state.authenticated ? '未テスト' : '未ログイン');
  }
}

async function testApiConnection() {
  if (!state.authenticated) {
    showToast('先にログインしてください', 'error');
    return;
  }
  updateApiStatus('idle', 'テスト中...');
  try {
    await apiFetch('/api/chat/test', { method: 'POST', body: '{}' });
    updateApiStatus('connected');
    showToast('✓ AI 接続に成功しました', 'success');
  } catch (err) {
    updateApiStatus('error', '接続失敗');
    showToast('接続テスト失敗: ' + err.message, 'error');
  }
}

// ── FILE UPLOAD ──────────────────────────────────────────────────────
const UPLOAD_EXT = /\.(txt|md|csv|json)$/i;

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('dragging');
}

function handleDragLeave(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('dragging');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('dragging');
  ingestFiles(e.dataTransfer.files);
}

function handleFileSelect(e) {
  ingestFiles(e.target.files);
  e.target.value = '';
}

function ingestFiles(fileList) {
  const files = [...fileList].filter(f => UPLOAD_EXT.test(f.name));
  if (files.length === 0) {
    showToast('対応形式: .txt / .md / .csv / .json', 'error');
    return;
  }
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await registerDocument(file.name.replace(/\.[^.]+$/, ''), reader.result, guessCategory(file.name));
        showToast('✓ ' + file.name + ' を登録しました', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
    reader.onerror = () => showToast(file.name + ' の読み込みに失敗しました', 'error');
    reader.readAsText(file, 'UTF-8');
  });
}

function guessCategory(filename) {
  const n = filename.toLowerCase();
  if (/規定|ルール|policy|rule/.test(n)) return '規定・ルール';
  if (/手順|manual|guide/.test(n)) return '手順書';
  if (/顧客|client|customer/.test(n)) return '顧客情報';
  if (/製品|product|service/.test(n)) return '製品・サービス';
  if (/project|案件/.test(n)) return 'プロジェクト';
  return 'その他';
}

async function registerDocument(name, content, category) {
  const text = String(content).trim();
  if (!text) return;
  const data = await apiFetch('/api/documents', {
    method: 'POST',
    body: JSON.stringify({ name, content: text, category }),
  });
  state.documents.push({ ...data.document, content: '' });
  renderDocList();
  updateSidebarDocs();
}

// ── VIEW SWITCHING ───────────────────────────────────────────────────
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}

// ── DOCUMENT MANAGEMENT ──────────────────────────────────────────────
async function addDocument() {
  const name = document.getElementById('doc-name').value.trim();
  const content = document.getElementById('doc-content').value.trim();
  const category = document.getElementById('doc-category').value;

  if (!name) { showToast('ドキュメント名を入力してください', 'error'); return; }
  if (!content) { showToast('内容を入力してください', 'error'); return; }

  try {
    await registerDocument(name, content, category);
    clearDocForm();
    showToast('✓ ドキュメントを登録しました', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteDocument(id) {
  try {
    await apiFetch('/api/documents/' + id, { method: 'DELETE' });
    state.documents = state.documents.filter(d => d.id !== id);
    renderDocList();
    updateSidebarDocs();
    showToast('ドキュメントを削除しました');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function clearDocForm() {
  document.getElementById('doc-name').value = '';
  document.getElementById('doc-content').value = '';
  document.getElementById('doc-category').value = '規定・ルール';
}

function renderDocList() {
  const container = document.getElementById('doc-list-main');
  const badge = document.getElementById('doc-count-badge');
  badge.textContent = state.documents.length + ' 件登録済み';

  if (state.documents.length === 0) {
    container.innerHTML = `<div class="no-docs"><div class="icon">📄</div>まだドキュメントが登録されていません。<br>上のフォームから追加してください。</div>`;
    return;
  }

  container.innerHTML = state.documents.map(doc => `
    <div class="doc-row">
      <div class="doc-row-name">
        <span class="icon">📄</span>
        <div>
          <div>${escHtml(doc.name)}</div>
          <div style="font-size:11px;color:var(--text3);font-family:'DM Mono',monospace;">${doc.charCount.toLocaleString()} 文字</div>
        </div>
      </div>
      <div><span class="doc-row-tag">${escHtml(doc.category)}</span></div>
      <div class="doc-row-date">${doc.date}</div>
      <div class="doc-row-actions">
        <button class="icon-btn" onclick="deleteDocument(${doc.id})" title="削除">🗑</button>
      </div>
    </div>
  `).join('');
}

function updateSidebarDocs() {
  const container = document.getElementById('sidebar-doc-list');
  if (state.documents.length === 0) {
    container.innerHTML = `<div class="doc-empty">📂 ドキュメントがまだ登録されていません。<br>「ドキュメント」タブから追加してください。</div>`;
    return;
  }
  container.innerHTML = state.documents.map(doc => `
    <div class="doc-chip">
      <span class="doc-chip-icon">📄</span>
      <span class="doc-chip-name">${escHtml(doc.name)}</span>
      <span class="doc-chip-size">${Math.ceil(doc.charCount / 100) / 10}k</span>
    </div>
  `).join('');
}

// ── SETTINGS ─────────────────────────────────────────────────────────
function selectPreset(el, name, desc, prompt) {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  if (prompt) document.getElementById('system-prompt').value = prompt;
  state.protocol.name = name;
  state.protocol.desc = desc;
}

async function saveSettings() {
  const prompt = document.getElementById('system-prompt').value.trim();
  if (!prompt) { showToast('プロトコルを入力してください', 'error'); return; }
  state.protocol.systemPrompt = prompt;
  readTogglesFromUI();
  try {
    const data = await apiFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ protocol: state.protocol, toggles: state.toggles }),
    });
    if (data.protocol) state.protocol = data.protocol;
    if (data.toggles) state.toggles = data.toggles;
    applySettingsToUI();
    showToast('✓ 設定を保存しました', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveSettingsQuiet() {
  readTogglesFromUI();
  state.protocol.systemPrompt = document.getElementById('system-prompt').value.trim();
  await apiFetch('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ protocol: state.protocol, toggles: state.toggles }),
  });
}

function resetSettings() {
  document.getElementById('system-prompt').value = 'あなたは会社専用のAIアシスタントです。登録された社内ドキュメントの情報を参照しながら、社員からの質問に対して正確かつ丁寧に回答してください。情報が不明な場合は正直にその旨を伝えてください。';
  showToast('表示をリセットしました（保存するには「設定を保存」を押してください）');
}

// ── CHAT（履歴はメモリのみ・サーバーに永続化しない）────────────────
async function sendMessage() {
  const ta = document.getElementById('chat-textarea');
  const text = ta.value.trim();
  if (!text || state.isLoading) return;

  // Hide welcome
  const welcome = document.getElementById('chat-welcome');
  if (welcome) welcome.remove();

  ta.value = '';
  autoResize(ta);
  state.isLoading = true;
  document.getElementById('send-btn').disabled = true;

  // Add user message
  appendMessage('user', text);
  state.messages.push({ role: 'user', content: text });

  // Typing indicator
  const typingId = 'typing-' + Date.now();
  appendTyping(typingId);

  if (!state.authenticated) {
    removeTyping(typingId);
    appendMessage('assistant', '⚠️ ログインが必要です。');
    state.isLoading = false;
    document.getElementById('send-btn').disabled = false;
    return;
  }

  try {
    try { await saveSettingsQuiet(); } catch (_) { /* 設定同期失敗時もチャットは試行 */ }

    const data = await apiFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: state.messages,
      }),
    });

    removeTyping(typingId);

    const reply = data.content || '（応答がありませんでした）';
    state.messages.push({ role: 'assistant', content: reply });

    const sources = (data.sources || []).map(s => ({ name: s.name }));
    appendMessage('assistant', reply, sources);

  } catch (err) {
    removeTyping(typingId);
    appendMessage('assistant', `⚠️ エラーが発生しました：${err.message}`);
  }

  state.isLoading = false;
  document.getElementById('send-btn').disabled = false;
}

function appendMessage(role, text, sources = []) {
  const container = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;

  const avatar = role === 'user'
    ? `<div class="msg-avatar">YOU</div>`
    : `<div class="msg-avatar">🏢</div>`;

  const sourcesHtml = sources.length > 0
    ? `<div class="msg-sources">${sources.map(s =>
        `<span class="source-badge">📄 ${escHtml(s.name)}</span>`
      ).join('')}</div>`
    : '';

  msg.innerHTML = avatar + `<div class="msg-body">
    <div class="msg-bubble">${escHtml(text).replace(/\n/g, '<br>')}</div>
    ${sourcesHtml}
  </div>`;

  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function appendTyping(id) {
  const container = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = 'msg assistant';
  msg.id = id;
  msg.innerHTML = `<div class="msg-avatar">🏢</div>
    <div class="msg-body">
      <div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>
    </div>`;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function fillHint(text) {
  document.getElementById('chat-textarea').value = text;
  autoResize(document.getElementById('chat-textarea'));
  document.getElementById('chat-textarea').focus();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ── TOAST ────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const wrap = document.getElementById('toast-wrap');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── UTILS ────────────────────────────────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

purgeLegacyStorage();

(async function init() {
  if (window.location.protocol === 'file:') {
    document.querySelector('.auth-card p').innerHTML =
      '<strong style="color:var(--amber)">file:// では動作しません。</strong><br>サーバー経由で開いてください: <code>http://127.0.0.1:3001</code>';
  }
  const token = getAccessToken();
  if (token) {
    try {
      const res = await fetch(API_BASE + '/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.ok) {
        state.authenticated = true;
        showAuthGate(false);
        await bootstrapApp();
        return;
      }
    } catch (_) {}
    setAccessToken('');
  }
  showAuthGate(true);
})();
