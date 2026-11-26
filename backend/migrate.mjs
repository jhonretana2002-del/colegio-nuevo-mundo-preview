import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createDatabasePool } from './db.mjs';

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export function splitStatements(sql) {
  return sql.split(/^-- statement\s*$/m).map(part => part.trim()).filter(Boolean);
}

export async function runMigrations(pool, migrationDir = directory) {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [lockRows] = await connection.query("SELECT GET_LOCK('colegio_admin_migrations', 15) AS acquired");
    if (lockRows[0]?.acquired !== 1) throw new Error('No se pudo obtener el bloqueo de migraciones');
    locked = true;
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(160) NOT NULL PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    const files = (await readdir(migrationDir)).filter(name => /^\d+_[\w-]+\.sql$/.test(name)).sort();
    for (const name of files) {
      const sql = await readFile(path.join(migrationDir, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const [rows] = await connection.execute('SELECT checksum FROM schema_migrations WHERE name = ?', [name]);
      if (rows.length) {
        if (rows[0].checksum !== checksum) throw new Error(`La migración aplicada cambió: ${name}`);
        continue;
      }
      // DDL en MariaDB confirma implícitamente. Cada sentencia es repetible para recuperar cortes.
      for (const statement of splitStatements(sql)) await connection.query(statement);
      await connection.execute('INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)', [name, checksum]);
    }
  } finally {
    if (locked) await connection.query("SELECT RELEASE_LOCK('colegio_admin_migrations')");
    connection.release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pool = await createDatabasePool();
  try {
    await runMigrations(pool);
    console.log('Migraciones MariaDB al día.');
  } finally {
    await pool.end();
  }
}
