import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createDatabasePool } from './db.mjs';
import { CONTENT_SCHEMA_VERSION, fillMissingContent } from './content-schema.mjs';
import { validateContentShape } from '../lib/content-shape.mjs';
import { validateDraft } from '../admin/validacion.mjs';

const reference = JSON.parse(await readFile(new URL('../contenido/colegio.json', import.meta.url), 'utf8'));
const payload = value => typeof value === 'string' ? JSON.parse(value) : value;

export async function upgradeContent(pool, { actorId, source = reference }) {
  if (typeof actorId !== 'string' || !/^[0-9a-f-]{36}$/i.test(actorId)) throw new Error('Se requiere el ID de una cuenta Admin.');
  if (!source || typeof source !== 'object' || Array.isArray(source) || validateContentShape(reference, source).length || validateDraft(source).length) {
    throw new Error('La plantilla de contenido no es válida.');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute(
      "SELECT id FROM admin_users WHERE id = ? AND role = 'admin' AND active = TRUE AND mfa_secret_encrypted IS NOT NULL FOR UPDATE", [actorId],
    );
    if (users.length !== 1) throw new Error('La cuenta indicada no es Admin activa.');
    const [documents] = await connection.execute(
      'SELECT id, version FROM content_documents WHERE content_key = ? AND locale = ? FOR UPDATE', ['colegio', 'es-CR'],
    );
    if (!documents.length) throw new Error('Importe primero el contenido inicial.');
    const documentId = documents[0].id;
    const [rows] = await connection.execute(
      `SELECT r.id, r.payload, r.schema_version, r.status FROM content_publications p
         LEFT JOIN content_working w ON w.document_id = p.document_id
         JOIN content_revisions r ON r.document_id = p.document_id AND r.id = COALESCE(w.revision_id, p.revision_id)
        WHERE p.document_id = ?`, [documentId],
    );
    if (!rows.length) throw new Error('No existe una revisión de trabajo.');
    const working = rows[0];
    if (Number(working.schema_version) > CONTENT_SCHEMA_VERSION) throw new Error('La base tiene una versión de contenido más reciente que este código.');
    const added = [];
    const next = fillMissingContent(source, payload(working.payload), [], added);
    const shapeErrors = validateContentShape(source, next);
    const contentErrors = validateDraft(next);
    if (shapeErrors.length || contentErrors.length) throw new Error(`El contenido necesita revisión manual: ${[...shapeErrors, ...contentErrors].slice(0, 3).join('; ')}`);
    if (Number(working.schema_version) === CONTENT_SCHEMA_VERSION && !added.length) {
      await connection.commit();
      return { updated: false, documentId, revisionId: working.id, added };
    }
    const revisionId = randomUUID();
    await connection.execute(
      `INSERT INTO content_revisions (id, document_id, base_revision_id, author_id, payload, schema_version, status, comment)
       VALUES (?, ?, ?, ?, ?, ?, 'borrador', ?)`,
      [revisionId, documentId, working.id, actorId, JSON.stringify(next), CONTENT_SCHEMA_VERSION, 'Actualización de estructura del contenido'],
    );
    await connection.execute(
      'INSERT INTO content_working (document_id, revision_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE revision_id = VALUES(revision_id)',
      [documentId, revisionId],
    );
    await connection.execute('UPDATE content_documents SET version = version + 1 WHERE id = ?', [documentId]);
    await connection.execute(
      "INSERT INTO audit_events (actor_id, action, target_type, target_id, metadata) VALUES (?, 'content.schema_upgraded', 'content_revision', ?, ?)",
      [actorId, revisionId, JSON.stringify({ documentId, fromRevisionId: working.id, fromStatus: working.status, fromSchemaVersion: working.schema_version, added })],
    );
    await connection.commit();
    return { updated: true, documentId, revisionId, added };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const actorId = process.argv[2];
  if (!actorId) throw new Error('Uso: node upgrade-content.mjs <id-de-Admin>');
  const pool = await createDatabasePool();
  try {
    const result = await upgradeContent(pool, { actorId });
    console.log(result.updated ? `Contenido de trabajo actualizado: ${result.added.length} grupos o campos nuevos.` : 'La estructura del contenido ya está actualizada.');
  } finally { await pool.end(); }
}
