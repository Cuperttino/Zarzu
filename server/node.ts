// Servidor Node para ejecutar fuera de Vercel (Docker, Railway, Render, local).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { route } from './router.js';

const DIST = path.resolve(process.env.DIST_DIR ?? 'dist');
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.ico': 'image/x-icon' };

const SECURITY: Record<string, string> = {
  'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-frame-options': 'DENY',
  'permissions-policy': 'geolocation=(self), camera=(), microphone=()',
};

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
  let file = path.join(DIST, decodeURIComponent(pathname));
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const ext = path.extname(file);
  const immutable = /\/assets\//.test(pathname);
  const headers: Record<string, string> = { ...SECURITY, 'content-type': MIME[ext] ?? 'application/octet-stream', 'cache-control': immutable ? 'public, max-age=31536000, immutable' : ext === '.html' || pathname === '/sw.js' ? 'no-cache' : 'public, max-age=3600' };
  const gz = /gzip/.test(String(req.headers['accept-encoding'])) && /\.(html|js|mjs|css|json|svg|webmanifest)$/.test(ext);
  if (gz) { headers['content-encoding'] = 'gzip'; res.writeHead(200, headers); fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res); return; }
  res.writeHead(200, headers); fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (!url.pathname.startsWith('/api/')) { serveStatic(req, res, url.pathname); return; }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const body = chunks.length && req.method !== 'GET' ? Buffer.concat(chunks) : undefined;
  const r = await route(new Request(url, { method: req.method, headers, body }));
  res.writeHead(r.status, { ...SECURITY, ...Object.fromEntries(r.headers) });
  if (r.body) Readable.fromWeb(r.body as never).pipe(res); else res.end();
});
const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Zarzu en http://localhost:${port}`));
