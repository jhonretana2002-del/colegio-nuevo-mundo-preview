import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createAdminServer } from './http-api.mjs';

const source = JSON.parse(await readFile(new URL('../contenido/colegio.json', import.meta.url), 'utf8'));
const origin = 'https://admin.example.test';
const sessions = new Map([['a'.repeat(64), { actor_id: 'admin-1', role: 'admin' }], ['b'.repeat(64), { actor_id: 'moderador-1', role: 'moderador' }]]);

function memoryDatabase() {
  const state = { version: 0, revisionId: 'revision-inicial', content: structuredClone(source), authorId: 'admin-1', audits: [] };
  const pool = {
    async execute(sql) {
      if (sql.includes('FROM content_documents d') && sql.includes('content_working')) return [[{
        document_id: 'documento-1', version: state.version, revision_id: state.revisionId,
        payload: JSON.stringify(state.content), status: 'borrador', author_id: state.authorId,
        schema_version: 10, review_reason: null,
      }]];
      if (sql.includes('FROM content_documents d') && sql.includes('content_publications')) return [[{
        document_id: 'documento-1', version: state.version, revision_id: 'revision-inicial', payload: JSON.stringify(source),
      }]];
      throw new Error(`Consulta inesperada: ${sql}`);
    },
    async getConnection() {
      let pending;
      return {
        async beginTransaction() { pending = structuredClone(state); },
        async execute(sql, params = []) {
          if (sql.startsWith('SELECT id, version FROM content_documents')) return [[{ id: 'documento-1', version: pending.version }]];
          if (sql.includes('FROM content_publications p')) return [[{
            id: pending.revisionId, payload: JSON.stringify(pending.content), schema_version: 10,
          }]];
          if (sql.startsWith('SELECT storage_key FROM media_assets')) return [[]];
          if (sql.startsWith('INSERT INTO content_revisions')) {
            pending.revisionId = params[0]; pending.authorId = params[3]; pending.content = JSON.parse(params[4]);
            return [{ affectedRows: 1 }];
          }
          if (sql.startsWith('INSERT INTO content_working')) return [{ affectedRows: 1 }];
          if (sql.startsWith('UPDATE content_documents SET version')) { pending.version++; return [{ affectedRows: 1 }]; }
          if (sql.startsWith('INSERT INTO audit_events')) { pending.audits.push(params); return [{ affectedRows: 1 }]; }
          throw new Error(`Consulta inesperada: ${sql}`);
        },
        async commit() { Object.assign(state, pending); },
        async rollback() { pending = null; },
        release() {},
      };
    },
  };
  return { pool, state };
}

async function request(base, token, route, { method = 'GET', body, csrf } = {}) {
  const headers = { cookie: `__Host-cnm_session=${token}` };
  if (method === 'POST') {
    headers.origin = origin;
    headers['content-type'] = 'application/json';
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}

test('flujo HTTP real guarda texto de Moderador, medio de Admin y conserva la publicación', async () => {
  const { pool, state } = memoryDatabase();
  const server = createAdminServer({
    pool, origin, csrfSecret: 'a'.repeat(32), mfaKey: 'b'.repeat(64),
    mediaRoot: path.resolve('uploads'), loginGate: async () => true,
    stores: { auth: { readSession: async (_pool, token) => sessions.get(token) ?? null } },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const moderator = 'b'.repeat(64); const admin = 'a'.repeat(64);
    const csrfModerador = (await request(base, moderator, '/api/auth/me')).data.csrfToken;
    const csrfAdmin = (await request(base, admin, '/api/auth/me')).data.csrfToken;
    const initial = await request(base, moderator, '/api/content/colegio/working');
    assert.equal(initial.status, 200);
    assert.equal(initial.data.version, '0');
    const text = structuredClone(initial.data.content);
    text.mision = 'Nueva misión para revisión';
    const saved = await request(base, moderator, '/api/content/colegio/drafts', { method: 'POST', csrf: csrfModerador,
      body: { documentId: initial.data.documentId, expectedVersion: '0', content: text, role: 'admin' } });
    assert.equal(saved.status, 201);
    assert.deepEqual(saved.data.changed, ['mision']);
    const visual = structuredClone(text);
    visual.inicio.acompanamiento.imagen = 'estudiantes-480.webp';
    const denied = await request(base, moderator, '/api/content/colegio/drafts', { method: 'POST', csrf: csrfModerador,
      body: { documentId: initial.data.documentId, expectedVersion: '1', content: visual, role: 'admin' } });
    assert.equal(denied.status, 403);
    assert.equal(state.version, 1);
    const accepted = await request(base, admin, '/api/content/colegio/drafts', { method: 'POST', csrf: csrfAdmin,
      body: { documentId: initial.data.documentId, expectedVersion: '1', content: visual } });
    assert.equal(accepted.status, 201);
    assert.deepEqual(accepted.data.changed, ['inicio.acompanamiento.imagen']);
    const stale = await request(base, admin, '/api/content/colegio/drafts', { method: 'POST', csrf: csrfAdmin,
      body: { documentId: initial.data.documentId, expectedVersion: '1', content: text } });
    assert.equal(stale.status, 409);
    assert.equal(state.version, 2);
    assert.equal(state.audits.length, 2);
    const published = await request(base, moderator, '/api/content/colegio');
    assert.equal(published.data.content.mision, source.mision);
    assert.equal(published.data.content.inicio.acompanamiento.imagen, source.inicio.acompanamiento.imagen);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
