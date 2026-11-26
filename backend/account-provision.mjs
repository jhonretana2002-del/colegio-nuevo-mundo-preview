import { randomUUID } from 'node:crypto';
import { hashPassword } from './auth-store.mjs';
import { encryptMfaSecret, verifyTotp } from './mfa.mjs';

function validEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function confirmedStep(secret, code, now) {
  if (!Buffer.isBuffer(secret) || secret.length !== 20) throw new Error('Secreto MFA inválido.');
  const step = verifyTotp(secret, code, now);
  if (step === null) throw new Error('Debe confirmar el código MFA vigente.');
  return step;
}

function recoveryMetadata(operatorName, reason) {
  if (typeof operatorName !== 'string' || operatorName.trim().length < 3 || operatorName.length > 120 ||
      typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 500) {
    throw new Error('La recuperación requiere responsable y motivo.');
  }
  return JSON.stringify({ operatorName: operatorName.trim(), reason: reason.trim() });
}

export async function createAccount(pool, { email, password, role, mfaSecret, confirmationCode, mfaKey, now = Date.now(), operatorId = null }) {
  if (!validEmail(email) || !['admin', 'moderador'].includes(role)) throw new Error('Cuenta inválida.');
  if (role === 'admin' && !mfaSecret) throw new Error('Admin requiere MFA.');
  const normalizedEmail = email.trim().toLowerCase();
  const step = mfaSecret ? confirmedStep(mfaSecret, confirmationCode, now) : null;
  const passwordHash = await hashPassword(password);
  const encrypted = mfaSecret ? encryptMfaSecret(mfaSecret, mfaKey) : null;
  const id = randomUUID();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'INSERT INTO admin_users (id, email, password_hash, role, mfa_secret_encrypted) VALUES (?, ?, ?, ?, ?)',
      [id, normalizedEmail, passwordHash, role, encrypted],
    );
    if (step !== null) {
      await connection.execute('INSERT INTO admin_mfa_state (user_id, last_step) VALUES (?, ?)', [id, step]);
    }
    await connection.execute(
      'INSERT INTO audit_events (actor_id, action, target_type, target_id, metadata) VALUES (?, ?, ?, ?, ?)',
      [operatorId, 'account.create', 'admin_user', id, JSON.stringify({ role })],
    );
    await connection.commit();
    return { id, email: normalizedEmail, role };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function replaceMfa(pool, { userId, mfaSecret, confirmationCode, mfaKey, now = Date.now(), operatorId = null, operatorName, reason }) {
  if (typeof userId !== 'string' || !userId) throw new Error('Cuenta inválida.');
  const metadata = recoveryMetadata(operatorName, reason);
  const step = confirmedStep(mfaSecret, confirmationCode, now);
  const encrypted = encryptMfaSecret(mfaSecret, mfaKey);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute('SELECT id FROM admin_users WHERE id = ? FOR UPDATE', [userId]);
    if (users.length !== 1) throw new Error('Cuenta no encontrada.');
    await connection.execute('UPDATE admin_users SET mfa_secret_encrypted = ? WHERE id = ?', [encrypted, userId]);
    await connection.execute(
      'INSERT INTO admin_mfa_state (user_id, last_step) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_step = VALUES(last_step)',
      [userId, step],
    );
    await connection.execute('UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP(6) WHERE user_id = ? AND revoked_at IS NULL', [userId]);
    await connection.execute(
      'INSERT INTO audit_events (actor_id, action, target_type, target_id, metadata) VALUES (?, ?, ?, ?, ?)',
      [operatorId, 'account.mfa_replace', 'admin_user', userId, metadata],
    );
    await connection.commit();
    return { userId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function resetPassword(pool, { userId, newPassword, operatorId = null, operatorName, reason }) {
  if (typeof userId !== 'string' || !userId) throw new Error('Cuenta inválida.');
  const metadata = recoveryMetadata(operatorName, reason);
  const passwordHash = await hashPassword(newPassword);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute('SELECT id FROM admin_users WHERE id = ? FOR UPDATE', [userId]);
    if (users.length !== 1) throw new Error('Cuenta no encontrada.');
    await connection.execute('UPDATE admin_users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    await connection.execute('UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP(6) WHERE user_id = ? AND revoked_at IS NULL', [userId]);
    await connection.execute(
      'INSERT INTO audit_events (actor_id, action, target_type, target_id, metadata) VALUES (?, ?, ?, ?, ?)',
      [operatorId, 'account.password_reset', 'admin_user', userId, metadata],
    );
    await connection.commit();
    return { userId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
