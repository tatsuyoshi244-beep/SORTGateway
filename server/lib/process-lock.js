'use strict';

const fs = require('fs');
const path = require('path');
const { DATA_DIR, PORT, HOST } = require('./config');

const PID_FILE = path.join(DATA_DIR, 'gateway.pid');

function writePid() {
  const dir = path.dirname(PID_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    PID_FILE,
    JSON.stringify({
      pid: process.pid,
      port: PORT,
      host: HOST,
      startedAt: new Date().toISOString(),
    }),
    { mode: 0o600 }
  );
}

function removePid() {
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } catch (_) {}
}

function registerShutdown() {
  const cleanup = () => {
    removePid();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', removePid);
}

module.exports = { PID_FILE, writePid, removePid, registerShutdown };
