import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ContentError, getPublished, getWorking, listRevisions, saveDraft, submitWorking, approveWorking, rejectWorking } from './content-store.mjs';

const source = JSON.parse(await readFile(new URL('../contenido/colegio.json', import.meta.url), 'utf8'));

function fakeDatabase(version = 0, working = source, uploaded = [], schemaVersion = 4) {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM content_documents WHERE id')) return [[{ id: 'document-1', version }]];
      if (sql.includes('FROM content_publications p')) return [[{ id: 'revision-base', payload: JSON.stringify(working), schema_version: schemaVersion }]];
      if (sql.includes('FROM media_assets')) return [uploaded.map(storage_key => ({ storage_key }))];
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
  assert.ok(calls.some(call => typeof call === 'object' && call.sql.includes('INSERT INTO content_working')));
  assert.deepEqual(calls.slice(-2), ['commit', 'release']);
});

test('un Moderador conserva cambios visuales previos de Admin al guardar texto', async () => {
  const working = structuredClone(source);
  working.inicio.acompanamiento.imagen = 'estudiantes-480.webp';
  const { pool, calls } = fakeDatabase(1, working);
  const content = structuredClone(working);
  content.mision = 'Texto del moderador';
  const result = await saveDraft(pool, { documentId: 'document-1', actorId: 'user-2', role: 'moderador', expectedVersion: '1', content });
  assert.deepEqual(result.changed, ['mision']);
  const insert = calls.find(call => typeof call === 'object' && call.sql.includes('INSERT INTO content_revisions'));
  assert.equal(insert.params[2], 'revision-base');
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

test('Admin puede reemplazar una imagen existente, pero no una ruta externa o inexistente', async () => {
  const db = fakeDatabase();
  const content = structuredClone(source);
  content.inicio.acompanamiento.imagen = 'estudiantes-480.webp';
  assert.deepEqual((await saveDraft(db.pool, { documentId: 'document-1', actorId: 'user-1', role: 'admin', expectedVersion: '0', content })).changed,
    ['inicio.acompanamiento.imagen']);
  const invalid = fakeDatabase();
  content.inicio.acompanamiento.imagen = '../archivo.webp';
  await assert.rejects(saveDraft(invalid.pool, { documentId: 'document-1', actorId: 'user-1', role: 'admin', expectedVersion: '0', content }),
    error => error instanceof ContentError && error.code === 'INVALID_MEDIA');
  assert.deepEqual(invalid.calls.slice(-2), ['rollback', 'release']);
});

test('Admin puede usar un archivo nuevo registrado en MariaDB', async () => {
  const storageKey = 'uploads/11111111-1111-4111-8111-111111111111.webp';
  const db = fakeDatabase(0, source, [storageKey]);
  const content = structuredClone(source);
  content.inicio.acompanamiento.imagen = storageKey;
  const result = await saveDraft(db.pool, { documentId: 'document-1', actorId: 'user-1', role: 'admin', expectedVersion: '0', content });
  assert.deepEqual(result.changed, ['inicio.acompanamiento.imagen']);
});

test('versión obsoleta no sobrescribe otro cambio', async () => {
  const { pool, calls } = fakeDatabase(2);
  const content = structuredClone(source);
  content.mision = 'Cambio tardío';
  await assert.rejects(saveDraft(pool, { documentId: 'document-1', actorId: 'user-1', role: 'admin', expectedVersion: '1', content }),
    error => error instanceof ContentError && error.code === 'CONFLICT');
  assert.deepEqual(calls.slice(-2), ['rollback', 'release']);
});

test('impide editar una revisión cuya estructura necesita actualización', async () => {
  const db = fakeDatabase(0, source, [], 1);
  const content = structuredClone(source);content.mision = 'Cambio nuevo';
  await assert.rejects(saveDraft(db.pool, { documentId: 'document-1', actorId: 'user-1', role: 'admin', expectedVersion: '0', content }),
    error => error instanceof ContentError && error.code === 'SCHEMA_UPDATE_REQUIRED');
  assert.equal(db.calls.some(call => typeof call === 'object' && call.sql.includes('INSERT INTO content_revisions')), false);
});

test('impide guardar si faltan campos aunque el número de esquema coincida', async () => {
  const old = structuredClone(source);delete old.paginas.opiniones;
  const db = fakeDatabase(0, old, [], 2);
  const content = structuredClone(old);content.mision = 'Cambio nuevo';
  await assert.rejects(saveDraft(db.pool, { documentId: 'document-1', actorId: 'user-1', role: 'admin', expectedVersion: '0', content }),
    error => error instanceof ContentError && error.code === 'SCHEMA_UPDATE_REQUIRED');
});

test('lectura pública usa parámetros y devuelve el JSON', async () => {
  const pool = { async execute(sql, params) {
    assert.deepEqual(params, ['colegio', 'es-CR']);
    return [[{ document_id: 'doc', version: 1, revision_id: 'rev', payload: JSON.stringify(source) }]];
  } };
  const result = await getPublished(pool);
  assert.equal(result.content.nombre, source.nombre);
});

test('lectura de trabajo devuelve revisión y versión actuales', async () => {
  const pool = { async execute(sql, params) {
    assert.ok(sql.includes('content_working'));
    assert.deepEqual(params, ['colegio', 'es-CR']);
    return [[{ document_id: 'doc', version: 3, revision_id: 'draft-3', status: 'borrador', author_id: 'user-1', schema_version: 4, review_reason: null, payload: JSON.stringify(source) }]];
  } };
  const result = await getWorking(pool);
  assert.equal(result.version, '3');
  assert.equal(result.revisionId, 'draft-3');
  assert.equal(result.status, 'borrador');
  assert.equal(result.authorId, 'user-1');
  assert.equal(result.reviewReason, null);
});

test('lectura privada pide actualización si la estructura es antigua', async () => {
  const pool = { async execute() { return [[{ document_id: 'doc', version: 1, revision_id: 'old', schema_version: 1 }]]; } };
  await assert.rejects(getWorking(pool), error => error instanceof ContentError && error.code === 'SCHEMA_UPDATE_REQUIRED');
});

test('lectura privada detecta campos faltantes en una revisión marcada como actual', async () => {
  const old = structuredClone(source);delete old.paginas.opiniones;
  const pool = { async execute() { return [[{ document_id: 'doc', version: 1, revision_id: 'old', schema_version: 4, payload: JSON.stringify(old) }]]; } };
  await assert.rejects(getWorking(pool), error => error instanceof ContentError && error.code === 'SCHEMA_UPDATE_REQUIRED');
});

test('lectura de un borrador devuelto incluye la corrección solicitada', async () => {
  const pool = { async execute(sql) {
    assert.match(sql, /content_review_decisions/);
    return [[{ document_id: 'doc', version: 4, revision_id: 'draft-4', status: 'rechazado', author_id: 'user-1', schema_version: 4, review_reason: 'Revise el costo', payload: JSON.stringify(source) }]];
  } };
  const result = await getWorking(pool);
  assert.equal(result.status, 'rechazado');
  assert.equal(result.reviewReason, 'Revise el costo');
});

test('historial limitado muestra estado, motivo y versión pública sin entregar contenido', async () => {
  const pool = { async execute(sql, params) {
    assert.match(sql, /LIMIT 20/);
    assert.deepEqual(params, ['colegio', 'es-CR']);
    return [[{ id: 'draft-2', status: 'rechazado', created_at: new Date('2026-11-26T12:00:00Z'), reason: 'Revise el horario', published_id: 'base', current_id: 'draft-2' }]];
  } };
  assert.deepEqual(await listRevisions(pool), [{ revisionId: 'draft-2', status: 'rechazado', createdAt: new Date('2026-11-26T12:00:00Z'), reason: 'Revise el horario', isPublished: false, isCurrent: true }]);
});

function reviewDatabase({ version = 2, id = 'draft-2', status = 'borrador', authorId = 'user-1', failDecision = false } = {}) {
  const calls = [];
  const revision = { id, status, author_id: authorId };
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM content_documents WHERE id')) return [[{ id: 'document-1', version }]];
      if (sql.includes('FROM content_working w')) return [[revision]];
      if (sql.includes('INSERT INTO content_review_decisions') && failDecision) throw new Error('Fallo al guardar decisión');
      if (sql.startsWith('UPDATE content_revisions')) revision.status = params[0];
      return [{ affectedRows: 1 }];
    },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); revision.status = status; },
    release() { calls.push('release'); },
  };
  return { calls, revision, pool: { async getConnection() { return connection; } } };
}

