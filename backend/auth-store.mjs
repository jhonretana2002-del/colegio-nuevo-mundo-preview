import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { decryptMfaSecret, verifyTotp } from './mfa.mjs';

const scrypt = promisify(scryptCallback);
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DUMMY_HASH = `scrypt$16384$8$1$${'00'.repeat(16)}$${'00'.repeat(64)}`;

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024) {
    throw new Error('La contraseña debe tener entre 12 y 1024 caracteres.');
  }
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, SCRYPT_OPTIONS);
  return `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 1024 || typeof encoded !== 'string') return false;
  const match = /^scrypt\$16384\$8\$1\$([0-9a-f]{32})\$([0-9a-f]{128})$/.exec(encoded);
  if (!match) return false;
  const expected = Buffer.from(match[2], 'hex');
  const actual = await scrypt(password, Buffer.from(match[1], 'hex'), expected.length, SCRYPT_OPTIONS);
  return timingSafeEqual(actual, expected);
}

function tokenHash(token) {
  return createHash('sha256').update(Buffer.from(token, 'hex')).digest();
}

export async function startSession(pool, { email, password, totp, mfaKey }) {
  if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string') return null;
  const [rows] = await pool.execute(
    'SELECT id, password_hash, role, active, mfa_secret_encrypted FROM admin_users WHERE email = ? LIMIT 1',
    [email.trim().toLowerCase()],
  );
  const user = rows[0];
  const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid || !user.active || (user.role === 'admin' && !user.mfa_secret_encrypted)) return null;
  const token = randomBytes(32).toString('hex');
  const sessionId = randomUUID();
  if (user.mfa_secret_encrypted) {
    if (typeof totp !== 'string' || !/^\d{6}$/.test(totp) || !mfaKey) return null;
    const secret = decryptMfaSecret(user.mfa_secret_encrypted, mfaKey);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('INSERT IGNORE INTO admin_mfa_state (user_id) VALUES (?)', [user.id]);
      const [states] = await connection.execute('SELECT last_step FROM admin_mfa_state WHERE user_id = ? FOR UPDATE', [user.id]);
      const step = verifyTotp(secret, totp, Date.now(), states[0].last_step);
      if (step === null) {
        await connection.rollback();
        return null;
      }
      await connection.execute('UPDATE admin_mfa_state SET last_step = ? WHERE user_id = ?', [step, user.id]);
      await connection.execute(
        `INSERT INTO admin_sessions (id, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, UTC_TIMESTAMP(6) + INTERVAL 8 HOUR)`,
        [sessionId, user.id, tokenHash(token)],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } else {
    await pool.execute(
      `INSERT INTO admin_sessions (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP(6) + INTERVAL 8 HOUR)`,
      [sessionId, user.id, tokenHash(token)],
    );
  }
  return { token, role: user.role, actorId: user.id, sessionId };
}

export async function readSession(pool, token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
  const [rows] = await pool.execute(
    `SELECT s.id AS session_id, u.id AS actor_id, u.role
       FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL
        AND s.expires_at > UTC_TIMESTAMP(6) AND u.active = TRUE LIMIT 1`,
    [tokenHash(token)],
  );
  return rows[0] ?? null;
}

export async function revokeSession(pool, token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return;
  await pool.execute('UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP(6) WHERE token_hash = ? AND revoked_at IS NULL', [tokenHash(token)]);
}
