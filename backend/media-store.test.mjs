import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { listMedia, openMediaPreview, uploadMedia } from './media-store.mjs';
import sharp from 'sharp';

const jpeg = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#18376f' } }).jpeg().toBuffer();

function request(bytes, mime = 'image/jpeg') {
  const stream = Readable.from([bytes]);
  stream.headers = { 'content-type': mime };
  return stream;
}

function fakePool({ failAudit = false, noVariant = false } = {}) {
  const queries = [];
  let row = null;
  let variantRow = null;
  const connection = {
    async beginTransaction() {},
    async execute(sql, params) {
      queries.push({ sql, params });
      if (sql.startsWith('INSERT INTO media_assets')) row = { id: params[0], storage_key: params[2], mime_type: params[3], width: params[5], height: params[6] };
      if (sql.startsWith('INSERT INTO media_variants')) variantRow = { storage_key: params[2], mime_type: params[3], width: params[5], height: params[6] };
      if (failAudit && sql.startsWith('INSERT INTO audit_events')) throw new Error('auditoría fallida');
      return [{ affectedRows: 1 }];
    },
    async commit() {}, async rollback() { row = null; variantRow = null; }, release() {},
  };
  return { pool: { async getConnection() { return connection; }, async execute(sql) {
    if (sql.includes('FROM media_variants')) return [[noVariant ? null : variantRow].filter(Boolean)];
    if (sql.includes('WHERE id')) return [[row].filter(Boolean)];
    return [row ? [row] : []];
  } }, queries };
}

test('Admin sube imagen validada, la registra y puede previsualizarla', async () => {
  const mediaRoot = await mkdtemp(path.join(tmpdir(), 'cnm-media-'));
  try {
    const db = fakePool();
    const uploaded = await uploadMedia(db.pool, request(jpeg), { actorId: 'user-1', role: 'admin', mediaRoot });
    assert.match(uploaded.storageKey, /^uploads\/[0-9a-f-]{36}\.webp$/);
    assert.equal(uploaded.mimeType, 'image/webp');
    assert.equal(uploaded.width, 640);
    assert.equal(uploaded.height, 480);
    assert.equal(uploaded.previewUrl, `/api/media/preview/${uploaded.id}?size=small`);
    assert.ok(uploaded.bytes > 0);
    assert.equal((await listMedia(db.pool)).some(item => item.id === uploaded.id && item.storageKey === uploaded.storageKey), true);
    const preview = await openMediaPreview(db.pool, uploaded.id, mediaRoot);
    const chunks = [];
    for await (const chunk of preview.stream) chunks.push(chunk);
    const output = await readFile(path.join(mediaRoot, path.basename(uploaded.storageKey)));
    assert.deepEqual(Buffer.concat(chunks), output);
    assert.equal((await sharp(output).metadata()).format, 'webp');
    const small = await openMediaPreview(db.pool, uploaded.id, mediaRoot, null, 'small');
    const smallChunks = [];
    for await (const chunk of small.stream) smallChunks.push(chunk);
    const thumbnail = Buffer.concat(smallChunks);
    assert.equal((await sharp(thumbnail).metadata()).width, 480);
    assert.ok(thumbnail.length < output.length);
    assert.equal(db.queries.some(item => item.sql.startsWith('INSERT INTO media_variants')), true);
    const inserted = db.queries.find(item => item.sql.startsWith('INSERT INTO media_assets')).params;
    assert.deepEqual(inserted[7], createHash('sha256').update(output).digest());
    const ranged = await openMediaPreview(db.pool, uploaded.id, mediaRoot, 'bytes=0-2');
    assert.equal(ranged.range, `bytes 0-2/${output.length}`);
    const pieces = [];
    for await (const chunk of ranged.stream) pieces.push(chunk);
    assert.deepEqual(Buffer.concat(pieces), output.subarray(0, 3));
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

test('una imagen anterior sin miniatura conserva la vista previa original', async () => {
  const mediaRoot = await mkdtemp(path.join(tmpdir(), 'cnm-media-'));
  try {
    const db = fakePool({ noVariant: true });
    const uploaded = await uploadMedia(db.pool, request(jpeg), { actorId: 'user-1', role: 'admin', mediaRoot });
    const preview = await openMediaPreview(db.pool, uploaded.id, mediaRoot, null, 'small');
    const chunks = [];
    for await (const chunk of preview.stream) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), await readFile(path.join(mediaRoot, path.basename(uploaded.storageKey))));
    await assert.rejects(openMediaPreview(db.pool, uploaded.id, mediaRoot, null, 'unknown'), /no encontrado/);
  } finally { await rm(mediaRoot, { recursive: true, force: true }); }
});

test('Moderador y archivos con firma incorrecta no crean medios', async () => {
  const mediaRoot = await mkdtemp(path.join(tmpdir(), 'cnm-media-'));
  try {
    const db = fakePool();
    await assert.rejects(uploadMedia(db.pool, request(jpeg), { actorId: 'user-2', role: 'moderador', mediaRoot }), /Solo Admin/);
    await assert.rejects(uploadMedia(db.pool, request(Buffer.from('texto')), { actorId: 'user-1', role: 'admin', mediaRoot }), /formato/);
    await assert.rejects(uploadMedia(db.pool, request(Buffer.from('ffd8ff001122', 'hex')), { actorId: 'user-1', role: 'admin', mediaRoot }), /abrirse correctamente/);
    assert.deepEqual(await readdir(mediaRoot), []);
  } finally { await rm(mediaRoot, { recursive: true, force: true }); }
});

test('reduce una imagen grande y rechaza una demasiado pequeña sin dejar archivos', async () => {
  const mediaRoot = await mkdtemp(path.join(tmpdir(), 'cnm-media-'));
  try {
    const large = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#e4b553' } }).png().toBuffer();
    const result = await uploadMedia(fakePool().pool, request(large, 'image/png'), { actorId: 'user-1', role: 'admin', mediaRoot });
    assert.equal(result.width, 1600);
    assert.equal(result.height, 800);
    assert.equal(result.mimeType, 'image/webp');
    const small = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#fff' } }).png().toBuffer();
    await assert.rejects(uploadMedia(fakePool().pool, request(small, 'image/png'), { actorId: 'user-1', role: 'admin', mediaRoot }), /320 × 240/);
    assert.deepEqual((await readdir(mediaRoot)).sort(), [`${result.id}-480.webp`, path.basename(result.storageKey)].sort());
  } finally { await rm(mediaRoot, { recursive: true, force: true }); }
});

test('el archivo publicado no conserva metadatos EXIF de la imagen original', async () => {
  const mediaRoot = await mkdtemp(path.join(tmpdir(), 'cnm-media-'));
  try {
    const input = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#fff' } })
      .jpeg().withExif({ IFD0: { ImageDescription: 'Dato privado de prueba' } }).toBuffer();
    assert.ok((await sharp(input).metadata()).exif);
    const result = await uploadMedia(fakePool().pool, request(input), { actorId: 'user-1', role: 'admin', mediaRoot });
    const output = await readFile(path.join(mediaRoot, path.basename(result.storageKey)));
    assert.equal((await sharp(output).metadata()).exif, undefined);
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
