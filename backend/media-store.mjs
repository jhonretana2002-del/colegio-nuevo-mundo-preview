import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { ContentError } from './content-store.mjs';
import sharp from 'sharp';

const staticMedia = JSON.parse(readFileSync(new URL('../contenido/medios-disponibles.json', import.meta.url), 'utf8'));
const TYPES = new Map([
  ['image/jpeg', { ext: 'jpg', kind: 'image', max: 12 * 1024 * 1024 }],
  ['image/png', { ext: 'png', kind: 'image', max: 12 * 1024 * 1024 }],
  ['image/webp', { ext: 'webp', kind: 'image', max: 12 * 1024 * 1024 }],
  ['video/mp4', { ext: 'mp4', kind: 'video', max: 100 * 1024 * 1024 }],
]);

function isSignature(mime, bytes) {
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (mime === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (mime === 'video/mp4') return bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp';
  return false;
}

async function validMp4Structure(file, bytes) {
  const input = await open(file, 'r');
  try {
    let position = 0;
    let boxes = 0;
    let hasMovie = false;
    let hasData = false;
    while (position < bytes && ++boxes <= 10000) {
      if (bytes - position < 8) return false;
      const header = Buffer.alloc(16);
      const { bytesRead } = await input.read(header, 0, Math.min(16, bytes - position), position);
      if (bytesRead < 8) return false;
      const type = header.toString('ascii', 4, 8);
      let size = header.readUInt32BE(0);
      let headerSize = 8;
      if (size === 1) {
        if (bytesRead < 16) return false;
        const large = header.readBigUInt64BE(8);
        if (large > BigInt(Number.MAX_SAFE_INTEGER)) return false;
        size = Number(large);
        headerSize = 16;
      } else if (size === 0) size = bytes - position;
      if (size < headerSize || size > bytes - position) return false;
      if (position === 0 && (type !== 'ftyp' || size < 16)) return false;
      if (type === 'moov') hasMovie = size > headerSize;
      if (type === 'mdat') hasData = size > headerSize;
      position += size;
    }
    return position === bytes && hasMovie && hasData;
  } finally { await input.close(); }
}

export async function listMedia(pool) {
  const [rows] = await pool.execute("SELECT id, storage_key, mime_type, width, height FROM media_assets WHERE kind IN ('image','video') ORDER BY created_at DESC");
  return [
    ...staticMedia.map(storageKey => ({ storageKey, mimeType: storageKey.endsWith('.mp4') ? 'video/mp4' : `image/${storageKey.endsWith('.jpg') ? 'jpeg' : storageKey.split('.').at(-1)}`, previewUrl: null })),
    ...rows.map(row => ({ id: row.id, storageKey: row.storage_key, mimeType: row.mime_type, width: row.width, height: row.height, previewUrl: `/api/media/preview/${row.id}${row.mime_type.startsWith('image/') ? '?size=small' : ''}` })),
  ];
}

export async function uploadMedia(pool, request, { actorId, role, mediaRoot }) {
  if (role !== 'admin') throw new ContentError('FORBIDDEN_CHANGE', 'Solo Admin puede agregar imágenes o videos.');
  if (typeof actorId !== 'string' || !actorId) throw new ContentError('UNAUTHORIZED', 'Sesión requerida.');
  const mime = String(request.headers['content-type'] ?? '').toLowerCase();
  const type = TYPES.get(mime);
  if (!type) throw new ContentError('INVALID_MEDIA', 'Seleccione una imagen JPG, PNG o WebP, o un video MP4.');
  await mkdir(mediaRoot, { recursive: true });
  const id = randomUUID();
  const tmp = path.join(mediaRoot, `.${id}.part`);
  let final = path.join(mediaRoot, `${id}.${type.ext}`);
  const processed = path.join(mediaRoot, `.${id}.processed.part`);
  const variant = path.join(mediaRoot, `${id}-480.webp`);
  const handle = await open(tmp, 'wx');
  const digest = createHash('sha256');
  let count = 0;
  let header = Buffer.alloc(0);
  let completed = false;
  try {
    try {
      for await (const chunk of request) {
        count += chunk.length;
        if (count > type.max) throw new ContentError('BODY_TOO_LARGE', 'El archivo supera el tamaño permitido.');
        if (header.length < 16) header = Buffer.concat([header, chunk.subarray(0, 16 - header.length)]);
        digest.update(chunk);
        let offset = 0;
        while (offset < chunk.length) offset += (await handle.write(chunk, offset, chunk.length - offset)).bytesWritten;
      }
    } finally { await handle.close(); }
    if (!count || !isSignature(mime, header)) throw new ContentError('INVALID_MEDIA', 'El archivo no coincide con el formato indicado.');
    let storedMime = mime;
    let storedBytes = count;
    let width = null;
    let height = null;
    let checksum = digest.digest();
    let thumbnail = null;
    if (type.kind === 'image') {
      let result;
      try {
        const metadata = await sharp(tmp, { limitInputPixels: 40_000_000 }).metadata();
        const format = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[mime];
        if (metadata.format !== format || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height || metadata.width < 320 || metadata.height < 240) {
          throw new Error('Formato o dimensiones inválidos.');
        }
        result = await sharp(tmp, { limitInputPixels: 40_000_000 }).rotate()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
        if (result.data.length > type.max) throw new Error('Imagen procesada demasiado grande.');
      } catch {
        throw new ContentError('INVALID_MEDIA', 'La imagen debe abrirse correctamente y medir al menos 320 × 240 píxeles.');
      }
      width = result.info.width; height = result.info.height;
      storedBytes = result.data.length;
      checksum = createHash('sha256').update(result.data).digest();
      storedMime = 'image/webp';
      final = path.join(mediaRoot, `${id}.webp`);
      await writeFile(processed, result.data, { flag: 'wx' });
      await rename(processed, final);
      await unlink(tmp);
      thumbnail = await sharp(result.data).resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 72 }).toBuffer({ resolveWithObject: true });
      await writeFile(variant, thumbnail.data, { flag: 'wx' });
    } else {
      if (!(await validMp4Structure(tmp, count))) throw new ContentError('INVALID_MEDIA', 'El video MP4 está incompleto o dañado.');
      await rename(tmp, final);
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const storageKey = `uploads/${id}${path.extname(final)}`;
      await connection.execute(
        'INSERT INTO media_assets (id, kind, storage_key, mime_type, bytes, width, height, checksum_sha256, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, type.kind, storageKey, storedMime, storedBytes, width, height, checksum, actorId],
      );
      if (thumbnail) await connection.execute(
        'INSERT INTO media_variants (id, asset_id, storage_key, mime_type, bytes, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [randomUUID(), id, `uploads/${path.basename(variant)}`, 'image/webp', thumbnail.data.length, thumbnail.info.width, thumbnail.info.height],
      );
      await connection.execute(
        "INSERT INTO audit_events (actor_id, action, target_type, target_id) VALUES (?, 'media.uploaded', 'media_asset', ?)",
        [actorId, id],
      );
      await connection.commit();
      completed = true;
      return { id, storageKey, mimeType: storedMime, bytes: storedBytes, width, height, previewUrl: `/api/media/preview/${id}${thumbnail ? '?size=small' : ''}` };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  } finally {
    if (!completed) {
      await unlink(tmp).catch(() => {});
      await unlink(processed).catch(() => {});
      await unlink(final).catch(() => {});
      await unlink(variant).catch(() => {});
    }
  }
}

