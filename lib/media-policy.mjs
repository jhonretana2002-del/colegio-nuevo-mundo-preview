const MEDIA_KEYS = new Set(['imagen', 'imagenGrande', 'archivo', 'poster']);
const IMAGE = /\.(?:jpg|jpeg|png|webp)$/i;
const VIDEO = /\.mp4$/i;

export function invalidMediaChanges(_before, after, available) {
  const allowed = new Set(available);
  const invalid = [];
  function visit(value, path) {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, [...path, String(index)]));
    if (value !== null && typeof value === 'object') return Object.entries(value).forEach(([key, item]) => visit(item, [...path, key]));
    const key = path.at(-1);
    if (!MEDIA_KEYS.has(key)) return;
    if (value === null && /^publicaciones\.\d+\.imagen$/.test(path.join('.'))) return;
    if (typeof value !== 'string' || !/^[a-zA-Z0-9/_-]+\.(?:mp4|jpg|jpeg|png|webp)$/.test(value) || !allowed.has(value) ||
        (key === 'archivo' ? !VIDEO.test(value) : !IMAGE.test(value))) invalid.push(path.join('.'));
  }
  visit(after, []);
  return invalid;
}
