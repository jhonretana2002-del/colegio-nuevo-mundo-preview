import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createDatabasePool } from './db.mjs';
import { createAdminHandler } from './http-api.mjs';
import { createLoginGate } from './login-limit.mjs';
import { getWorking } from './content-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(await readFile(new URL('../contenido/colegio.json', import.meta.url), 'utf8'));
const mediaCatalog = JSON.parse(await readFile(new URL('../contenido/medios-disponibles.json', import.meta.url), 'utf8'));
const base = source.basePath;
const staticPaths = new Set([
  'admin/index.html', 'admin/gestion.js', 'admin/gestion.css', 'admin/validacion.mjs', 'admin/field-catalog.mjs',
  'lib/content-policy.mjs', 'lib/content-shape.mjs', 'lib/media-policy.mjs',
  'fuentes.css', 'logo-240.webp',
  ...mediaCatalog,
  ...Array.from({ length: 5 }, (_, index) => `assets/fuentes/kumbhsans-latin-${index}.woff2`),
  ...Array.from({ length: 4 }, (_, index) => `assets/fuentes/notosans-latin-${index}.woff2`),
]);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };

export function privateConfig(env = process.env) {
  const required = ['PUBLIC_ORIGIN', 'CSRF_SECRET', 'MFA_ENCRYPTION_KEY', 'LOGIN_LIMIT_SECRET', 'MEDIA_ROOT'];
  const missing = required.filter(key => !env[key]);
  if (missing.length) throw new Error(`Falta configuración privada: ${missing.join(', ')}`);
  let parsedOrigin;
  try { parsedOrigin = new URL(env.PUBLIC_ORIGIN); } catch { throw new Error('PUBLIC_ORIGIN debe ser una dirección HTTPS sin ruta.'); }
  if (parsedOrigin.protocol !== 'https:' || parsedOrigin.origin !== env.PUBLIC_ORIGIN || parsedOrigin.username || parsedOrigin.password) {
    throw new Error('PUBLIC_ORIGIN debe ser una dirección HTTPS sin ruta.');
  }
  if (env.CSRF_SECRET.length < 32 || env.LOGIN_LIMIT_SECRET.length < 32 || !/^[0-9a-fA-F]{64}$/.test(env.MFA_ENCRYPTION_KEY)) throw new Error('Los secretos privados son inválidos.');
  if (!path.isAbsolute(env.MEDIA_ROOT)) throw new Error('MEDIA_ROOT debe ser una ruta absoluta.');
  const port = Number(env.PORT ?? 4874);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido.');
  return { origin: env.PUBLIC_ORIGIN, csrfSecret: env.CSRF_SECRET, mfaKey: env.MFA_ENCRYPTION_KEY, loginLimitSecret: env.LOGIN_LIMIT_SECRET, mediaRoot: env.MEDIA_ROOT, port };
}

export async function servePrivateStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/') { res.writeHead(302, { Location: source.publicUrl }); res.end(); return; }
  let relative = pathname === '/admin/' || pathname === '/admin' ? 'admin/index.html' : pathname.slice(1);
  if (pathname.startsWith(base)) relative = pathname.slice(base.length);
  if (!staticPaths.has(relative)) { res.writeHead(404, { 'Cache-Control': 'no-store' }); res.end(); return; }
  const file = path.resolve(root, ...relative.split('/'));
  if (!file.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('No es archivo.');
    const headers = { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Accept-Ranges': 'bytes' };
    const range = req.headers.range;
    let start = 0;
    let end = info.size - 1;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return; }
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : end;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= info.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return;
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file, { start, end });
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch { res.writeHead(404); res.end(); }
}

export function createPrivateServer(options) {
  const api = createAdminHandler(options);
  return createServer((req, res) => {
    if (new URL(req.url, options.origin).pathname.startsWith('/api/')) return api(req, res);
    return servePrivateStatic(req, res);
  });
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const config = privateConfig();
  const pool = await createDatabasePool();
  try {
    await pool.query('SELECT 1');
    await getWorking(pool);
    const server = createPrivateServer({ pool, origin: config.origin, csrfSecret: config.csrfSecret, mfaKey: config.mfaKey, mediaRoot: config.mediaRoot, loginGate: createLoginGate(pool, config.loginLimitSecret), trustedProxy: true });
    await new Promise((resolve, reject) => server.once('error', reject).listen(config.port, '127.0.0.1', resolve));
    console.log(`Panel privado escuchando en 127.0.0.1:${config.port}, detrás de ${config.origin}`);
    const shutdown = async () => { await new Promise(resolve => server.close(resolve)); await pool.end(); };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    await pool.end();
    throw error;
  }
}
