import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createDatabasePool } from './db.mjs';
import { validateDraft } from '../admin/validacion.mjs';
import { validateContentShape } from '../lib/content-shape.mjs';

const reference = JSON.parse(await readFile(new URL('../contenido/colegio.json', import.meta.url), 'utf8'));

export async function seedContent(pool, { actorId, source }) {
  if (typeof actorId !== 'string' || !/^[0-9a-f-]{36}$/i.test(actorId)) throw new Error('Se requiere el ID de una cuenta Admin.');
  if (!source || typeof source !== 'object' || Array.isArray(source) || validateContentShape(reference, source).length || validateDraft(source).length) {
    throw new Error('El contenido inicial no es válido.');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute("SELECT id FROM admin_users WHERE id = ? AND role = 'admin' AND active = TRUE AND mfa_secret_encrypted IS NOT NULL FOR UPDATE", [actorId]);
    if (users.length !== 1) throw new Error('La cuenta indicada no es Admin activa.');
    const [existing] = await connection.execute('SELECT id FROM content_documents WHERE content_key = ? AND locale = ? FOR UPDATE', ['colegio', 'es-CR']);
    if (existing.length) {
      await connection.commit();
      return { created: false, documentId: existing[0].id };
    }
    const documentId = randomUUID();
    const revisionId = randomUUID();
    await connection.execute('INSERT INTO content_documents (id, content_key, locale) VALUES (?, ?, ?)', [documentId, 'colegio', 'es-CR']);
    await connection.execute(
      "INSERT INTO content_revisions (id, document_id, author_id, payload, schema_version, status, comment) VALUES (?, ?, ?, ?, 1, 'aprobado', ?)",
      [revisionId, documentId, actorId, JSON.stringify(source), 'Importación inicial desde contenido/colegio.json'],
    );
    await connection.execute('INSERT INTO content_publications (document_id, revision_id, published_by) VALUES (?, ?, ?)', [documentId, revisionId, actorId]);
    await connection.execute(
      "INSERT INTO audit_events (actor_id, action, target_type, target_id) VALUES (?, 'content.initial_import', 'content_revision', ?)",
      [actorId, revisionId],
    );
    await connection.commit();
    return { created: true, documentId, revisionId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const actorId = process.argv[2];
  if (!actorId) throw new Error('Uso: node seed-content.mjs <id-de-Admin>');
  const pool = await createDatabasePool();
  try {
    const result = await seedContent(pool, { actorId, source: reference });
    console.log(result.created ? `Contenido inicial importado: ${result.documentId}` : `El contenido ya existe: ${result.documentId}`);
  } finally { await pool.end(); }
}