const reviewInput = { documentId: 'document-1', revisionId: 'draft-2', expectedVersion: '2', actorId: 'user-1', role: 'moderador' };

test('Moderador autor envía a revisión; Admin aprueba sin mover publicación', async () => {
  const db = reviewDatabase();
  const submitted = await submitWorking(db.pool, reviewInput);
  assert.equal(submitted.status, 'en_revision');
  assert.equal(submitted.version, '2');
  const approved = await approveWorking(db.pool, { ...reviewInput, actorId: 'admin-1', role: 'admin' });
  assert.equal(approved.status, 'aprobado');
  assert.equal(db.revision.status, 'aprobado');
  assert.equal(db.calls.filter(call => typeof call === 'object' && call.sql.includes('INSERT INTO audit_events')).length, 2);
  assert.equal(db.calls.filter(call => typeof call === 'object' && call.sql.includes('INSERT INTO content_review_decisions')).length, 1);
  assert.equal(db.calls.some(call => typeof call === 'object' && call.sql.includes('content_publications')), false);
});

test('Admin devuelve una revisión con motivo y auditoría; Moderador no puede hacerlo', async () => {
  const db = reviewDatabase({ status: 'en_revision' });
  await assert.rejects(rejectWorking(db.pool, { ...reviewInput, reason: 'Cambie el horario' }),
    error => error instanceof ContentError && error.code === 'FORBIDDEN_CHANGE');
  await assert.rejects(rejectWorking(db.pool, { ...reviewInput, actorId: 'admin-1', role: 'admin', reason: '  ' }),
    error => error instanceof ContentError && error.code === 'INVALID_COMMENT');
  const result = await rejectWorking(db.pool, { ...reviewInput, actorId: 'admin-1', role: 'admin', reason: '  Corrija el horario publicado.  ' });
  assert.equal(result.status, 'rechazado');
  assert.equal(result.reviewReason, 'Corrija el horario publicado.');
  assert.equal(db.revision.status, 'rechazado');
  const decision = db.calls.find(call => typeof call === 'object' && call.sql.includes('INSERT INTO content_review_decisions'));
  assert.deepEqual(decision.params, ['draft-2', 'document-1', 'admin-1', 'rechazado', 'Corrija el horario publicado.']);
  assert.ok(db.calls.some(call => typeof call === 'object' && call.sql.includes('INSERT INTO audit_events') && call.params[1] === 'draft.rejected'));
});

