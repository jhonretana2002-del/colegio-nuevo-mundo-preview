import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateContentChange } from '../lib/content-policy.mjs';
import { invalidMediaChanges } from '../lib/media-policy.mjs';
import { validateDraft } from '../admin/validacion.mjs';

const staticMedia = JSON.parse(readFileSync(new URL('../contenido/medios-disponibles.json', import.meta.url), 'utf8'));

export class ContentError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'ContentError';
    this.code = code;
    this.details = details;
  }
}

function parsePayload(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function validateCandidate(role, before, after, availableMedia) {
  const access = validateContentChange(role, before, after);
  if (!access.allowed) {
    throw new ContentError('FORBIDDEN_CHANGE', 'El rol no puede guardar estos campos o el documento no tiene la forma esperada.',
      [...access.rejected, ...access.shapeErrors]);
  }
  const errors = validateDraft(after);
  if (errors.length) throw new ContentError('INVALID_CONTENT', 'El contenido no supera la validación.', errors);
  const invalidMedia = invalidMediaChanges(before, after, availableMedia);
  if (invalidMedia.length) throw new ContentError('INVALID_MEDIA', 'El medio no está disponible o no tiene el tipo esperado.', invalidMedia);
  if (!access.changed.length) throw new ContentError('NO_CHANGES', 'No hay cambios para guardar.');
  return access.changed;
}

export async function getPublished(pool, contentKey = 'colegio', locale = 'es-CR') {
  const [rows] = await pool.execute(
    `SELECT d.id AS document_id, d.version, r.id AS revision_id, r.payload
       FROM content_documents d
       JOIN content_publications p ON p.document_id = d.id
       JOIN content_revisions r ON r.id = p.revision_id
      WHERE d.content_key = ? AND d.locale = ?`,
    [contentKey, locale],
  );
  if (!rows.length) throw new ContentError('NOT_FOUND', 'No existe contenido publicado.');
  return { documentId: rows[0].document_id, version: String(rows[0].version), revisionId: rows[0].revision_id, content: parsePayload(rows[0].payload) };
}

export async function getWorking(pool, contentKey = 'colegio', locale = 'es-CR') {
  const [rows] = await pool.execute(
    `SELECT d.id AS document_id, d.version, r.id AS revision_id, r.payload
       FROM content_documents d
       JOIN content_publications p ON p.document_id = d.id
       LEFT JOIN content_working w ON w.document_id = d.id
       JOIN content_revisions r ON r.document_id = d.id AND r.id = COALESCE(w.revision_id, p.revision_id)
      WHERE d.content_key = ? AND d.locale = ?`,
    [contentKey, locale],
  );
  if (!rows.length) throw new ContentError('NOT_FOUND', 'No existe contenido de trabajo.');
  return { documentId: rows[0].document_id, version: String(rows[0].version), revisionId: rows[0].revision_id, content: parsePayload(rows[0].payload) };
}

export async function saveDraft(pool, { documentId, actorId, role, expectedVersion, content, comment = null }) {
  if (!documentId || !actorId || !['admin', 'moderador'].includes(role)) {
    throw new ContentError('UNAUTHORIZED', 'Identidad o rol inválido.');
  }
  if (!/^(0|[1-9]\d*)$/.test(String(expectedVersion ?? ''))) {
    throw new ContentError('INVALID_VERSION', 'Se requiere la versión de lectura.');
  }
  if (comment !== null && (typeof comment !== 'string' || comment.length > 1000)) {
    throw new ContentError('INVALID_COMMENT', 'El comentario es inválido.');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [documents] = await connection.execute(
      'SELECT id, version FROM content_documents WHERE id = ? FOR UPDATE', [documentId],
    );
    if (!documents.length) throw new ContentError('NOT_FOUND', 'Documento inexistente.');
    if (BigInt(documents[0].version) !== BigInt(expectedVersion)) {
      throw new ContentError('CONFLICT', 'Otro editor guardó cambios. Recargue y compare las versiones.');
    }
    const [working] = await connection.execute(
      `SELECT r.id, r.payload FROM content_publications p
         LEFT JOIN content_working w ON w.document_id = p.document_id
         JOIN content_revisions r ON r.document_id = p.document_id AND r.id = COALESCE(w.revision_id, p.revision_id)
        WHERE p.document_id = ?`, [documentId],
    );
    if (!working.length) throw new ContentError('NOT_FOUND', 'El documento todavía no tiene una revisión inicial publicada.');
    const [uploadedMedia] = await connection.execute("SELECT storage_key FROM media_assets WHERE kind IN ('image','video')");
    const availableMedia = [...staticMedia, ...uploadedMedia.map(row => row.storage_key)];
    const changed = validateCandidate(role, parsePayload(working[0].payload), content, availableMedia);
    const revisionId = randomUUID();
    await connection.execute(
      `INSERT INTO content_revisions
       (id, document_id, base_revision_id, author_id, payload, schema_version, status, comment)
       VALUES (?, ?, ?, ?, ?, 1, 'borrador', ?)`,
      [revisionId, documentId, working[0].id, actorId, JSON.stringify(content), comment],
    );
    await connection.execute(
      'INSERT INTO content_working (document_id, revision_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE revision_id = VALUES(revision_id)',
      [documentId, revisionId],
    );
    await connection.execute('UPDATE content_documents SET version = version + 1 WHERE id = ?', [documentId]);
    await connection.execute(
      `INSERT INTO audit_events (actor_id, action, target_type, target_id, metadata)
       VALUES (?, 'draft.saved', 'content_revision', ?, ?)`,
      [actorId, revisionId, JSON.stringify({ documentId, changed })],
    );
    await connection.commit();
    return { revisionId, version: (BigInt(expectedVersion) + 1n).toString(), changed };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
