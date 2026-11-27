import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { upgradeContent } from './upgrade-content.mjs';

const source = JSON.parse(await readFile(new URL('../contenido/colegio.json', import.meta.url), 'utf8'));
const actorId = '11111111-1111-4111-8111-111111111111';

function fakePool({ content = source, schemaVersion = 1, status = 'aprobado', user = true, failAudit = false } = {}) {
  const calls = [];
  let revision = { id: 'revision-base', payload: JSON.stringify(content), schema_version: schemaVersion, status };
  let pending = null;
  let version = 0;
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT id FROM admin_users')) return [user ? [{ id: actorId }] : []];
      if (sql.startsWith('SELECT id, version FROM content_documents')) return [[{ id: 'document-1', version }]];
      if (sql.includes('FROM content_publications p')) return [[revision]];
      if (sql.startsWith('INSERT INTO content_revisions')) pending = { id: params[0], payload: params[4], schema_version: params[5], status: 'borrador' };
      if (sql.startsWith('UPDATE content_documents')) version++;
      if (failAudit && sql.startsWith('INSERT INTO audit_events')) throw new Error('Fallo de auditoría');
      return [{ affectedRows: 1 }];
    },
    async commit() { calls.push('commit'); if (pending) revision = pending; pending = null; },
    async rollback() { calls.push('rollback'); pending = null; },
    release() { calls.push('release'); },
  };
  return { calls, pool: { async getConnection() { return connection; } }, get revision() { return revision; } };
}

test('completa campos faltantes sin perder ediciones y conserva la publicación', async () => {
  const old = structuredClone(source);
  old.mision = 'Misión editada por el colegio';
  old.paginas.admisiones.fechasTitulo = 'Calendario escolar';
  delete old.paginas.opiniones;
  delete old.paginas.inicio.consultaEnlace;
  const db = fakePool({ content: old, status: 'en_revision' });
  const result = await upgradeContent(db.pool, { actorId });
  assert.equal(result.updated, true);
  assert.deepEqual(result.added, ['paginas.inicio.consultaEnlace', 'paginas.opiniones']);
  assert.equal(db.revision.schema_version, 8);
  assert.equal(db.revision.status, 'borrador');
  const updated = JSON.parse(db.revision.payload);
  assert.equal(updated.mision, old.mision);
  assert.equal(updated.paginas.admisiones.fechasTitulo, 'Calendario escolar');
  assert.deepEqual(updated.paginas.opiniones, source.paginas.opiniones);
  assert.equal(db.calls.some(call => typeof call === 'object' && call.sql.startsWith('UPDATE content_publications')), false);
  assert.equal(db.calls.at(-2), 'commit');
});

test('una segunda actualización no crea otra revisión', async () => {
  const db = fakePool();
  assert.equal((await upgradeContent(db.pool, { actorId })).updated, true);
  assert.equal((await upgradeContent(db.pool, { actorId })).updated, false);
  assert.equal(db.calls.filter(call => typeof call === 'object' && call.sql.startsWith('INSERT INTO content_revisions')).length, 1);
});

test('la versión 4 incorpora textos de Contacto sin reemplazar ediciones anteriores', async () => {
  const previous = structuredClone(source);
  previous.paginas.contacto.contactoTitulo = 'Escríbanos cuando lo necesite.';
  delete previous.paginas.contacto.llamarEnlace;
  delete previous.paginas.pie.facebookEnlace;
  const db = fakePool({ content: previous, schemaVersion: 4 });
  const result = await upgradeContent(db.pool, { actorId });
  assert.deepEqual(result.added, ['paginas.contacto.llamarEnlace', 'paginas.pie.facebookEnlace']);
  const updated = JSON.parse(db.revision.payload);
  assert.equal(updated.paginas.contacto.contactoTitulo, 'Escríbanos cuando lo necesite.');
  assert.equal(updated.paginas.contacto.llamarEnlace, source.paginas.contacto.llamarEnlace);
  assert.equal(db.revision.schema_version, 8);
});

test('rechaza cuentas sin Admin, campos desconocidos y versiones futuras', async () => {
  const inactive = fakePool({ user: false });
  await assert.rejects(upgradeContent(inactive.pool, { actorId }), /Admin activa/);
  const unknown = structuredClone(source); unknown.campoInventado = 'dato';
  const bad = fakePool({ content: unknown });
  await assert.rejects(upgradeContent(bad.pool, { actorId }), /revisión manual/);
  const future = fakePool({ schemaVersion: 9 });
  await assert.rejects(upgradeContent(future.pool, { actorId }), /más reciente/);
  assert.equal(bad.calls.includes('rollback'), true);
});

test('si falla la auditoría, revierte la operación', async () => {
  const db = fakePool({ failAudit: true });
  await assert.rejects(upgradeContent(db.pool, { actorId }), /auditoría/);
  assert.equal(db.calls.includes('commit'), false);
  assert.equal(db.calls.includes('rollback'), true);
  assert.equal(db.revision.id, 'revision-base');
});
