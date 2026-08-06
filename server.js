const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 7210;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const COUNTS_FILE = path.join(DATA_DIR, 'counts.json');
const validKeys = new Set(['only', 'ciallo']);

fs.mkdirSync(DATA_DIR, { recursive: true });

function readCounts() {
  try {
    const saved = JSON.parse(fs.readFileSync(COUNTS_FILE, 'utf8'));
    return {
      only: Number.isFinite(saved.only) ? saved.only : 0,
      ciallo: Number.isFinite(saved.ciallo) ? saved.ciallo : 0,
      total: Number.isFinite(saved.total) ? saved.total : 0
    };
  } catch {
    return { only: 0, ciallo: 0, total: 0 };
  }
}

let counts = readCounts();
let writeTimer;

function saveCounts() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    const temp = `${COUNTS_FILE}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(counts, null, 2));
    fs.renameSync(temp, COUNTS_FILE);
  }, 80);
}

function sendJson(res, status, body) {
  const output = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(output)
  });
  res.end(output);
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'Forbidden' });

  fs.readFile(filePath, (error, data) => {
    if (error) return sendJson(res, error.code === 'ENOENT' ? 404 : 500, { error: 'File not found' });
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mp3': 'audio/mpeg',
      '.jpg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    const cacheControls = {
      '.html': 'no-cache',
      '.css': 'public, max-age=86400',
      '.js': 'public, max-age=86400',
      '.mp3': 'public, max-age=2592000',
      '.jpg': 'public, max-age=2592000',
      '.png': 'public, max-age=2592000',
      '.webp': 'public, max-age=2592000',
      '.svg': 'public, max-age=2592000'
    };
    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Cache-Control': cacheControls[ext] || 'public, max-age=86400'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/counts' && req.method === 'GET') {
    return sendJson(res, 200, counts);
  }

  if (url.pathname.startsWith('/api/click/') && req.method === 'POST') {
    const key = url.pathname.split('/').pop();
    if (!validKeys.has(key)) return sendJson(res, 400, { error: 'Unknown sound' });
    counts[key] += 1;
    counts.total += 1;
    saveCounts();
    return sendJson(res, 200, counts);
  }

  if (req.method === 'GET') return serveStatic(req, res);
  sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`Sound stage is running at http://localhost:${PORT}`);
});