export async function openMediaPreview(pool, id, mediaRoot, range = null, size = null) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new ContentError('NOT_FOUND', 'Archivo no encontrado.');
  if (size !== null && size !== 'small') throw new ContentError('NOT_FOUND', 'Archivo no encontrado.');
  const [rows] = await pool.execute('SELECT storage_key, mime_type FROM media_assets WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) throw new ContentError('NOT_FOUND', 'Archivo no encontrado.');
  const original = path.basename(rows[0].storage_key);
  if (!new RegExp(`^${id}\\.(jpg|png|webp|mp4)$`).test(original) || rows[0].storage_key !== `uploads/${original}`) {
    throw new ContentError('NOT_FOUND', 'Archivo no encontrado.');
  }
  if (size === 'small' && !rows[0].mime_type.startsWith('image/')) throw new ContentError('NOT_FOUND', 'Archivo no encontrado.');
  let useVariant = false;
  if (size === 'small') {
    const [variants] = await pool.execute('SELECT storage_key, mime_type FROM media_variants WHERE asset_id = ? AND storage_key = ? LIMIT 1', [id, `uploads/${id}-480.webp`]);
    if (variants.length) {
      if (variants[0].storage_key !== `uploads/${id}-480.webp` || variants[0].mime_type !== 'image/webp') throw new ContentError('NOT_FOUND', 'Archivo no encontrado.');
      useVariant = true;
    }
  }
  const name = useVariant ? `${id}-480.webp` : original;
  const file = path.join(mediaRoot, name);
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) throw new ContentError('NOT_FOUND', 'Archivo no encontrado.');
  let start = 0;
  let end = info.size - 1;
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) throw new ContentError('INVALID_RANGE', 'Rango de archivo inválido.');
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= info.size) throw new ContentError('INVALID_RANGE', 'Rango de archivo inválido.');
  }
  return { stream: createReadStream(file, { start, end }), mimeType: useVariant ? 'image/webp' : rows[0].mime_type, bytes: end - start + 1, range: range ? `bytes ${start}-${end}/${info.size}` : null };
}
