// Política compartida de contenido. El servidor debe ejecutar esta validación
// antes de guardar cualquier revisión; ocultar controles en el navegador no basta.
const FIXED_ROOTS = new Set(['basePath', 'publicUrl', 'revision', 'pendientes']);
const FIXED_FOR_ALL = new Set(['id', 'posicion']);
const FIXED_KEYS = new Set(['id', 'posicion', 'numero', 'monto', 'puntuacion', 'verificada', 'vinculoFamiliarConfirmado', 'confirmada', 'calendarioConfirmado', 'matriculaAbierta', 'modo', 'tipo', 'fecha']);
const MEDIA_KEYS = new Set(['imagen', 'imagenGrande', 'archivo', 'poster']);
const MEDIA_PREFIXES = new Set(['inicio.video']);
const ADMIN_ONLY_KEYS = new Set(['fuente', 'licencia', 'mapa', 'mapaEmbed', 'facebook', 'instagram']);
const REPEATABLE_ARRAYS = new Set([
  'valores', 'beneficios', 'oferta', 'propuesta', 'servicios', 'galeria',
  'horarioInstitucional', 'opiniones', 'presentacionOpiniones.ejemplos',
  'admisiones.requisitos', 'admisiones.aranceles', 'admisiones.horarioPrematricula',
  'inicio.tarjetas',
]);
const REPEATABLE_NESTED = [/^oferta\.\d+\.items$/, /^servicios\.\d+\.parrafos$/];

function isRepeatable(path) {
  return REPEATABLE_ARRAYS.has(path) || REPEATABLE_NESTED.some(pattern => pattern.test(path));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function walkDiff(before, after, path, out) {
  if (Array.isArray(before) || Array.isArray(after)) {
    if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) {
      out.push({ path, before, after, kind: 'structure' });
      return;
    }
    before.forEach((item, index) => walkDiff(item, after[index], [...path, String(index)], out));
    return;
  }
  if (isRecord(before) || isRecord(after)) {
    if (!isRecord(before) || !isRecord(after)) {
      out.push({ path, before, after, kind: 'structure' });
      return;
    }
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (!(key in before) || !(key in after)) {
        out.push({ path: [...path, key], before: before[key], after: after[key], kind: 'structure' });
      } else {
        walkDiff(before[key], after[key], [...path, key], out);
      }
    }
    return;
  }
  if (!Object.is(before, after)) out.push({ path, before, after, kind: 'value' });
}

export function changedFields(before, after) {
  const changes = [];
  walkDiff(before, after, [], changes);
  return changes;
}

export function mayChangeField(role, change) {
  if (!['admin', 'moderador'].includes(role) || !change.path.length) return false;
  const [root] = change.path;
  const key = change.path.at(-1);
  if (FIXED_ROOTS.has(root)) return false;
  if (FIXED_FOR_ALL.has(key)) return false;
  if (role === 'admin') {
    if (change.kind === 'structure') {
      return Array.isArray(change.before) && Array.isArray(change.after) &&
        isRepeatable(change.path.join('.'));
    }
    return true;
  }
  if (change.kind !== 'value' || typeof change.after !== 'string' || typeof change.before !== 'string') return false;
  if (FIXED_KEYS.has(key) || MEDIA_KEYS.has(key) || ADMIN_ONLY_KEYS.has(key)) return false;
  if (MEDIA_PREFIXES.has(change.path.slice(0, 2).join('.'))) return false;
  if (root === 'contacto' && ['telefonos', 'whatsapp'].includes(change.path[1]) && key === 'numero') return false;
  return true;
}

export function validateContentChange(role, before, after) {
  const changes = changedFields(before, after);
  const rejected = changes.filter(change => !mayChangeField(role, change));
  return {
    allowed: rejected.length === 0,
    changed: changes.map(change => change.path.join('.')),
    rejected: rejected.map(change => change.path.join('.')),
  };
}
