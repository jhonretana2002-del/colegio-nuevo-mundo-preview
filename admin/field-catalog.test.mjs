import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mayChangeField } from '../lib/content-policy.mjs';
import { editableFields, optionalTemplate, readPath, writePath } from './field-catalog.mjs';
import { NEWS_TEMPLATE } from '../lib/content-shape.mjs';

const content = JSON.parse(await readFile(new URL('../contenido/colegio.json', import.meta.url), 'utf8'));

test('catálogo cubre cada valor editable de la fuente actual según la política de roles', () => {
  for (const role of ['admin', 'moderador']) {
    const fields = editableFields(content, role);
    const paths = new Set(fields.map(field => field.path));
    assert.equal(fields.length, paths.size);
    assert.ok(fields.length > (role === 'admin' ? 100 : 75));
    for (const field of fields) {
      assert.ok(field.group && field.label && field.kind);
      const before = readPath(content, field.path);
      const after = before === null ? (optionalTemplate(field.path) ?? 'x') : typeof before === 'string' ? before + 'x' : typeof before === 'number' ? before + 1 : !before;
      assert.equal(mayChangeField(role, { path: field.path.split('.'), before, after, kind: after && typeof after === 'object' ? 'structure' : 'value' }), true, field.path);
    }
    assert.equal(paths.has('basePath'), false);
    assert.equal(paths.has('pendientes.0'), false);
    const expected = new Set();
    function visit(value, parts) {
      if (Array.isArray(value)) return value.forEach((item, index) => visit(item, [...parts, String(index)]));
      if (value !== null && typeof value === 'object') return Object.entries(value).forEach(([key, item]) => visit(item, [...parts, key]));
      const path = parts.join('.');
      const after = value === null ? (optionalTemplate(path) ?? 'x') : typeof value === 'string' ? value + 'x' : typeof value === 'number' ? value + 1 : !value;
      if (mayChangeField(role, { path: parts, before: value, after, kind: after && typeof after === 'object' ? 'structure' : 'value' })) expected.add(path);
    }
    visit(content, []);
    assert.deepEqual(paths, expected);
  }
});

