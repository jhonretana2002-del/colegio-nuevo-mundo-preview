import { createHmac } from 'node:crypto';

const MAX_ATTEMPTS = 10;

function key(secret, category, value) {
  return createHmac('sha256', secret).update(`${category}:${value}`).digest();
}

export function createLoginGate(pool, secret) {
  if (!pool || typeof secret !== 'string' || secret.length < 32) throw new Error('Se requiere base de datos y secreto de límite de acceso.');
  return async ({ email, ip }) => {
    const keys = [key(secret, 'email', String(email).toLowerCase()), key(secret, 'ip', String(ip))]
      .sort(Buffer.compare);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const rows = [];
      for (const hashed of keys) {
        await connection.execute(
          `INSERT IGNORE INTO login_limits (key_hash, attempts, reset_at)
           VALUES (?, 0, UTC_TIMESTAMP(6) + INTERVAL 15 MINUTE)`, [hashed],
        );
        const [found] = await connection.execute(
          'SELECT attempts, reset_at <= UTC_TIMESTAMP(6) AS expired FROM login_limits WHERE key_hash = ? FOR UPDATE',
          [hashed],
        );
        rows.push({ hashed, attempts: Number(found[0].attempts), expired: Boolean(found[0].expired) });
      }
      const allowed = rows.every(row => row.expired || row.attempts < MAX_ATTEMPTS);
      if (allowed) {
        for (const row of rows) {
          await connection.execute(
            `UPDATE login_limits SET attempts = ?,
             reset_at = IF(?, UTC_TIMESTAMP(6) + INTERVAL 15 MINUTE, reset_at)
             WHERE key_hash = ?`,
            [row.expired ? 1 : row.attempts + 1, row.expired, row.hashed],
          );
        }
      }
      await connection.commit();
      return allowed;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
