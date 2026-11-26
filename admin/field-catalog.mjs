import { mayChangeField } from '../lib/content-policy.mjs';

export const GROUPS = [
  { id: 'inicio', title: 'Inicio', description: 'Cambie el mensaje de portada y sus imágenes.', roots: ['inicio'] },
  { id: 'institucion', title: 'Conócenos', description: 'Actualice la presentación y los valores del colegio.', roots: ['nombre', 'lema', 'presentacion', 'quienesSomos', 'mision', 'vision', 'historia', 'valores', 'beneficios'] },
  { id: 'oferta', title: 'Oferta educativa', description: 'Revise las áreas, asignaturas e idiomas.', roots: ['oferta'] },
  { id: 'vida', title: 'Vida en el colegio', description: 'Edite servicios, horarios y fotografías.', roots: ['propuesta', 'servicios', 'galeria', 'horarioInstitucional', 'horarioAdministrativo'] },
  { id: 'admisiones', title: 'Admisiones', description: 'Actualice requisitos, fechas y costos.', roots: ['admisiones'] },
  { id: 'contacto', title: 'Contacto', description: 'Mantenga al día teléfonos, correo y ubicación.', roots: ['contacto'] },
  { id: 'opiniones', title: 'Opiniones', description: 'Revise los textos que se muestran como opiniones.', roots: ['opiniones', 'presentacionOpiniones'] },
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
  nombre: 'Nombre del colegio', lema: 'Lema', presentacion: 'Presentación general',
  quienesSomos: 'Quiénes somos', mision: 'Misión', vision: 'Visión',
  ofertaTitulo: 'Título de la oferta', acompanamiento: 'Acompañamiento',
  imagenGrande: 'Imagen para pantallas grandes', mapaEmbed: 'Mapa dentro de la página',
  prematricula: 'Prematrícula', periodo: 'Período de matrícula',
  items: 'Asignatura o idioma', propuesta: 'Idea', requisitos: 'Requisito',
};
const SECTION_TITLES = {
  titulo: 'Mensaje principal',
  video: 'Video de portada', introduccion: 'Presentación de portada', tarjetas: 'Tarjetas de oferta',
  acompanamiento: 'Acompañamiento', valores: 'Valores', beneficios: 'Beneficios',
  servicios: 'Servicios', galeria: 'Galería de fotos', oferta: 'Áreas educativas',
  propuesta: 'Nuestra propuesta', horarioInstitucional: 'Horario del colegio',
  horarioAdministrativo: 'Horario de oficina', aranceles: 'Costos',
  reserva: 'Reserva', horarioPrematricula: 'Horario de prematrícula',
  telefonos: 'Teléfonos', whatsapp: 'WhatsApp', opiniones: 'Opiniones',
  presentacionOpiniones: 'Presentación de opiniones', ejemplos: 'Opiniones de muestra',
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

function labelFor(path, content) {
  const parts = path.split('.');
  const key = parts.at(-1);
  if (parts.length === 1) return TITLES[key] ?? key;
  if (/^\d+$/.test(key)) return parts.at(-2)==='titulo'?`Línea ${Number(key)+1} del título`:`${TITLES[parts.at(-2)] ?? 'Texto'} ${Number(key) + 1}`;
  if (parts.length === 2) return TITLES[key] ?? key.replace(/([A-Z])/g, ' $1').toLowerCase();
  const parent = readPath(content, parts.slice(0, -1).join('.'));
  const name = parent?.titulo ?? parent?.rubro ?? parent?.autor;
  return name ? `${name}: ${TITLES[key] ?? key}` : (TITLES[key] ?? key.replace(/([A-Z])/g, ' $1').toLowerCase());
}

function sectionFor(path, content) {
  const parts = path.split('.');
  const root = parts[0];
  let section = root;
  if (['nombre', 'lema', 'presentacion', 'quienesSomos', 'mision', 'vision', 'historia'].includes(root)) section = 'institucion.general';
  if (root === 'inicio' || root === 'admisiones' || root === 'contacto' || root === 'presentacionOpiniones') section = parts.length > 2 ? `${root}.${parts[1]}` : `${root}.general`;
  if (['oferta', 'valores', 'beneficios', 'servicios', 'galeria', 'opiniones'].includes(root) && /^\d+$/.test(parts[1] ?? '')) section = `${root}.${parts[1]}`;
  if (root === 'inicio' && parts[1] === 'tarjetas' && /^\d+$/.test(parts[2] ?? '')) section = `inicio.tarjetas.${parts[2]}`;
  if (root === 'admisiones' && parts[1] === 'aranceles' && /^\d+$/.test(parts[2] ?? '')) section = `admisiones.aranceles.${parts[2]}`;
  if (root === 'contacto' && parts[1] === 'telefonos' && /^\d+$/.test(parts[2] ?? '')) section = `contacto.telefonos.${parts[2]}`;
  const sectionParts = section.split('.');
  const number = sectionParts.find(part => /^\d+$/.test(part));
  const parentKey = sectionParts.find(part => part in SECTION_TITLES) ?? root;
  const item = number !== undefined ? readPath(content, section) : null;
  const offerName = section.startsWith('inicio.tarjetas.') ? content.oferta.find(offer => offer.id === item?.id)?.titulo : null;
  const name = item?.titulo ?? item?.rubro ?? item?.autor ?? offerName;
  const title = number === undefined ? (SECTION_TITLES[parentKey] ?? 'Información general') :
    `${SECTION_TITLES[parentKey] ?? 'Elemento'}: ${name ?? `n.º ${Number(number) + 1}`}`;
  return { section, sectionTitle: title };
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
    fields.push({ path, group, label: labelFor(path, content), kind: fieldKind(value, path), value, ...sectionFor(path, content) });
  }
  visit(content, []);
  return fields;
}

export function optionalTemplate(path) {
  return path in OBJECT_TEMPLATES ? structuredClone(OBJECT_TEMPLATES[path]) : undefined;
}
