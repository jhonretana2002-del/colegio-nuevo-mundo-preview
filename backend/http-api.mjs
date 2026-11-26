import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { isIP } from 'node:net';
import { startSession, readSession, revokeSession } from './auth-store.mjs';
import { getPublished, getWorking, listRevisions, saveDraft, submitWorking, approveWorking, rejectWorking, ContentError } from './content-store.mjs';
import { listMedia, openMediaPreview, uploadMedia } from './media-store.mjs';

const COOKIE = '__Host-cnm_session';
const MAX_BODY = 1024 * 1024;

function clientIp(req, trustedProxy) {
  const peer = req.socket.remoteAddress;
  const loopback = peer === '127.0.0.1' || peer === '::1' || peer === '::ffff:127.0.0.1';
  const forwarded = req.headers['x-forwarded-for'];
  if (trustedProxy && loopback && typeof forwarded === 'string' && isIP(forwarded.trim())) return forwarded.trim();
  return peer;
}

function respond(res, status, value, extra = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'",
    ...extra,
  });
  res.end(JSON.stringify(value));
}

function sessionCookie(req) {
  const part = (req.headers.cookie ?? '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`));
  const token = part?.slice(COOKIE.length + 1);
  return /^[0-9a-f]{64}$/.test(token ?? '') ? token : null;
}

function csrfToken(token, secret) {
  return createHmac('sha256', secret).update(token).digest('hex');
}

function validCsrf(req, token, secret) {
  const supplied = req.headers['x-csrf-token'];
  if (typeof supplied !== 'string' || !/^[0-9a-f]{64}$/.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(csrfToken(token, secret), 'hex'));
}

async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw new ContentError('BAD_REQUEST', 'Se requiere JSON.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new ContentError('BODY_TOO_LARGE', 'Solicitud demasiado grande.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ContentError('BAD_REQUEST', 'JSON inválido.'); }
}

