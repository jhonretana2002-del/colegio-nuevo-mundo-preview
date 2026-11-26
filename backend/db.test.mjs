import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { databaseConfig } from './db.mjs';
import { splitStatements } from './migrate.mjs';

test('configuración MariaDB requiere credenciales y desactiva sentencias múltiples', () => {
  assert.throws(() => databaseConfig({}), /DB_HOST/);
  assert.throws(() => databaseConfig({ DB_HOST: 'localhost', DB_NAME: 'colegio', DB_USER: 'app', DB_PASSWORD: 'x', DB_PORT: '0' }), /DB_PORT/);
  const config = databaseConfig({ DB_HOST: 'localhost', DB_NAME: 'colegio', DB_USER: 'app', DB_PASSWORD: 'x' });
  assert.equal(config.port, 3306);
  assert.equal(config.multipleStatements, false);
  assert.equal(config.charset, 'utf8mb4');
});

test('migración inicial contiene las nueve tablas y se divide en sentencias individuales', async () => {
  const sql = await readFile(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8');
  const statements = splitStatements(sql);
  const tables = statements.map(statement => statement.match(/^CREATE TABLE IF NOT EXISTS (\w+)/)?.[1]);
  assert.deepEqual(tables, [
    'admin_users', 'admin_sessions', 'content_documents', 'content_revisions',
    'content_publications', 'media_assets', 'media_variants', 'audit_events', 'publish_jobs',
  ]);
  assert.ok(sql.includes('FOREIGN KEY (document_id, revision_id)'));
  assert.ok(sql.includes('CHECK (JSON_VALID(payload))'));
});
