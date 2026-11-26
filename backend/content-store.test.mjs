import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ContentError, getPublished, saveDraft } from './content-store.mjs';

const source = JSON.parse(await readFile(new URL('../contenido/colegio.json', import.meta.url), 'utf8'));

function fakeDatabase(version = 0) {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM content_documents WHERE id')) return [[{ id: 'document-1', version }]];
      if (sql.includes('FROM content_publications p')) return [[{ id: 'revision-base', payload: JSON.stringify(source) }]];
      return [{ affectedRows: 1 }];
    },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    release() { calls.push('release'); },
  };
  return { calls, pool: { async getConnection() { return connection; } } };
}

test('guarda un borrador textual y una auditoría dentro de la misma transacción', async () => {
  const { pool, calls } = fakeDatabase();
  const content = structuredClone(source);
  content.mision = 'Misión revisada y aprobable';
  const result = await saveDraft(pool, { documentId: 'document-1', actorId: 'user-1', role: 'moderador', expectedVersion: '0', content });
  assert.deepEqual(result.changed, ['mision']);
  assert.equal(result.version, '1');
  assert.ok(calls.some(call => typeof call === 'object' && call.sql.includes('INSERT INTO audit_events')));
  assert.deepEqual(calls.slice(-2), ['commit', 'release']);
});

test('rechaza medio editado por Moderador y revierte la transacción', async () => {
  const { pool, calls } = fakeDatabase();
  const content = structuredClone(source);
  content.inicio.video.archivo = 'otro.mp4';
  await assert.rejects(saveDraft(pool, { documentId: 'document-1', actorId: 'user-1', role: 'moderador', expectedVersion: '0', content }),
    error => error instanceof ContentError && error.code === 'FORBIDDEN_CHANGE');
  assert.deepEqual(calls.slice(-2), ['rollback', 'release']);
  assert.equal(calls.some(call => typeof call === 'object' && call.sql.includes('INSERT INTO content_revisions')), false);
});

test('versión obsoleta no sobrescribe otro cambio', async () => {
  const { pool, calls } = fakeDatabase(2);
  const content = structuredClone(source);
  content.mision = 'Cambio tardío';
  await assert.rejects(saveDraft(pool, { documentId: 'document-1', actorId: 'user-1', role: 'admin', expectedVersion: '1', content }),
    error => error instanceof ContentError && error.code === 'CONFLICT');
  assert.deepEqual(calls.slice(-2), ['rollback', 'release']);
});

test('lectura pública usa parámetros y devuelve el JSON', async () => {
  const pool = { async execute(sql, params) {
    assert.deepEqual(params, ['colegio', 'es-CR']);
    return [[{ document_id: 'doc', version: 1, revision_id: 'rev', payload: JSON.stringify(source) }]];
  } };
  const result = await getPublished(pool);
  assert.equal(result.content.nombre, source.nombre);
});
