import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccount, replaceMfa, resetPassword } from './account-provision.mjs';
import { decryptMfaSecret, enrollmentUri, totp } from './mfa.mjs';

const key = 'cd'.repeat(32);
const secret = Buffer.from('12345678901234567890');
const now = 100 * 30_000;
const code = totp(secret, 100);

function fakePool({ missingUser = false, failOn = null } = {}) {
  const statements = [];
  let committed = false;
  let rolledBack = false;
  const connection = {
    async beginTransaction() {},
    async execute(sql, params) {
      statements.push({ sql, params });
      if (sql.startsWith(failOn ?? '\0')) throw new Error('fallo de base');
      if (sql.startsWith('SELECT id FROM admin_users')) return [missingUser ? [] : [{ id: params[0] }]];
      return [{ affectedRows: 1 }];
    },
    async commit() { committed = true; },
    async rollback() { rolledBack = true; },
    release() {},
  };
  return { pool: { async getConnection() { return connection; } }, statements, get committed() { return committed; }, get rolledBack() { return rolledBack; } };
}

test('alta Admin exige MFA confirmado y guarda secreto cifrado, contador y auditoría', async () => {
  const db = fakePool();
  await assert.rejects(createAccount(db.pool, { email: 'a@example.org', password: 'una clave larga y privada', role: 'admin' }), /MFA/);
  await assert.rejects(createAccount(db.pool, { email: 'a@example.org', password: 'una clave larga y privada', role: 'admin', mfaSecret: secret, confirmationCode: '000000', mfaKey: key, now }), /confirmar/);
  assert.equal(db.statements.length, 0);
  const account = await createAccount(db.pool, { email: 'Admin@Example.org', password: 'una clave larga y privada', role: 'admin', mfaSecret: secret, confirmationCode: code, mfaKey: key, now });
  assert.equal(account.email, 'admin@example.org');
  assert.equal(db.committed, true);
  assert.deepEqual(decryptMfaSecret(db.statements[0].params[4], key), secret);
  assert.equal(db.statements[1].params[1], 100);
  assert.equal(db.statements[2].params[1], 'account.create');
  assert.ok(!db.statements.some(item => item.params.includes('una clave larga y privada')));
  assert.match(enrollmentUri(account.email, secret), /^otpauth:\/\/totp\//);
});

test('reemplazo MFA invalida sesiones y deja auditoría', async () => {
  const db = fakePool();
  await replaceMfa(db.pool, { userId: 'user-1', mfaSecret: secret, confirmationCode: code, mfaKey: key, now, operatorId: 'operator-1', operatorName: 'Director', reason: 'Dispositivo anterior perdido' });
  assert.equal(db.committed, true);
  assert.deepEqual(db.statements.map(item => item.sql.split(' ')[0]), ['SELECT', 'UPDATE', 'INSERT', 'UPDATE', 'INSERT']);
  assert.equal(db.statements[3].sql.includes('admin_sessions'), true);
  assert.equal(db.statements[4].params[1], 'account.mfa_replace');
  assert.deepEqual(JSON.parse(db.statements[4].params[4]), { operatorName: 'Director', reason: 'Dispositivo anterior perdido' });
});

test('fallo en auditoría revierte alta y reemplazo', async () => {
  const db = fakePool({ failOn: 'INSERT INTO audit_events' });
  await assert.rejects(createAccount(db.pool, { email: 'a@example.org', password: 'una clave larga y privada', role: 'admin', mfaSecret: secret, confirmationCode: code, mfaKey: key, now }), /fallo/);
  assert.equal(db.rolledBack, true);
  const missing = fakePool({ missingUser: true });
  await assert.rejects(replaceMfa(missing.pool, { userId: 'missing', mfaSecret: secret, confirmationCode: code, mfaKey: key, now, operatorName: 'Director', reason: 'Dispositivo anterior perdido' }), /no encontrada/);
  assert.equal(missing.rolledBack, true);
});

test('restablecimiento de contraseña revoca sesiones y exige motivo', async () => {
  const db = fakePool();
  await assert.rejects(resetPassword(db.pool, { userId: 'user-1', newPassword: 'una clave nueva y privada' }), /responsable y motivo/);
  assert.equal(db.statements.length, 0);
  await resetPassword(db.pool, { userId: 'user-1', newPassword: 'una clave nueva y privada', operatorName: 'Director', reason: 'Solicitó recuperación presencial' });
  assert.equal(db.committed, true);
  assert.equal(db.statements[2].sql.includes('admin_sessions'), true);
  assert.equal(db.statements[3].params[1], 'account.password_reset');
  assert.ok(!db.statements.some(item => item.params.includes('una clave nueva y privada')));
});
