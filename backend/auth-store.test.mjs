import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, startSession, readSession, revokeSession } from './auth-store.mjs';
import { encryptMfaSecret, totp } from './mfa.mjs';

test('contraseña usa sal única y verificación segura', async () => {
  const one = await hashPassword('una clave larga y privada');
  const two = await hashPassword('una clave larga y privada');
  assert.notEqual(one, two);
  assert.equal(await verifyPassword('una clave larga y privada', one), true);
  assert.equal(await verifyPassword('otra clave larga', one), false);
  assert.equal(await verifyPassword('x', 'hash inválido'), false);
});

test('crea sesión con token aleatorio y solo guarda el hash', async () => {
  const calls = [];
  const pool = { async execute(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT id, password_hash')) return [[{ id: 'user-1', role: 'moderador', active: 1, password_hash: storedHash, mfa_secret_encrypted: null }]];
    return [{ affectedRows: 1 }];
  } };
  const storedHash = await hashPassword('una clave larga y privada');
  const session = await startSession(pool, { email: ' USUARIO@EJEMPLO.COM ', password: 'una clave larga y privada' });
  assert.equal(session.role, 'moderador');
  assert.match(session.token, /^[0-9a-f]{64}$/);
  assert.equal(calls[0].params[0], 'usuario@ejemplo.com');
  assert.notEqual(calls[1].params[2].toString('hex'), session.token);
});

test('rechaza usuario con MFA pendiente y token mal formado', async () => {
  const hash = await hashPassword('una clave larga y privada');
  const pool = { async execute() { return [[{ id: 'user-1', active: 1, role: 'admin', password_hash: hash, mfa_secret_encrypted: Buffer.from('x') }]]; } };
  assert.equal(await startSession(pool, { email: 'admin@example.com', password: 'una clave larga y privada' }), null);
  assert.equal(await readSession(pool, 'invalid'), null);
});

test('admin requiere TOTP y no permite reutilizarlo', async () => {
  const key = 'ab'.repeat(32);
  const secret = Buffer.from('12345678901234567890');
  const hash = await hashPassword('una clave larga y privada');
  const user = { id: 'user-1', active: 1, role: 'admin', password_hash: hash, mfa_secret_encrypted: encryptMfaSecret(secret, key) };
  let lastStep = 0;
  let sessionCount = 0;
  let rollbackCount = 0;
  const connection = {
    async beginTransaction() {},
    async execute(sql, params) {
      if (sql.startsWith('SELECT last_step')) return [[{ last_step: lastStep }]];
      if (sql.startsWith('UPDATE admin_mfa_state')) lastStep = params[0];
      if (sql.startsWith('INSERT INTO admin_sessions')) sessionCount++;
      return [{ affectedRows: 1 }];
    },
    async commit() {},
    async rollback() { rollbackCount++; },
    release() {},
  };
  const pool = {
    async execute() { return [[user]]; },
    async getConnection() { return connection; },
  };
  const step = Math.floor(Date.now() / 30_000);
  const code = totp(secret, step);
  assert.equal(await startSession(pool, { email: 'admin@example.com', password: 'una clave larga y privada', mfaKey: key }), null);
  assert.equal((await startSession(pool, { email: 'admin@example.com', password: 'una clave larga y privada', totp: code, mfaKey: key })).role, 'admin');
  assert.equal(await startSession(pool, { email: 'admin@example.com', password: 'una clave larga y privada', totp: code, mfaKey: key }), null);
  assert.equal(sessionCount, 1);
  assert.equal(rollbackCount, 1);
});

test('lectura y revocación de sesión usan hash del token', async () => {
  const calls = [];
  const pool = { async execute(sql, params) { calls.push({ sql, params }); return sql.startsWith('SELECT') ? [[{ actor_id: 'user-1', role: 'admin' }]] : [{ affectedRows: 1 }]; } };
  const token = 'a'.repeat(64);
  assert.equal((await readSession(pool, token)).role, 'admin');
  await revokeSession(pool, token);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].params[0].equals(calls[1].params[0]), true);
});
