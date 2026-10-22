// server.js – OPTIONAL tiny local test server (no Vercel needed).
// Run: node server.js   then open http://localhost:3000
// It serves the static files and routes /api/xyz to api/xyz.js, just like Vercel does.
// Mock mode is on automatically unless you set YOUCAM_API_KEY (MOCK=1 forces it on).
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = { '.json': 'application/json', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
    const file = path.join(__dirname, 'api', name + '.js');
    if (!name || name.startsWith('_') || !fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
    return Promise.resolve(require(file)(req, res)).catch((e) => { console.error(e); if (!res.headersSent) { res.statusCode = 500; res.end('{"error":"Server error"}'); } });
  }
  // Only serve the public front-end files (never .env*, server.js, package.json, api/ source…).
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.join(__dirname, path.normalize(rel));
  const ok = rel === 'index.html' || /^(css|js|img)\/[\w.-]+$/.test(rel);
  if (!ok || !file.startsWith(__dirname + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log('GlowCheck running at http://localhost:' + (process.env.PORT || 3000)));
