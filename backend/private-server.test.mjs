import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createPrivateServer, privateConfig } from './private-server.mjs';

const config = { pool: {}, origin: 'https://admin.example.test', csrfSecret: 'a'.repeat(32), mfaKey: 'b'.repeat(64), mediaRoot: path.resolve('uploads'), loginGate: async () => true };

test('servidor privado exige secretos, HTTPS y carpeta absoluta', () => {
  assert.throws(() => privateConfig({}), /Falta configuración/);
  assert.throws(() => privateConfig({ PUBLIC_ORIGIN: 'http://local', CSRF_SECRET: 'a'.repeat(32), MFA_ENCRYPTION_KEY: 'b'.repeat(64), LOGIN_LIMIT_SECRET: 'c'.repeat(32), MEDIA_ROOT: path.resolve('uploads'), PREVIEW_ROOT: path.join(tmpdir(), 'cnm-private-preview') }), /HTTPS/);
  assert.equal(privateConfig({ PUBLIC_ORIGIN: 'https://admin.example.test', CSRF_SECRET: 'a'.repeat(32), MFA_ENCRYPTION_KEY: 'b'.repeat(64), LOGIN_LIMIT_SECRET: 'c'.repeat(32), MEDIA_ROOT: path.resolve('uploads'), PREVIEW_ROOT: path.join(tmpdir(), 'cnm-private-preview'), PORT: '4899' }).port, 4899);
  assert.throws(() => privateConfig({ PUBLIC_ORIGIN: 'https://admin.example.test', CSRF_SECRET: 'a'.repeat(32), MFA_ENCRYPTION_KEY: 'b'.repeat(64), LOGIN_LIMIT_SECRET: 'c'.repeat(32), MEDIA_ROOT: path.resolve('uploads'), PREVIEW_ROOT: path.resolve('previews') }), /fuera del repositorio/);
});

test('sirve solo archivos necesarios del panel y respeta rangos de video', async () => {
  const server = createPrivateServer(config);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const admin = await fetch(`${base}/admin/`);
    assert.equal(admin.status, 200);
    assert.match(await admin.text(), /Gestión de contenidos/);
    assert.equal((await fetch(`${base}/admin/gestion.js`)).status, 200);
    assert.equal((await fetch(`${base}/lib/content-policy.mjs`)).status, 200);
    assert.equal((await fetch(`${base}/backend/.env.example`)).status, 404);
    assert.equal((await fetch(`${base}/contenido/colegio.json`)).status, 404);
    assert.equal((await fetch(`${base}/api/auth/me`)).status, 401);
    const video = await fetch(`${base}/colegio-nuevo-mundo-preview/assets/portada/portada-optimizada.mp4`, { headers: { range: 'bytes=0-15' } });
    assert.equal(video.status, 206);
    assert.equal((await video.arrayBuffer()).byteLength, 16);
    assert.match(video.headers.get('content-range'), /^bytes 0-15\//);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