test('fallo al registrar la decisión revierte la devolución', async () => {
  const db = reviewDatabase({ status: 'en_revision', failDecision: true });
  await assert.rejects(rejectWorking(db.pool, { ...reviewInput, actorId: 'admin-1', role: 'admin', reason: 'Corrija el horario' }), /Fallo al guardar decisión/);
  assert.equal(db.revision.status, 'en_revision');
  assert.deepEqual(db.calls.slice(-2), ['rollback', 'release']);
  assert.equal(db.calls.includes('commit'), false);
});

test('un Moderador ajeno no puede enviar a revisión ni aprobar', async () => {
  const db = reviewDatabase();
  await assert.rejects(submitWorking(db.pool, { ...reviewInput, actorId: 'user-2' }),
    error => error instanceof ContentError && error.code === 'FORBIDDEN_CHANGE');
  await assert.rejects(approveWorking(db.pool, reviewInput),
    error => error instanceof ContentError && error.code === 'FORBIDDEN_CHANGE');
  assert.equal(db.revision.status, 'borrador');
  assert.equal(db.calls.some(call => typeof call === 'object' && call.sql.startsWith('UPDATE content_revisions')), false);
});

test('revisión o versión obsoletas no se aprueban', async () => {
  const staleRevision = reviewDatabase({ status: 'en_revision', id: 'draft-3' });
  await assert.rejects(approveWorking(staleRevision.pool, { ...reviewInput, actorId: 'admin-1', role: 'admin' }),
    error => error instanceof ContentError && error.code === 'CONFLICT');
  const staleVersion = reviewDatabase({ status: 'en_revision', version: 3 });
  await assert.rejects(approveWorking(staleVersion.pool, { ...reviewInput, actorId: 'admin-1', role: 'admin' }),
    error => error instanceof ContentError && error.code === 'CONFLICT');
  assert.equal(staleRevision.revision.status, 'en_revision');
  assert.equal(staleVersion.revision.status, 'en_revision');
});
