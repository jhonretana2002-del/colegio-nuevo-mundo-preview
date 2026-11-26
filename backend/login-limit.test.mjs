import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoginGate } from './login-limit.mjs';

function fakePool(attempts) {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT attempts')) return [[{ attempts, expired: 0 }]];
      return [{ affectedRows: 1 }];
    },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    release() { calls.push('release'); },
  };
  return { pool: { async getConnection() { return connection; } }, calls };
}

test('cuenta intentos por correo e IP con claves anonimizadas', async () => {
  const { pool, calls } = fakePool(2);
  const gate = createLoginGate(pool, 'secret-long-enough-for-login-limits-123');
  assert.equal(await gate({ email: 'USER@example.com', ip: '127.0.0.1' }), true);
  const updates = calls.filter(call => typeof call === 'object' && call.sql.startsWith('UPDATE login_limits'));
  assert.equal(updates.length, 2);
  assert.equal(updates[0].params[0], 3);
  assert.equal(updates[0].params[2].length, 32);
  assert.deepEqual(calls.slice(-2), ['commit', 'release']);
});

test('bloquea al alcanzar el límite sin incrementar más contadores', async () => {
  const { pool, calls } = fakePool(10);
  assert.equal(await createLoginGate(pool, 'secret-long-enough-for-login-limits-123')({ email: 'u@example.com', ip: '127.0.0.1' }), false);
  assert.equal(calls.some(call => typeof call === 'object' && call.sql.startsWith('UPDATE login_limits')), false);
});
