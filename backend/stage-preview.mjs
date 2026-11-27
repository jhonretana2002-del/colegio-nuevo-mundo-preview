import { createHash, randomUUID } from 'node:crypto';
import { access, copyFile, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateSite } from '../scripts/generar-sitio.mjs';
import { validateDraft } from '../admin/validacion.mjs';
import { validateContentShape } from '../lib/content-shape.mjs';
import { invalidMediaChanges } from '../lib/media-policy.mjs';
import { createDatabasePool } from './db.mjs';
import { getWorking } from './content-store.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicFile = /\.(?:css|js|webp|jpg|jpeg|png|svg|ico)$/i;
const uploadKey = /^uploads\/([0-9a-f-]{36}\.(?:jpg|png|webp|mp4))$/;
const mediaFields = new Set(['imagen', 'imagenGrande', 'archivo', 'poster']);
const reference = JSON.parse(await readFile(path.join(sourceRoot, 'contenido/colegio.json'), 'utf8'));
const staticMedia = JSON.parse(await readFile(path.join(sourceRoot, 'contenido/medios-disponibles.json'), 'utf8'));

function mediaReferences(content) {
  const keys = new Set();
  function visit(value, field = '') {
    if (Array.isArray(value)) value.forEach(item => visit(item));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => visit(item, key));
    else if (mediaFields.has(field) && typeof value === 'string') keys.add(value);
  }
  visit(content);
  return [...keys];
}

export function mediaKeys(content) { return mediaReferences(content).filter(key => key.startsWith('uploads/')); }

async function copyUploaded(content, mediaRoot, outputRoot, mediaRecords) {
  const keys = mediaKeys(content);
  if (!keys.length) return;
  if (!path.isAbsolute(mediaRoot ?? '')) throw new Error('MEDIA_ROOT debe ser una ruta absoluta.');
  const records = new Map(mediaRecords.map(row => [row.storage_key, row]));
  await mkdir(path.join(outputRoot, 'uploads'));
  for (const key of keys) {
    const match = uploadKey.exec(key);
    if (!match || !records.has(key)) throw new Error(`Medio no registrado: ${key}`);
    const bytes = await readFile(path.join(mediaRoot, match[1]));
    const digest = createHash('sha256').update(bytes).digest();
    const expected = records.get(key).checksum_sha256;
    if (!Buffer.isBuffer(expected) || !digest.equals(expected)) throw new Error(`El medio no coincide con MariaDB: ${key}`);
    await writeFile(path.join(outputRoot, key), bytes);
  }
}

export async function stagePreview({ content, outputRoot, mediaRoot, mediaRecords = [], templateRoot = sourceRoot, previewBasePath = null }) {
  if (!content || !path.isAbsolute(outputRoot ?? '')) throw new Error('Se requiere contenido y una carpeta de destino absoluta.');
  if (previewBasePath !== null && !/^\/[a-zA-Z0-9/_-]+\/$/.test(previewBasePath)) throw new Error('El prefijo privado de vista previa es inválido.');
  const errors = [...validateContentShape(reference, content), ...validateDraft(content),
    ...invalidMediaChanges(content, content, [...staticMedia, ...mediaRecords.map(row => row.storage_key)])];
  if (errors.length) throw new Error(`La revisión aprobada no supera la validación: ${errors.join('; ')}`);
  const destination = path.resolve(outputRoot);
  const source = path.resolve(templateRoot);
  if (destination === source || destination.startsWith(source + path.sep)) throw new Error('La vista previa debe guardarse fuera del repositorio.');
  try { await access(destination); throw new Error('La carpeta de destino ya existe.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = `${destination}.preparando-${randomUUID()}`;
  await mkdir(temporary, { recursive: true });
  try {
    for (const entry of await readdir(source, { withFileTypes: true })) {
      if (entry.isFile() && (publicFile.test(entry.name) || entry.name === '.nojekyll')) {
        await copyFile(path.join(source, entry.name), path.join(temporary, entry.name));
      }
    }
    await cp(path.join(source, 'assets'), path.join(temporary, 'assets'), { recursive: true });
    await copyUploaded(content, mediaRoot, temporary, mediaRecords);
    for (const key of mediaReferences(content)) await access(path.join(temporary, key));
    await generateSite(previewBasePath === null ? content : { ...content, basePath: previewBasePath }, { outputRoot: temporary, resourceRoot: temporary });
    await rename(temporary, destination);
    return { outputRoot: destination, uploadedMedia: mediaKeys(content).length };
  } catch (error) {
    if (temporary.startsWith(path.dirname(destination) + path.sep)) await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const destination = process.argv[2];
  if (!destination || !path.isAbsolute(destination)) throw new Error('Uso: node backend/stage-preview.mjs RUTA_ABSOLUTA_DESTINO');
  const pool = await createDatabasePool();
  try {
    const revision = await getWorking(pool);
    if (revision.status !== 'aprobado') throw new Error('Solo se puede preparar una revisión aprobada.');
    const keys = mediaKeys(revision.content);
    const [mediaRecords] = keys.length
      ? await pool.execute(`SELECT storage_key, checksum_sha256 FROM media_assets WHERE storage_key IN (${keys.map(() => '?').join(',')})`, keys)
      : [[]];
    const result = await stagePreview({ content: revision.content, outputRoot: destination, mediaRoot: process.env.MEDIA_ROOT, mediaRecords });
    console.log(`Vista previa de la revisión ${revision.revisionId} preparada en ${result.outputRoot}. Medios cargados: ${result.uploadedMedia}.`);
  } finally { await pool.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
