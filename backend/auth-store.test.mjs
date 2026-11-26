import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, startSession, readSession, revokeSession } from './auth-store.mjs';

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

test('lectura y revocación de sesión usan hash del token', async () => {
  const calls = [];
  const pool = { async execute(sql, params) { calls.push({ sql, params }); return sql.startsWith('SELECT') ? [[{ actor_id: 'user-1', role: 'admin' }]] : [{ affectedRows: 1 }]; } };
  const token = 'a'.repeat(64);
  assert.equal((await readSession(pool, token)).role, 'admin');
  await revokeSession(pool, token);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].params[0].equals(calls[1].params[0]), true);
});
