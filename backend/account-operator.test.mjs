import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { withAdminOperator } from './account-operator.mjs';

test('la operación de cuentas exige Admin y revoca la sesión temporal', async () => {
  const calls = [];
  const auth = {
    async startSession(_pool, credentials) { calls.push(['login', credentials.totp]); return { role: 'admin', actorId: 'admin-1', token: 'token-1' }; },
    async revokeSession(_pool, token) { calls.push(['logout', token]); },
  };
  const result = await withAdminOperator({}, { totp: '123456' }, async actorId => { calls.push(['operation', actorId]); return 'creada'; }, auth);
  assert.equal(result, 'creada');
  assert.deepEqual(calls, [['login', '123456'], ['operation', 'admin-1'], ['logout', 'token-1']]);
});

test('Moderador no puede gestionar cuentas; un fallo también revoca la sesión', async () => {
  let used = false; let revoked = 0;
  const auth = { async startSession() { return { role: 'moderador', actorId: 'mod-1', token: 'token' }; }, async revokeSession() { revoked++; } };
  await assert.rejects(withAdminOperator({}, {}, () => { used = true; }, auth), /Solo una cuenta Admin/);
  assert.equal(used, false);
  assert.equal(revoked, 1);
  const adminAuth = { ...auth, async startSession() { return { role: 'admin', actorId: 'admin-1', token: 'token' }; } };
  await assert.rejects(withAdminOperator({}, {}, () => { throw new Error('falló la operación'); }, adminAuth), /falló/);
  assert.equal(revoked, 2);
});

test('la herramienta de cuentas rechaza una terminal no interactiva antes de abrir MariaDB', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./manage-accounts.mjs', import.meta.url)), 'crear-admin'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /terminal privada e interactiva/);
});
