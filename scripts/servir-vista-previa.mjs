import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
};

export function createPreviewServer(directory, base) {
  if (!path.isAbsolute(directory ?? '') || !/^\/[a-zA-Z0-9/_-]*\/$/.test(base ?? '')) {
    throw new Error('Carpeta absoluta o prefijo de sitio inválido.');
  }
  const folder = path.resolve(directory);
  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end(); return; }
    if (pathname === '/' || pathname === base.slice(0, -1)) {
      res.writeHead(302, { Location: base, 'Cache-Control': 'no-store' }); res.end(); return;
    }
    if (!pathname.startsWith(base)) { res.writeHead(404); res.end(); return; }
    const relative = pathname.slice(base.length) + (pathname.endsWith('/') ? 'index.html' : '');
    const candidate = path.resolve(folder, relative);
    if (!candidate.startsWith(folder + path.sep) || !mime[path.extname(candidate)]) {
      res.writeHead(404); res.end(); return;
    }
    try {
      const file = await realpath(candidate);
      if (!file.startsWith(folder + path.sep)) throw new Error('Ruta fuera de la vista previa.');
      const info = await stat(file);
      if (!info.isFile()) throw new Error('No es archivo.');
      const headers = { 'Content-Type': mime[path.extname(file)], 'Content-Length': info.size,
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
      let start = 0; let end = info.size - 1; let status = 200;
      if (req.headers.range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
        if (!match || Number(match[1]) >= info.size) {
          res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return;
        }
        start = Number(match[1]);
        if (match[2]) end = Math.min(Number(match[2]), end);
        if (end < start) { res.writeHead(416); res.end(); return; }
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
        headers['Content-Length'] = end - start + 1;
      }
      res.writeHead(status, headers);
      if (req.method === 'HEAD') { res.end(); return; }
      createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
    } catch { res.writeHead(404); res.end(); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  const port = Number(process.argv[3] ?? 4873);
  if (!path.isAbsolute(directory ?? '') || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Uso: node scripts/servir-vista-previa.mjs RUTA_ABSOLUTA_DESTINO [PUERTO]');
  }
  if (!(await stat(directory)).isDirectory()) throw new Error('La vista previa debe ser una carpeta.');
  const source = JSON.parse(await readFile(path.join(root, 'contenido/colegio.json'), 'utf8'));
  const server = createPreviewServer(directory, source.basePath);
  server.listen(port, '127.0.0.1', () => console.log(`Vista local: http://127.0.0.1:${port}${source.basePath}`));
}
