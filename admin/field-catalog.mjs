import { mayChangeField } from '../lib/content-policy.mjs';

export const GROUPS = [
  { id: 'inicio', title: 'Inicio', roots: ['inicio'] },
  { id: 'institucion', title: 'Conócenos', roots: ['nombre', 'lema', 'presentacion', 'quienesSomos', 'mision', 'vision', 'historia', 'valores', 'beneficios'] },
  { id: 'oferta', title: 'Oferta educativa', roots: ['oferta'] },
  { id: 'vida', title: 'Vida en el colegio', roots: ['propuesta', 'servicios', 'galeria', 'horarioInstitucional', 'horarioAdministrativo'] },
  { id: 'admisiones', title: 'Admisiones', roots: ['admisiones'] },
  { id: 'contacto', title: 'Contacto', roots: ['contacto'] },
  { id: 'opiniones', title: 'Opiniones', roots: ['opiniones', 'presentacionOpiniones'] },
];

const TITLES = {
  antetitulo: 'Frase superior', descripcion: 'Descripción', introduccion: 'Presentación',
  imagen: 'Imagen', imagenGrande: 'Imagen grande', archivo: 'Video', poster: 'Póster',
  titulo: 'Título', texto: 'Texto', resumen: 'Resumen', parrafos: 'Párrafos',
  dias: 'Días', horas: 'Horas', monto: 'Monto', rubro: 'Rubro', condicion: 'Condición',
  numero: 'Número', correo: 'Correo', direccion: 'Dirección', cursoLectivo: 'Curso lectivo',
  matriculaAbierta: 'Matrícula abierta', calendarioConfirmado: 'Calendario confirmado',
  fechaTexto: 'Fecha visible', alt: 'Texto alternativo', fuente: 'Fuente', licencia: 'Licencia',
  autor: 'Autor', aviso: 'Aviso', consulta: 'Mensaje de consulta',
};
const MEDIA_KEYS = new Set(['imagen', 'imagenGrande', 'archivo', 'poster']);
const URL_KEYS = new Set(['facebook', 'instagram', 'mapa', 'mapaEmbed', 'fuente', 'licencia']);
const OBJECT_TEMPLATES = {
  historia: { resumen: '', parrafos: [''] },
  horarioAdministrativo: [{ dias: '', horas: '' }],
};

export function readPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

export function writePath(object, path, value) {
  const parts = path.split('.');
  const key = parts.pop();
  const parent = parts.reduce((node, part) => node[part], object);
  parent[key] = value;
}

function groupFor(root) {
  return GROUPS.find(group => group.roots.includes(root))?.id;
}

function labelFor(path) {
  const parts = path.split('.');
  return parts.map((part, index) => /^\d+$/.test(part) ? `#${Number(part) + 1}` : (TITLES[part] ?? part.replace(/([A-Z])/g, ' $1').toLowerCase()))
    .map((part, index) => index === 0 ? part[0].toUpperCase() + part.slice(1) : part).join(' · ');
}

function candidate(value, path) {
  if (typeof value === 'string') return value + 'x';
  if (typeof value === 'number') return value + 1;
  if (typeof value === 'boolean') return !value;
  if (value === null && path === 'historia') return structuredClone(OBJECT_TEMPLATES.historia);
  if (value === null && path === 'horarioAdministrativo') return structuredClone(OBJECT_TEMPLATES.horarioAdministrativo);
  if (value === null) return 'x';
  return undefined;
}

function fieldKind(value, path) {
  if (path in OBJECT_TEMPLATES) return 'optional-structure';
  const key = path.split('.').at(-1);
  if (MEDIA_KEYS.has(key)) return 'media';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number' || (value === null && key === 'monto')) return 'number';
  if (key === 'correo') return 'email';
  if (URL_KEYS.has(key)) return 'url';
  return 'text';
}

export function editableFields(content, role) {
  const fields = [];
  function visit(value, parts) {
    const path = parts.join('.');
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, [...parts, String(index)]));
    if (value !== null && typeof value === 'object') return Object.entries(value).forEach(([key, item]) => visit(item, [...parts, key]));
    const after = candidate(value, path);
    if (after === undefined || !mayChangeField(role, { path: parts, before: value, after, kind: after !== null && typeof after === 'object' ? 'structure' : 'value' })) return;
    const group = groupFor(parts[0]);
    if (!group) return;
    fields.push({ path, group, label: labelFor(path), kind: fieldKind(value, path), value });
  }
  visit(content, []);
  return fields;
}

export function optionalTemplate(path) {
  return path in OBJECT_TEMPLATES ? structuredClone(OBJECT_TEMPLATES[path]) : undefined;
}
