// Zero-dependency Node.js server (Node 18+): serves /public and a small JSON API
// that forwards requests to the Google Sheets backend (Apps Script web app).
const http = require('http');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function sendJson(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

/** Send one request to Google Sheets (Apps Script). fetch follows its redirect automatically. */
async function sheets(payload) {
  const r = await fetch(cfg.SHEETS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, token: cfg.SHEETS_TOKEN }),
    redirect: 'follow',
  });
  const text = await r.text();
  try { return JSON.parse(text); }
  catch { throw new HttpError(500, 'Google did not return JSON. Check SHEETS_URL and that the web app access is set to "Anyone".'); }
}

function validate(b) {
  let sku = String(b.sku ?? '').trim();
  let name = String(b.name ?? '').trim();
  let category = String(b.category ?? '').trim();
  if (!sku || !name) throw new HttpError(422, 'SKU and product name are required.');
  if (sku.length > 40 || name.length > 100 || category.length > 40) throw new HttpError(422, 'A field is too long.');
  // Block spreadsheet formula injection (cells starting with = + - @)
  const safe = v => (v && '=+-@'.includes(v[0]) ? "'" + v : v);
  sku = safe(sku); name = safe(name); category = safe(category);
  const qty = Number(b.qty ?? 0), cost = Number(b.cost ?? 0), price = Number(b.price ?? 0);
  if (!Number.isInteger(qty) || qty < 0 || !Number.isFinite(cost) || cost < 0 || !Number.isFinite(price) || price < 0)
    throw new HttpError(422, 'Quantity and prices must be zero or more.');
  return { sku, name, category, qty, cost: Math.round(cost * 100) / 100, price: Math.round(price * 100) / 100 };
}

const ERRORS = {
  DUPLICATE_SKU: [409, 'That SKU already exists.'],
  NOT_FOUND:     [404, 'That product no longer exists. Refresh the page.'],
  Unauthorized:  [500, 'Token mismatch: SHEETS_TOKEN in config.js must equal TOKEN in Code.gs.'],
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 100000) { reject(new HttpError(413, 'Request too large.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { reject(new HttpError(400, 'Invalid JSON.')); } });
    req.on('error', reject);
  });
}

async function handleApi(req, res, action) {
  if (action === 'config') return sendJson(res, 200, { currency: cfg.CURRENCY, lowStock: cfg.LOW_STOCK });
  if (action !== 'list' && req.method !== 'POST') throw new HttpError(405, 'POST required.');
  const body = req.method === 'POST' ? await readBody(req) : {};
  const id = String(body.id ?? '').trim();
  let result;

  switch (action) {
    case 'list':   result = await sheets({ action: 'list' }); break;
    case 'create': result = await sheets({ action: 'create', ...validate(body) }); break;
    case 'update':
      if (!id) throw new HttpError(422, 'Invalid id.');
      result = await sheets({ action: 'update', id, ...validate(body) }); break;
    case 'delete':
      if (!id) throw new HttpError(422, 'Invalid id.');
      result = await sheets({ action: 'delete', id }); break;
    default: throw new HttpError(404, 'Unknown action.');
  }

  if (result.error) {
    const [code, msg] = ERRORS[result.error] || [500, 'Google Sheets error: ' + result.error];
    throw new HttpError(code, msg);
  }
  sendJson(res, 200, action === 'list' ? (result.data || []) : { ok: true });
}

function serveStatic(res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) throw new HttpError(403, 'Forbidden');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname.startsWith('/api/')) await handleApi(req, res, pathname.slice(5));
    else serveStatic(res, pathname);
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    sendJson(res, e.code || 500, { error: e instanceof HttpError ? e.message : 'Server error.' });
  }
}).listen(cfg.PORT, () => {
  console.log(`Inventory app running at http://localhost:${cfg.PORT}`);
  if (cfg.SHEETS_URL.startsWith('PASTE_')) console.warn('Warning: set SHEETS_URL in config.js');
});
