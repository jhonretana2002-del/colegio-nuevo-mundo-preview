import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listMedia, openMediaPreview, uploadMedia } from './media-store.mjs';

const jpeg = Buffer.from('ffd8ff001122334455667788', 'hex');

function request(bytes, mime = 'image/jpeg') {
  const stream = Readable.from([bytes]);
  stream.headers = { 'content-type': mime };
  return stream;
}

function fakePool({ failAudit = false } = {}) {
  const queries = [];
  let row = null;
  const connection = {
    async beginTransaction() {},
    async execute(sql, params) {
      queries.push({ sql, params });
      if (sql.startsWith('INSERT INTO media_assets')) row = { id: params[0], storage_key: params[2], mime_type: params[3] };
      if (failAudit && sql.startsWith('INSERT INTO audit_events')) throw new Error('auditoría fallida');
      return [{ affectedRows: 1 }];
    },
    async commit() {}, async rollback() { row = null; }, release() {},
  };
  return { pool: { async getConnection() { return connection; }, async execute(sql) {
    if (sql.includes('WHERE id')) return [[row].filter(Boolean)];
    return [row ? [row] : []];
  } }, queries };
}

test('Admin sube imagen validada, la registra y puede previsualizarla', async () => {
  const mediaRoot = await mkdtemp(path.join(tmpdir(), 'cnm-media-'));
  try {
    const db = fakePool();
    const uploaded = await uploadMedia(db.pool, request(jpeg), { actorId: 'user-1', role: 'admin', mediaRoot });
    assert.match(uploaded.storageKey, /^uploads\/[0-9a-f-]{36}\.jpg$/);
    assert.equal(uploaded.bytes, jpeg.length);
    assert.equal((await listMedia(db.pool)).some(item => item.id === uploaded.id && item.storageKey === uploaded.storageKey), true);
    const preview = await openMediaPreview(db.pool, uploaded.id, mediaRoot);
    const chunks = [];
    for await (const chunk of preview.stream) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), jpeg);
    const ranged = await openMediaPreview(db.pool, uploaded.id, mediaRoot, 'bytes=0-2');
    assert.equal(ranged.range, `bytes 0-2/${jpeg.length}`);
    const pieces = [];
    for await (const chunk of ranged.stream) pieces.push(chunk);
    assert.deepEqual(Buffer.concat(pieces), jpeg.subarray(0, 3));
    assert.equal(db.queries.some(item => item.sql.includes('audit_events')), true);
  } finally { await rm(mediaRoot, { recursive: true, force: true }); }
});

test('Admin puede registrar un video MP4 con su tipo correcto', async () => {
  const mediaRoot = await mkdtemp(path.join(tmpdir(), 'cnm-media-'));
  try {
    const mp4 = Buffer.from('000000186674797069736f6d00000000', 'hex');
    const result = await uploadMedia(fakePool().pool, request(mp4, 'video/mp4'), { actorId: 'user-1', role: 'admin', mediaRoot });
    assert.equal(result.mimeType, 'video/mp4');
    assert.match(result.storageKey, /\.mp4$/);
  } finally { await rm(mediaRoot, { recursive: true, force: true }); }
});

test('Moderador y archivos con firma incorrecta no crean medios', async () => {
  const mediaRoot = await mkdtemp(path.join(tmpdir(), 'cnm-media-'));
  try {
    const db = fakePool();
    await assert.rejects(uploadMedia(db.pool, request(jpeg), { actorId: 'user-2', role: 'moderador', mediaRoot }), /Solo Admin/);
    await assert.rejects(uploadMedia(db.pool, request(Buffer.from('texto')), { actorId: 'user-1', role: 'admin', mediaRoot }), /formato/);
    assert.deepEqual(await readdir(mediaRoot), []);
  } finally { await rm(mediaRoot, { recursive: true, force: true }); }
});

test('fallo de base elimina el archivo y revierte la operación', async () => {
  const mediaRoot = await mkdtemp(path.join(tmpdir(), 'cnm-media-'));
  try {
    const db = fakePool({ failAudit: true });
    await assert.rejects(uploadMedia(db.pool, request(jpeg), { actorId: 'user-1', role: 'admin', mediaRoot }), /auditoría/);
    assert.deepEqual(await readdir(mediaRoot), []);
  } finally { await rm(mediaRoot, { recursive: true, force: true }); }
});

test('rechaza imagen mayor al límite y limpia la carga parcial', async () => {
  const mediaRoot = await mkdtemp(path.join(tmpdir(), 'cnm-media-'));
  try {
    const bytes = Buffer.concat([jpeg, Buffer.alloc(12 * 1024 * 1024)]);
    await assert.rejects(uploadMedia(fakePool().pool, request(bytes), { actorId: 'user-1', role: 'admin', mediaRoot }), /tamaño permitido/);
    assert.deepEqual(await readdir(mediaRoot), []);
  } finally { await rm(mediaRoot, { recursive: true, force: true }); }
});
