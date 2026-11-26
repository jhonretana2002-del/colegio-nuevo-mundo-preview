import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminHandler, createAdminServer } from './http-api.mjs';
import path from 'node:path';

const origin = 'https://admin.example.test';
const csrfSecret = 'a-private-secret-with-at-least-32-characters';
const mfaKey = 'aa'.repeat(32);
const mediaRoot = path.resolve('uploads');

async function withServer(options, run) {
  const server = createAdminServer({ pool: {}, origin, csrfSecret, mfaKey, mediaRoot, loginGate: async () => true, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('no crea API sin límite de acceso y origen HTTPS', () => {
  assert.throws(() => createAdminHandler({ pool: {}, origin, csrfSecret, mfaKey, mediaRoot }), /límite/);
  assert.throws(() => createAdminHandler({ pool: {}, origin: 'http://localhost', csrfSecret, mfaKey, mediaRoot, loginGate: async () => true }), /HTTPS/);
  assert.throws(() => createAdminHandler({ pool: {}, origin, csrfSecret, mediaRoot, loginGate: async () => true }), /MFA/);
  assert.throws(() => createAdminHandler({ pool: {}, origin, csrfSecret, mfaKey, loginGate: async () => true }), /medios/);
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

test('comparación pública del panel exige sesión y devuelve la revisión publicada', async () => {
  const token = '2'.repeat(64);
  await withServer({ stores: {
    auth: { readSession: async () => ({ actor_id: 'user-1', role: 'moderador' }) },
    content: { getPublished: async () => ({ revisionId: 'publicada', content: { nombre: 'Colegio' } }) },
  } }, async base => {
    assert.equal((await fetch(`${base}/api/content/colegio`)).status, 401);
    const response = await fetch(`${base}/api/content/colegio`, { headers: { cookie: `__Host-cnm_session=${token}` } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).revisionId, 'publicada');
  });
});

test('lectura de trabajo indica quién puede enviar a revisión sin exponer el autor', async () => {
  const token = 'e'.repeat(64);
  await withServer({ stores: {
    auth: { readSession: async () => ({ actor_id: 'other-user', role: 'moderador' }) },
    content: { getWorking: async () => ({ documentId: 'doc', revisionId: 'draft', status: 'borrador', authorId: 'author-user', content: {} }) },
  } }, async base => {
    const response = await fetch(`${base}/api/content/colegio/working`, { headers: { cookie: `__Host-cnm_session=${token}` } });
    const body = await response.json();
    assert.equal(body.canSubmit, false);
    assert.equal(body.authorId, undefined);
  });
});

test('rutas de revisión usan sesión y CSRF y no aceptan roles declarados en el cuerpo', async () => {
  const token = 'f'.repeat(64);
  const calls = [];
  await withServer({ stores: {
    auth: { readSession: async () => ({ actor_id: 'real-user', role: 'moderador' }) },
    content: {
      submitWorking: async (_pool, input) => { calls.push(['submit', input]); return { status: 'en_revision' }; },
      approveWorking: async (_pool, input) => { calls.push(['approve', input]); return { status: 'aprobado' }; },
    },
  } }, async base => {
    const cookie = `__Host-cnm_session=${token}`;
    const { csrfToken } = await (await fetch(`${base}/api/auth/me`, { headers: { cookie } })).json();
    const body = JSON.stringify({ documentId: 'doc', revisionId: 'rev', expectedVersion: '2', actorId: 'forged', role: 'admin' });
    const headers = { origin, cookie, 'content-type': 'application/json' };
    assert.equal((await fetch(`${base}/api/content/colegio/submit`, { method: 'POST', headers, body })).status, 403);
    assert.equal((await fetch(`${base}/api/content/colegio/submit`, { method: 'POST', headers: { ...headers, 'x-csrf-token': csrfToken }, body })).status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1].role, 'moderador');
    assert.equal(calls[0][1].actorId, 'real-user');
    assert.equal((await fetch(`${base}/api/content/colegio/approve`, { method: 'POST', headers: { ...headers, 'x-csrf-token': csrfToken }, body })).status, 403);
    assert.equal((await fetch(`${base}/api/content/colegio/reject`, { method: 'POST', headers: { ...headers, 'x-csrf-token': csrfToken }, body })).status, 403);
  });
});

test('Admin puede devolver una revisión y consultar historial con sesión', async () => {
  const token = '1'.repeat(64);
  let rejected;
  await withServer({ stores: {
    auth: { readSession: async () => ({ actor_id: 'admin-real', role: 'admin' }) },
    content: {
      rejectWorking: async (_pool, input) => { rejected = input; return { status: 'rechazado', reviewReason: input.reason }; },
      listRevisions: async () => [{ revisionId: 'rev', status: 'en_revision', reason: null }],
    },
  } }, async base => {
    const cookie = `__Host-cnm_session=${token}`;
    assert.equal((await fetch(`${base}/api/content/colegio/revisions`)).status, 401);
    const history = await fetch(`${base}/api/content/colegio/revisions`, { headers: { cookie } });
    assert.equal((await history.json())[0].revisionId, 'rev');
    const { csrfToken } = await (await fetch(`${base}/api/auth/me`, { headers: { cookie } })).json();
    const response = await fetch(`${base}/api/content/colegio/reject`, {
      method: 'POST', headers: { origin, cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ documentId: 'doc', revisionId: 'rev', expectedVersion: '3', reason: 'Corrija el horario', role: 'moderador' }),
    });
    assert.equal(response.status, 200);
    assert.equal(rejected.actorId, 'admin-real');
    assert.equal(rejected.role, 'admin');
    assert.equal(rejected.reason, 'Corrija el horario');
  });
});

test('la API de archivos exige sesión, CSRF y rol Admin', async () => {
  const token = 'c'.repeat(64);
  const bytes = Buffer.from('ffd8ff001122334455667788', 'hex');
  let uploads = 0;
  await withServer({ stores: {
    auth: { readSession: async () => ({ actor_id: 'user-1', role: 'moderador' }) },
    media: { uploadMedia: async () => { uploads++; return { storageKey: 'uploads/test.jpg' }; } },
  } }, async base => {
    const headers = { origin, cookie: `__Host-cnm_session=${token}`, 'content-type': 'image/jpeg' };
    assert.equal((await fetch(`${base}/api/media`, { method: 'POST', headers: { origin, 'content-type': 'image/jpeg' }, body: bytes })).status, 401);
    assert.equal((await fetch(`${base}/api/media`, { method: 'POST', headers, body: bytes })).status, 403);
    const me = await fetch(`${base}/api/auth/me`, { headers: { cookie: headers.cookie } });
    const { csrfToken } = await me.json();
    assert.equal((await fetch(`${base}/api/media`, { method: 'POST', headers: { ...headers, 'x-csrf-token': csrfToken }, body: bytes })).status, 403);
    assert.equal(uploads, 0);
  });
});

test('Admin puede enviar un archivo sin declarar identidad en el cuerpo', async () => {
  const token = 'd'.repeat(64);
  let uploadArgs;
  await withServer({ stores: {
    auth: { readSession: async () => ({ actor_id: 'admin-real', role: 'admin' }) },
    media: { uploadMedia: async (_pool, _req, args) => { uploadArgs = args; return { storageKey: 'uploads/nuevo.webp' }; } },
  } }, async base => {
    const cookie = `__Host-cnm_session=${token}`;
    const me = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
    const { csrfToken } = await me.json();
    const response = await fetch(`${base}/api/media`, { method: 'POST', headers: { origin, cookie, 'content-type': 'image/webp', 'x-csrf-token': csrfToken }, body: Buffer.from('RIFF1234WEBP') });
    assert.equal(response.status, 201);
    assert.equal(uploadArgs.actorId, 'admin-real');
    assert.equal(uploadArgs.role, 'admin');
  });
});

test('límite de acceso usa IP del proxy local solo si se configura y es válida', async () => {
  const seen = [];
  const gate = async input => { seen.push(input.ip); return true; };
  const send = base => fetch(`${base}/api/auth/login`, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.8' }, body: JSON.stringify({ email: 'a@example.org', password: 'x' }) });
  await withServer({ loginGate: gate, stores: { auth: { startSession: async () => null } } }, async base => { await send(base); });
  assert.equal(seen[0], '127.0.0.1');
  await withServer({ loginGate: gate, trustedProxy: true, stores: { auth: { startSession: async () => null } } }, async base => { await send(base); });
  assert.equal(seen[1], '198.51.100.8');
});
