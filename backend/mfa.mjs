import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encryptionKey(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('MFA_ENCRYPTION_KEY debe contener 32 bytes en hexadecimal.');
  }
  return Buffer.from(hex, 'hex');
}

export function generateMfaSecret() {
  return randomBytes(20);
}

export function base32(secret) {
  if (!Buffer.isBuffer(secret) || secret.length === 0) throw new Error('Secreto MFA inválido.');
  let bits = 0;
  let value = 0;
  let result = '';
  for (const byte of secret) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += ALPHABET[(value >>> (bits -= 5)) & 31];
    }
  }
  if (bits > 0) result += ALPHABET[(value << (5 - bits)) & 31];
  return result;
}

export function enrollmentUri(email, secret) {
  if (typeof email !== 'string' || !email || !Buffer.isBuffer(secret) || secret.length !== 20) {
    throw new Error('Datos de inscripción MFA inválidos.');
  }
  const label = `Colegio Nuevo Mundo:${email}`;
  const params = new URLSearchParams({ secret: base32(secret), issuer: 'Colegio Nuevo Mundo', algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${encodeURIComponent(label)}?${params}`;
}

export function encryptMfaSecret(secret, keyHex) {
  if (!Buffer.isBuffer(secret) || secret.length !== 20) throw new Error('Secreto MFA inválido.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(keyHex), iv);
  const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), encrypted]);
}

export function decryptMfaSecret(encrypted, keyHex) {
  if (!Buffer.isBuffer(encrypted) || encrypted.length !== 49 || encrypted[0] !== 1) throw new Error('Secreto MFA cifrado inválido.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(keyHex), encrypted.subarray(1, 13));
  decipher.setAuthTag(encrypted.subarray(13, 29));
  return Buffer.concat([decipher.update(encrypted.subarray(29)), decipher.final()]);
}

export function totp(secret, step, digits = 6) {
  if (!Buffer.isBuffer(secret) || secret.length === 0 || !Number.isSafeInteger(step) || step < 0 || ![6, 8].includes(digits)) {
    throw new Error('Parámetros TOTP inválidos.');
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', secret).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits);
  return String(code).padStart(digits, '0');
}

export function verifyTotp(secret, code, now = Date.now(), lastStep = 0) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code) || !Number.isFinite(now) || now < 0) return null;
  const current = Math.floor(now / 30_000);
  const previous = BigInt(lastStep ?? 0);
  for (const step of [current - 1, current, current + 1]) {
    if (step < 0 || BigInt(step) <= previous) continue;
    if (timingSafeEqual(Buffer.from(code), Buffer.from(totp(secret, step)))) return step;
  }
  return null;
}
