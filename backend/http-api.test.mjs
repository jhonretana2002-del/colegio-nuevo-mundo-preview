import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminHandler, createAdminServer } from './http-api.mjs';

const origin = 'https://admin.example.test';
const csrfSecret = 'a-private-secret-with-at-least-32-characters';
const mfaKey = 'aa'.repeat(32);

async function withServer(options, run) {
  const server = createAdminServer({ pool: {}, origin, csrfSecret, mfaKey, loginGate: async () => true, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('no crea API sin límite de acceso y origen HTTPS', () => {
  assert.throws(() => createAdminHandler({ pool: {}, origin, csrfSecret, mfaKey }), /límite/);
  assert.throws(() => createAdminHandler({ pool: {}, origin: 'http://localhost', csrfSecret, mfaKey, loginGate: async () => true }), /HTTPS/);
  assert.throws(() => createAdminHandler({ pool: {}, origin, csrfSecret, loginGate: async () => true }), /MFA/);
});

test('login, CSRF y rol se obtienen de sesión, no del cuerpo', async () => {
  const calls = [];
  const token = 'a'.repeat(64);
  await withServer({ stores: {
    auth: {
      startSession: async () => ({ token, role: 'moderador', actorId: 'real-user' }),
      readSession: async () => ({ actor_id: 'real-user', role: 'moderador' }),
    },
    content: { saveDraft: async (_pool, args) => { calls.push(args); return { revisionId: 'draft-1' }; } },
  } }, async base => {
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'u@example.test', password: 'password' }) });
    assert.equal(login.status, 200);
    const { csrfToken } = await login.json();
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
    const body = JSON.stringify({ documentId: 'doc', expectedVersion: '0', content: {}, actorId: 'forged', role: 'admin' });
    const invalid = await fetch(`${base}/api/content/colegio/drafts`, { method: 'POST', headers: { origin, cookie, 'content-type': 'application/json' }, body });
    assert.equal(invalid.status, 403);
    const saved = await fetch(`${base}/api/content/colegio/drafts`, { method: 'POST', headers: { origin, cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body });
    assert.equal(saved.status, 201);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].role, 'moderador');
    assert.equal(calls[0].actorId, 'real-user');
  });
});

test('rechaza origen ajeno y límite de intentos', async () => {
  await withServer({ loginGate: async () => false }, async base => {
    const headers = { origin, 'content-type': 'application/json' };
    const body = JSON.stringify({ email: 'u@example.test', password: 'x' });
    assert.equal((await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { ...headers, origin: 'https://otro.example' }, body })).status, 403);
    assert.equal((await fetch(`${base}/api/auth/login`, { method: 'POST', headers, body })).status, 429);
  });
});

test('entrega TOTP al verificador de sesiones', async () => {
  let received;
  await withServer({ stores: { auth: { startSession: async (_pool, args) => { received = args; return null; } } } }, async base => {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.test', password: 'clave', totp: '123456' }),
    });
    assert.equal(response.status, 401);
    assert.equal(received.totp, '123456');
    assert.equal(received.mfaKey, mfaKey);
  });
});

test('solo una sesión autenticada puede leer el borrador de trabajo', async () => {
  const token = 'b'.repeat(64);
  await withServer({ stores: {
    auth: { readSession: async () => ({ actor_id: 'user-1', role: 'moderador' }) },
    content: { getWorking: async () => ({ documentId: 'doc', version: '2', content: { nombre: 'Colegio' } }) },
  } }, async base => {
    assert.equal((await fetch(`${base}/api/content/colegio/working`)).status, 401);
    const result = await fetch(`${base}/api/content/colegio/working`, { headers: { cookie: `__Host-cnm_session=${token}` } });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).version, '2');
  });
});