test('Moderador solo recibe texto y Admin recibe campos visuales y de estado', () => {
  const moderator = editableFields(content, 'moderador');
  assert.ok(moderator.every(field => ['text', 'email'].includes(field.kind)));
  assert.ok(moderator.some(field => field.path === 'galeria.0.alt'));
  assert.ok(moderator.some(field => field.path === 'oferta.0.items.0'));
  assert.ok(!moderator.some(field => field.path === 'inicio.video.archivo'));
  const admin = editableFields(content, 'admin');
  assert.ok(admin.some(field => field.path === 'inicio.video.archivo' && field.kind === 'media'));
  assert.equal(admin.find(field => field.path === 'inicio.video.archivo').label, 'Video de la portada');
  assert.equal(admin.find(field => field.path === 'inicio.video.poster').label, 'Imagen fija de la portada');
  assert.equal(admin.find(field => field.path === 'inicio.acompanamiento.imagen').label, 'Imagen de acompañamiento');
  assert.ok(admin.some(field => field.path === 'galeria.0.imagenGrande' && field.kind === 'media'));
  assert.ok(admin.some(field => field.path === 'admisiones.matriculaAbierta' && field.kind === 'boolean'));
  assert.ok(admin.some(field => field.path === 'historia' && field.kind === 'optional-structure'));
  assert.ok(admin.some(field => field.path === 'horarioAdministrativo' && field.kind === 'optional-structure'));
  assert.equal(admin.find(field => field.path === 'nombre').label, 'Nombre del colegio');
  assert.equal(admin.find(field => field.path === 'galeria.0.imagen').sectionTitle, 'Galería de fotos: Convivir y descubrir');
  assert.equal(admin.find(field => field.path === 'inicio.tarjetas.0.imagen').sectionTitle, 'Tarjetas de oferta: III Ciclo');
  assert.equal(moderator.find(field => field.path === 'paginas.conocenos.titulo').group, 'institucion');
  assert.equal(moderator.find(field => field.path === 'paginas.noticias.descripcionBuscadores').group, 'noticias');
  assert.equal(admin.find(field => field.path === 'paginas.admisiones.introduccion').label, 'Texto introductorio');
  assert.equal(moderator.find(field => field.path === 'paginas.inicio.ofertaDescripcion').group, 'inicio');
  assert.equal(moderator.find(field => field.path === 'paginas.admisiones.paso2Texto').sectionTitle, 'Pasos de admisión');
  assert.equal(moderator.find(field => field.path === 'paginas.vida.horarioNota').label, 'Nota sobre visitas');
  assert.equal(moderator.find(field => field.path === 'paginas.admisiones.arancelesNota').label, 'Nota sobre la reserva');
  assert.equal(moderator.find(field => field.path === 'paginas.contacto.visitasNota').group, 'contacto');
  assert.equal(moderator.find(field => field.path === 'paginas.contacto.llamarEnlace').sectionTitle, 'Formas de contacto');
  assert.equal(moderator.find(field => field.path === 'paginas.contacto.mapaEnlace').sectionTitle, 'Ubicación y horario');
  assert.equal(moderator.find(field => field.path === 'paginas.pie.facebookEnlace').label, 'Enlace de Facebook');
  assert.equal(moderator.find(field => field.path === 'paginas.vida.galeriaAviso').label, 'Aviso de las fotografías');
  assert.equal(moderator.find(field => field.path === 'paginas.pie.contactoTitulo').sectionTitle, 'Pie de página');
  assert.equal(moderator.find(field => field.path === 'paginas.pie.horarioTitulo').group, 'contacto');
  assert.equal(moderator.find(field => field.path === 'paginas.navegacion.quienesSubmenu').sectionTitle, 'Nombre, menú y avisos');
  assert.equal(moderator.find(field => field.path === 'paginas.navegacion.quienesSubmenu').group, 'menu');
  assert.equal(moderator.find(field => field.path === 'paginas.navegacion.marcaNombre').label, 'Nombre junto al logotipo');
  assert.equal(moderator.find(field => field.path === 'paginas.navegacion.consultarTemaEnlace').group, 'menu');
  assert.equal(moderator.find(field => field.path === 'paginas.lumi.costosPregunta').sectionTitle, 'Costos y reserva');
  assert.equal(moderator.find(field => field.path === 'paginas.lumi.requisitosDespues').group, 'lumi');
  assert.equal(moderator.find(field => field.path === 'paginas.lumi.visitaNota').label, 'Aviso sobre coordinación');
  assert.equal(moderator.find(field => field.path === 'paginas.lumi.launcherSign').sectionTitle, 'Acceso a Lumi');
  assert.equal(moderator.find(field => field.path === 'paginas.lumi.advisorAnswer').sectionTitle, 'Consulta con asesor');
  assert.equal(moderator.find(field => field.path === 'paginas.lumi.welcome').sectionTitle, 'Ventana y mensajes');
  assert.equal(moderator.find(field => field.path === 'paginas.error404.volverEnlace').group, 'menu');
  assert.equal(moderator.find(field => field.path === 'paginas.error404.titulo').sectionTitle, 'Página no encontrada');
  assert.equal(moderator.find(field => field.path === 'paginas.inicio.tituloPestana').label, 'Título de la pestaña del navegador');
  assert.equal(moderator.find(field => field.path === 'paginas.pie.aviso').label, 'Aviso del pie de página');
  assert.equal(moderator.find(field => field.path === 'paginas.conocenos.llamadaTexto').label, 'Texto de la invitación');
  assert.equal(moderator.find(field => field.path === 'paginas.vida.serviciosAntetitulo').group, 'vida');
  assert.equal(moderator.find(field => field.path === 'paginas.conocenos.misionTitulo').label, 'Título de misión');
  assert.equal(moderator.find(field => field.path === 'paginas.contacto.atencionTitulo').group, 'contacto');
  assert.equal(moderator.find(field => field.path === 'paginas.admisiones.arancelesNota').sectionTitle, 'Costos y aranceles');
  assert.equal(moderator.find(field => field.path === 'paginas.admisiones.consultaTexto').sectionTitle, 'Formulario de consulta');
  assert.equal(moderator.find(field => field.path === 'paginas.admisiones.formNombre').sectionTitle, 'Formulario de consulta');
  assert.equal(moderator.find(field => field.path === 'paginas.admisiones.formEnviar').label, 'Botón para abrir WhatsApp');
  assert.equal(moderator.find(field => field.path === 'paginas.admisiones.formWhatsappNombre').sectionTitle, 'Formulario de consulta');
  assert.equal(moderator.find(field => field.path === 'paginas.admisiones.arancelesPanelTitulo').sectionTitle, 'Costos y aranceles');
  assert.equal(moderator.find(field => field.path === 'paginas.opiniones.verificadasIntroduccion').sectionTitle, 'Opiniones verificadas');
  assert.equal(moderator.find(field => field.path === 'paginas.opiniones.invitacionInstagramTexto').sectionTitle, 'Invitación a Instagram');
  assert.equal(moderator.find(field => field.path === 'paginas.opiniones.recomendacionSinNotaAviso').sectionTitle, 'Opiniones verificadas');
  assert.equal(moderator.find(field => field.path === 'paginas.opiniones.ejemploEtiqueta').sectionTitle, 'Muestra de opiniones');
  assert.equal(moderator.find(field => field.path === 'paginas.inicio.videoPausar').sectionTitle, 'Textos del video');
  assert.equal(moderator.find(field => field.path === 'paginas.inicio.imagenOfertaAviso').sectionTitle, 'Notas de las imágenes');
  assert.equal(moderator.find(field => field.path === 'paginas.opiniones.reanudarCarrusel').label, 'Botón para reanudar opiniones');
});

test('lectura y escritura de rutas conservan la estructura del documento', () => {
  const copy = structuredClone(content);
  writePath(copy, 'oferta.0.items.0', 'Nueva asignatura');
  assert.equal(readPath(copy, 'oferta.0.items.0'), 'Nueva asignatura');
  assert.equal(readPath(content, 'oferta.0.items.0'), 'Español');
  assert.deepEqual(optionalTemplate('historia'), { resumen: '', parrafos: [''] });
});

test('Noticias presenta campos claros y reserva fecha e imagen para Admin', () => {
  const draft = structuredClone(content);
  draft.publicaciones.push({ ...NEWS_TEMPLATE, id: '11111111-1111-4111-8111-111111111111', fecha: '2026-11-27', titulo: 'Visita al colegio' });
  const admin = editableFields(draft, 'admin');
  const moderator = editableFields(draft, 'moderador');
  assert.equal(admin.find(field => field.path === 'publicaciones.0.titulo').sectionTitle, 'Noticia: Visita al colegio');
  assert.equal(admin.find(field => field.path === 'publicaciones.0.fecha').kind, 'date');
  assert.equal(admin.find(field => field.path === 'publicaciones.0.imagen').kind, 'media');
  assert.ok(moderator.some(field => field.path === 'publicaciones.0.texto' && field.group === 'noticias'));
  assert.ok(!moderator.some(field => ['publicaciones.0.fecha', 'publicaciones.0.imagen'].includes(field.path)));
});
