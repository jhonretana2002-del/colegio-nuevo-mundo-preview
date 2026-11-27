import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { seedContent } from './seed-content.mjs';

const source = JSON.parse(await readFile(new URL('../contenido/colegio.json', import.meta.url), 'utf8'));
const actorId = '11111111-1111-4111-8111-111111111111';

function fakePool({ user = true, existing = false, failAudit = false } = {}) {
  const calls = [];
  let committed = false;
  let rolledBack = false;
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT id FROM admin_users')) return [user ? [{ id: actorId }] : []];
      if (sql.startsWith('SELECT id FROM content_documents')) return [existing ? [{ id: 'existing-doc' }] : []];
      if (failAudit && sql.startsWith('INSERT INTO audit_events')) throw new Error('fallo de auditoría');
      return [{ affectedRows: 1 }];
    },
    async commit() { committed = true; }, async rollback() { rolledBack = true; }, release() {},
  };
  return { pool: { async getConnection() { return connection; } }, calls, get committed() { return committed; }, get rolledBack() { return rolledBack; } };
}

test('importa documento, revisión publicada y auditoría en una transacción', async () => {
  const db = fakePool();
  const result = await seedContent(db.pool, { actorId, source });
  assert.equal(result.created, true);
  assert.equal(db.committed, true);
  const inserts = db.calls.filter(call => typeof call === 'object' && call.sql.startsWith('INSERT'));
  assert.deepEqual(inserts.map(call => call.sql.match(/^INSERT INTO (\w+)/)[1]), ['content_documents', 'content_revisions', 'content_publications', 'audit_events']);
  assert.equal(JSON.parse(inserts[1].params[3]).nombre, source.nombre);
  assert.equal(inserts[1].params[4], 7);
  assert.equal(inserts[2].params[1], result.revisionId);
});

test('una segunda ejecución no reemplaza el contenido existente', async () => {
  const db = fakePool({ existing: true });
  assert.deepEqual(await seedContent(db.pool, { actorId, source }), { created: false, documentId: 'existing-doc' });
  assert.equal(db.committed, true);
  assert.equal(db.calls.some(call => typeof call === 'object' && call.sql.startsWith('INSERT')), false);
});

test('requiere Admin con MFA y revierte si falla la auditoría', async () => {
  const rejected = fakePool({ user: false });
  await assert.rejects(seedContent(rejected.pool, { actorId, source }), /Admin activa/);
  assert.equal(rejected.rolledBack, true);
  const failed = fakePool({ failAudit: true });
  await assert.rejects(seedContent(failed.pool, { actorId, source }), /auditoría/);
  assert.equal(failed.rolledBack, true);
});
