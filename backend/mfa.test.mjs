import test from 'node:test';
import assert from 'node:assert/strict';
import { base32, decryptMfaSecret, encryptMfaSecret, generateMfaSecret, totp, verifyTotp } from './mfa.mjs';

const key = 'a1'.repeat(32);

test('TOTP coincide con el vector RFC 6238 y protege contra repetición', () => {
  const secret = Buffer.from('12345678901234567890');
  assert.equal(totp(secret, 1, 8), '94287082');
  const code = totp(secret, 100);
  assert.equal(verifyTotp(secret, code, 100 * 30_000, 99), 100);
  assert.equal(verifyTotp(secret, code, 100 * 30_000, 100), null);
  assert.equal(verifyTotp(secret, '12345x', 100 * 30_000, 99), null);
});

test('secreto MFA aleatorio y cifrado autenticado', () => {
  const secret = generateMfaSecret();
  assert.equal(secret.length, 20);
  assert.equal(base32(Buffer.from('foo')), 'MZXW6');
  const encrypted = encryptMfaSecret(secret, key);
  assert.notDeepEqual(encrypted, secret);
  assert.deepEqual(decryptMfaSecret(encrypted, key), secret);
  assert.throws(() => decryptMfaSecret(encrypted, 'b2'.repeat(32)));
  assert.throws(() => encryptMfaSecret(secret, 'bad'), /MFA_ENCRYPTION_KEY/);
});
