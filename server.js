const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 7210;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const COUNTS_FILE = path.join(DATA_DIR, 'counts.json');
const VISITS_FILE = path.join(DATA_DIR, 'visits.json');
const validKeys = new Set(['only', 'ciallo']);
const TIME_ZONE = process.env.TIME_ZONE || 'Asia/Shanghai';
const MAX_DAYS_KEPT = 31;
const MAX_SEEN = 100000;
// 同一匿名 id 的冷却间隔，防止简单刷新刷量；设 0 关闭（会吞掉同 id 快速连刷）
const PV_COOLDOWN_MS = Number(process.env.PV_COOLDOWN_MS || 5000);

fs.mkdirSync(DATA_DIR, { recursive: true });

// 本地时区日期（不能用 toISOString，它是 UTC，Termux 上会跨天错位）
function localDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// YYYY-MM-DD 字符串往前推 n 天（中国无夏令时，UTC 午夜 = 本地 08:00 同日，UTC 算术安全）
function subtractDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDateString(new Date(Date.UTC(y, m - 1, d) - n * 86400000));
}

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

// 原子写盘：先写 .tmp 再 rename，读者永远看到完整旧文件或完整新文件
function atomicWrite(file, obj) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(obj, null, 2));
  fs.renameSync(temp, file);
}

function saveCounts() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => atomicWrite(COUNTS_FILE, counts), 80);
}

function readVisits() {
  try {
    const saved = JSON.parse(fs.readFileSync(VISITS_FILE, 'utf8'));
    return {
      pv: Number.isFinite(saved.pv) ? saved.pv : 0,
      uv: Number.isFinite(saved.uv) ? saved.uv : 0,
      today: typeof saved.today === 'string' ? saved.today : localDateString(),
      seenToday: saved.seenToday && typeof saved.seenToday === 'object' ? saved.seenToday : {},
      allSeen: saved.allSeen && typeof saved.allSeen === 'object' ? saved.allSeen : {},
      days: saved.days && typeof saved.days === 'object' ? saved.days : {}
    };
  } catch {
    return { pv: 0, uv: 0, today: localDateString(), seenToday: {}, allSeen: {}, days: {} };
  }
}

let visits = readVisits();
let visitsWriteTimer;
const lastVisitAt = {}; // 内存冷却表，不落盘

function saveVisits() {
  clearTimeout(visitsWriteTimer);
  visitsWriteTimer = setTimeout(() => atomicWrite(VISITS_FILE, visits), 80);
}

// 日切时重置当日去重集合、裁剪历史 days
function rollover() {
  const today = localDateString();
  if (visits.today !== today) {
    const cutoff = subtractDays(today, MAX_DAYS_KEPT);
    for (const key of Object.keys(visits.days)) {
      if (key < cutoff) delete visits.days[key];
    }
    visits.seenToday = {};
    visits.today = today;
  }
  if (!visits.days[today]) visits.days[today] = { pv: 0, uv: 0 };
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        return; // 丢弃多余数据，等到 end 再响应，避免掐断连接
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return reject(new Error('Body too large'));
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
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
  const requested = urlPath === '/' || urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath;
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
  // mefrp 等代理会转发异常请求行（如 req.url='//'），URL 解析失败会抛异常导致进程崩溃，必须兜底
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return sendJson(res, 400, { error: 'Bad request' });
  }

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

  if (url.pathname === '/api/visit' && req.method === 'POST') {
    return readBody(req, 1024)
      .then((raw) => {
        let body;
        try { body = JSON.parse(raw); } catch { return sendJson(res, 400, { error: 'Bad JSON' }); }
        const id = typeof body.id === 'string' && /^[A-Za-z0-9._-]{8,128}$/.test(body.id.trim()) ? body.id.trim() : null;
        if (!id) return sendJson(res, 400, { error: 'Bad id' });
        // path 当前仅校验不落盘，保留供将来按页面拆分统计
        let page = typeof body.path === 'string' ? body.path.trim().slice(0, 200) : '/';
        if (!page.startsWith('/') || !/^[A-Za-z0-9/._~%-]*$/.test(page)) page = '/';

        const now = Date.now();
        if (PV_COOLDOWN_MS > 0 && now - (lastVisitAt[id] || 0) < PV_COOLDOWN_MS) {
          return sendJson(res, 200, { ok: true });
        }
        lastVisitAt[id] = now;
        if (Object.keys(lastVisitAt).length > 10000) {
          const cutoff = now - 10 * 60 * 1000;
          for (const key in lastVisitAt) {
            if (lastVisitAt[key] < cutoff) delete lastVisitAt[key];
          }
        }

        rollover();
        const day = visits.days[visits.today];
        visits.pv += 1;
        day.pv += 1;
        if (!visits.seenToday[id]) {
          visits.seenToday[id] = true;
          day.uv += 1;
        }
        if (!visits.allSeen[id] && Object.keys(visits.allSeen).length < MAX_SEEN) {
          visits.allSeen[id] = true;
          visits.uv += 1;
        }
        saveVisits();
        return sendJson(res, 200, { ok: true });
      })
      .catch(() => sendJson(res, 400, { error: 'Body too large' }));
  }

  if (url.pathname === '/api/stats' && req.method === 'GET') {
    const today = localDateString();
    const [y, m, d] = today.split('-').map(Number);
    const anchor = Date.UTC(y, m - 1, d);
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const key = localDateString(new Date(anchor - i * 86400000));
      const entry = visits.days[key];
      days.push({ date: key, pv: entry ? entry.pv : 0, uv: entry ? entry.uv : 0 });
    }
    return sendJson(res, 200, { pv: visits.pv, uv: visits.uv, today, days });
  }

  if (req.method === 'GET') return serveStatic(req, res);
  sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`Sound stage is running at http://localhost:${PORT}`);
});

// 退出前清掉 debounce 尾巴，避免最后 ≤80ms 增量丢失
function flushAll() {
  clearTimeout(writeTimer);
  clearTimeout(visitsWriteTimer);
  atomicWrite(COUNTS_FILE, counts);
  atomicWrite(VISITS_FILE, visits);
}
process.on('SIGINT', () => { flushAll(); process.exit(0); });
process.on('SIGTERM', () => { flushAll(); process.exit(0); });