export function createAdminHandler({ pool, origin, csrfSecret, mfaKey, mediaRoot, loginGate, trustedProxy = false, stores = {} }) {
  if (!pool || !origin || !/^https:\/\//.test(origin) || !csrfSecret || csrfSecret.length < 32 || !/^[0-9a-fA-F]{64}$/.test(mfaKey ?? '') || !path.isAbsolute(mediaRoot ?? '') || typeof loginGate !== 'function') {
    throw new Error('Se requiere MariaDB, origen HTTPS, secretos CSRF/MFA, almacenamiento de medios y límite de intentos de acceso.');
  }
  const auth = { startSession, readSession, revokeSession, ...stores.auth };
  const content = { getPublished, getWorking, listRevisions, saveDraft, submitWorking, approveWorking, rejectWorking, ...stores.content };
  const media = { listMedia, openMediaPreview, uploadMedia, ...stores.media };
  return async (req, res) => {
    try {
      const pathname = new URL(req.url, origin).pathname;
      const method = req.method;
      if (method === 'POST' && req.headers.origin !== origin) {
        return respond(res, 403, { error: 'Origen no permitido.' });
      }
      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJson(req);
        if (!body || typeof body !== 'object' || Array.isArray(body)) return respond(res, 400, { error: 'Solicitud inválida.' });
        const email = String(body.email ?? '').trim().toLowerCase();
        if (!(await loginGate({ email, ip: clientIp(req, trustedProxy) }))) return respond(res, 429, { error: 'Demasiados intentos. Intente más tarde.' });
        const session = await auth.startSession(pool, { email, password: body.password, totp: body.totp, mfaKey });
        if (!session) return respond(res, 401, { error: 'Credenciales inválidas o se requiere un segundo factor.' });
        return respond(res, 200, { role: session.role, csrfToken: csrfToken(session.token, csrfSecret) },
          { 'Set-Cookie': `${COOKIE}=${session.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800` });
      }
      if (!pathname.startsWith('/api/')) return respond(res, 404, { error: 'Ruta no encontrada.' });
      const token = sessionCookie(req);
      const identity = token ? await auth.readSession(pool, token) : null;
      if (!identity) return respond(res, 401, { error: 'Sesión requerida.' });
      if (method === 'GET' && pathname === '/api/auth/me') {
        return respond(res, 200, { role: identity.role, csrfToken: csrfToken(token, csrfSecret) });
      }
      if (method === 'POST' && !validCsrf(req, token, csrfSecret)) return respond(res, 403, { error: 'Token de solicitud inválido.' });
      if (method === 'POST' && pathname === '/api/auth/logout') {
        await auth.revokeSession(pool, token);
        return respond(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
      }
      if (method === 'GET' && pathname === '/api/content/colegio') {
        return respond(res, 200, await content.getPublished(pool));
      }
      if (method === 'GET' && pathname === '/api/content/colegio/working') {
        const working = await content.getWorking(pool);
        const { authorId, ...visible } = working;
        return respond(res, 200, { ...visible, canSubmit: identity.role === 'admin' || authorId === identity.actor_id });
      }
      if (method === 'GET' && pathname === '/api/content/colegio/revisions') {
        return respond(res, 200, await content.listRevisions(pool));
      }
      if (method === 'GET' && pathname === '/api/media') {
        return respond(res, 200, await media.listMedia(pool));
      }
      if (method === 'GET' && /^\/api\/media\/preview\/[0-9a-f-]{36}$/.test(pathname)) {
        const preview = await media.openMediaPreview(pool, pathname.split('/').at(-1), mediaRoot, req.headers.range);
        res.writeHead(preview.range ? 206 : 200, { 'Content-Type': preview.mimeType, 'Content-Length': preview.bytes, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'", 'Accept-Ranges': 'bytes', ...(preview.range ? { 'Content-Range': preview.range } : {}) });
        preview.stream.on('error', () => res.destroy());
        preview.stream.pipe(res);
        return;
      }
      if (method === 'POST' && pathname === '/api/media') {
        if (identity.role !== 'admin') return respond(res, 403, { error: 'Solo Admin puede agregar archivos.' });
        return respond(res, 201, await media.uploadMedia(pool, req, { actorId: identity.actor_id, role: identity.role, mediaRoot }));
      }
      if (method === 'POST' && pathname === '/api/content/colegio/drafts') {
        const body = await readJson(req);
        if (!body || typeof body !== 'object' || Array.isArray(body)) return respond(res, 400, { error: 'Solicitud inválida.' });
        const result = await content.saveDraft(pool, {
          documentId: body.documentId,
          expectedVersion: body.expectedVersion,
          content: body.content,
          comment: body.comment ?? null,
          actorId: identity.actor_id,
          role: identity.role,
        });
        return respond(res, 201, result);
      }
      if (method === 'POST' && ['/api/content/colegio/submit', '/api/content/colegio/approve', '/api/content/colegio/reject'].includes(pathname)) {
        if (pathname !== '/api/content/colegio/submit' && identity.role !== 'admin') return respond(res, 403, { error: 'Solo Admin puede decidir sobre una revisión.' });
        const body = await readJson(req);
        if (!body || typeof body !== 'object' || Array.isArray(body)) return respond(res, 400, { error: 'Solicitud inválida.' });
        const action = pathname.endsWith('/submit') ? content.submitWorking : pathname.endsWith('/approve') ? content.approveWorking : content.rejectWorking;
        return respond(res, 200, await action(pool, {
          documentId: body.documentId,
          revisionId: body.revisionId,
          expectedVersion: body.expectedVersion,
          reason: body.reason,
          actorId: identity.actor_id,
          role: identity.role,
        }));
      }
      return respond(res, 404, { error: 'Ruta no encontrada.' });
    } catch (error) {
      if (error instanceof ContentError) {
        const status = { UNAUTHORIZED: 401, FORBIDDEN_CHANGE: 403, NOT_FOUND: 404, CONFLICT: 409, BODY_TOO_LARGE: 413, INVALID_RANGE: 416 }[error.code] ?? 400;
        return respond(res, status, { error: error.message, details: error.details });
      }
      return respond(res, 500, { error: 'Error interno.' });
    }
  };
}

export function createAdminServer(options) {
  return createServer(createAdminHandler(options));
}
