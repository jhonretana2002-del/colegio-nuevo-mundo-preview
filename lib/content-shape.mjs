// Valida la forma del documento sin depender de la interfaz del editor.
// La revisión base debe venir del almacenamiento confiable del servidor.
const NULLABLE_TYPES = new Map([
  ['historia', 'object'],
  ['contacto.mapaEmbed', 'string'],
  ['horarioAdministrativo', 'array'],
  ['admisiones.cursoLectivo', 'string'],
  ['admisiones.aranceles.*.monto', 'number'],
  ['opiniones.*.texto', 'string'],
]);
const NULLABLE_TEMPLATES = new Map([
  ['historia', { resumen: '', parrafos: [''] }],
  ['horarioAdministrativo', [{ dias: '', horas: '' }]],
]);

function normalize(path) {
  return path.map(part => /^\d+$/.test(part) ? '*' : part).join('.');
}

function kind(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function isRecord(value) {
  return kind(value) === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

function inspect(reference, candidate, path, errors) {
  const label = path.join('.') || '(raíz)';
  const expected = kind(reference);
  const actual = kind(candidate);
  if (expected === 'null') {
    const allowed = NULLABLE_TYPES.get(normalize(path));
    if (actual !== 'null' && actual !== allowed) errors.push(`${label}: tipo ${actual} no permitido`);
    else if (actual !== 'null' && NULLABLE_TEMPLATES.has(normalize(path))) {
      inspect(NULLABLE_TEMPLATES.get(normalize(path)), candidate, path, errors);
    }
    return;
  }
  if (actual !== expected) {
    if (!(actual === 'null' && NULLABLE_TYPES.get(normalize(path)) === expected)) {
      errors.push(`${label}: se esperaba ${expected}, se recibió ${actual}`);
    }
    return;
  }
  if (actual === 'number' && !Number.isFinite(candidate)) errors.push(`${label}: número no finito`);
  if (actual === 'string' && candidate.length > 5000) errors.push(`${label}: texto demasiado largo`);
  if (actual === 'object') {
    if (!isRecord(candidate) || !isRecord(reference)) {
      errors.push(`${label}: objeto inválido`);
      return;
    }
    const expectedKeys = Object.keys(reference);
    for (const key of Object.keys(candidate)) {
      if (!Object.hasOwn(reference, key)) errors.push(`${label}.${key}: campo desconocido`);
    }
    for (const key of expectedKeys) {
      if (!Object.hasOwn(candidate, key)) errors.push(`${label}.${key}: campo obligatorio ausente`);
      else inspect(reference[key], candidate[key], [...path, key], errors);
    }
  }
  if (actual === 'array') {
    const template = reference[0];
    if (template === undefined && candidate.length) {
      errors.push(`${label}: no existe plantilla para elementos nuevos`);
      return;
    }
    candidate.forEach((item, index) => inspect(reference[index] ?? template, item, [...path, String(index)], errors));
    if (candidate.some(item => isRecord(item) && Object.hasOwn(item, 'id'))) {
      const ids = candidate.map(item => item?.id);
      if (ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
        errors.push(`${label}: identificadores ausentes o repetidos`);
      }
    }
  }
}

export function validateContentShape(reference, candidate) {
  const errors = [];
  inspect(reference, candidate, [], errors);
  return errors;
}
