import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { stagePreview } from './stage-preview.mjs';
import { createPreviewServer } from '../scripts/servir-vista-previa.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generated = ['index.html', '404.html', 'institucional-datos.js', 'conocenos/index.html', 'oferta-educativa/index.html', 'vida-en-el-colegio/index.html', 'admisiones/index.html', 'contacto/index.html', 'noticias/index.html'];
const source = JSON.parse(await readFile(path.join(root, 'contenido/colegio.json'), 'utf8'));

async function workspace(t) {
  const folder = await mkdtemp(path.join(tmpdir(), 'cnm-preview-'));
  t.after(async () => {
    if (folder.startsWith(path.resolve(tmpdir()) + path.sep)) await rm(folder, { recursive: true, force: true });
  });
  return folder;
}

test('la vista previa actual conserva el contenido de todos los archivos generados', async t => {
  const folder = await workspace(t);
  const outputRoot = path.join(folder, 'preview');
  await stagePreview({ content: source, outputRoot });
  for (const file of generated) {
    const actual = (await readFile(path.join(outputRoot, file), 'utf8')).replaceAll('\r\n', '\n');
    const expected = (await readFile(path.join(root, file), 'utf8')).replaceAll('\r\n', '\n');
    assert.equal(actual, expected, file);
  }
  assert.ok((await readFile(path.join(outputRoot, 'assets/portada/portada-poster.jpg'))).length > 0);
  await assert.rejects(stagePreview({ content: source, outputRoot }), /ya existe/);
});

test('los cambios de texto solo aparecen en la salida aislada', async t => {
  const folder = await workspace(t);
  const outputRoot = path.join(folder, 'preview');
  const changed = structuredClone(source);
  changed.presentacion += ' Revisión de prueba.';
  const current = await readFile(path.join(root, 'index.html'));
  await stagePreview({ content: changed, outputRoot });
  assert.match(await readFile(path.join(outputRoot, 'index.html'), 'utf8'), /Revisión de prueba/);
  assert.deepEqual(await readFile(path.join(root, 'index.html')), current);
});

test('copia un medio aprobado y verifica su hash antes de generar', async t => {
  const folder = await workspace(t);
  const mediaRoot = path.join(folder, 'media');
  await mkdir(mediaRoot);
  const name = '11111111-1111-4111-8111-111111111111.webp';
  const key = `uploads/${name}`;
  const bytes = await readFile(path.join(root, source.inicio.acompanamiento.imagen));
  await writeFile(path.join(mediaRoot, name), bytes);
  const changed = structuredClone(source);
  changed.inicio.acompanamiento.imagen = key;
  const mediaRecords = [{ storage_key: key, checksum_sha256: createHash('sha256').update(bytes).digest() }];
  const outputRoot = path.join(folder, 'preview');
  const result = await stagePreview({ content: changed, outputRoot, mediaRoot, mediaRecords });
  assert.equal(result.uploadedMedia, 1);
  assert.deepEqual(await readFile(path.join(outputRoot, key)), bytes);
  assert.match(await readFile(path.join(outputRoot, 'index.html'), 'utf8'), /uploads\/11111111/);
  const badOutput = path.join(folder, 'bad');
  await assert.rejects(stagePreview({ content: changed, outputRoot: badOutput, mediaRoot, mediaRecords: [{ storage_key: key, checksum_sha256: Buffer.alloc(32) }] }), /no coincide/);
  await assert.rejects(access(badOutput), { code: 'ENOENT' });
});

test('la vista previa local sirve páginas y recursos solo bajo el prefijo del sitio', async t => {
  const folder = await workspace(t);
  const outputRoot = path.join(folder, 'preview');
  await stagePreview({ content: source, outputRoot });
  const server = createPreviewServer(outputRoot, source.basePath);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(origin + source.basePath);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Colegio Nuevo Mundo/);
  const style = await fetch(origin + source.basePath + 'portada.css');
  assert.equal(style.status, 200);
  assert.match(style.headers.get('content-type'), /text\/css/);
  const media = await fetch(origin + source.basePath + source.inicio.video.archivo, { headers: { Range: 'bytes=0-3' } });
  assert.equal(media.status, 206);
  assert.equal((await media.arrayBuffer()).byteLength, 4);
  assert.equal((await fetch(origin + '/admin/')).status, 404);
  assert.equal((await fetch(origin + source.basePath + '.env')).status, 404);
});
