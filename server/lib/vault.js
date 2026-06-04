'use strict';

const fs = require('fs');
const path = require('path');
const { DATA_DIR, getEncryptionKey } = require('./config');
const { encryptJson, decryptJson } = require('./crypto-util');

const VAULT_FILE = path.join(DATA_DIR, 'vault.enc');

const DEFAULT_VAULT = {
  documents: [],
  settings: {
    protocol: {
      name: '汎用ビジネスモード',
      desc: '社内の文脈を踏まえた丁寧な回答を行います。',
      systemPrompt:
        'あなたは会社専用のAIアシスタントです。登録された社内ドキュメントの情報を参照しながら、社員からの質問に対して正確かつ丁寧に回答してください。情報が不明な場合は正直にその旨を伝えてください。',
    },
    toggles: { sources: true, honest: true, ja: true, concise: false },
  },
};

let cache = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function readVault() {
  if (cache) return cache;
  ensureDataDir();
  const key = getEncryptionKey();
  if (!fs.existsSync(VAULT_FILE)) {
    cache = structuredClone(DEFAULT_VAULT);
    writeVault(cache);
    return cache;
  }
  const raw = fs.readFileSync(VAULT_FILE);
  cache = decryptJson(raw, key);
  return cache;
}

function writeVault(data) {
  ensureDataDir();
  const key = getEncryptionKey();
  const payload = encryptJson(data, key);
  const tmp = VAULT_FILE + '.tmp';
  fs.writeFileSync(tmp, payload, { mode: 0o600 });
  fs.renameSync(tmp, VAULT_FILE);
  cache = data;
}

function listDocumentsPublic() {
  const vault = readVault();
  return vault.documents.map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    date: d.date,
    charCount: d.charCount,
  }));
}

function getDocument(id) {
  const vault = readVault();
  return vault.documents.find((d) => d.id === id) || null;
}

function addDocument(doc) {
  const vault = readVault();
  vault.documents.push(doc);
  writeVault(vault);
  return doc;
}

function removeDocument(id) {
  const vault = readVault();
  vault.documents = vault.documents.filter((d) => d.id !== id);
  writeVault(vault);
}

function getSettings() {
  return readVault().settings;
}

function updateSettings(settings) {
  const vault = readVault();
  vault.settings = { ...vault.settings, ...settings };
  writeVault(vault);
  return vault.settings;
}

function getAllDocuments() {
  return readVault().documents;
}

module.exports = {
  readVault,
  writeVault,
  listDocumentsPublic,
  getDocument,
  addDocument,
  removeDocument,
  getSettings,
  updateSettings,
  getAllDocuments,
  DEFAULT_VAULT,
};
