import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContentChange } from '../lib/content-policy.mjs';

const source = JSON.parse(await readFile(new URL('../contenido/colegio.json', import.meta.url), 'utf8'));
const edit = mutator => { const copy = structuredClone(source); mutator(copy); return copy; };

test('Moderador puede modificar texto existente en varias secciones', () => {
  const next = edit(data => {
    data.mision = 'Misión revisada';
    data.inicio.titulo[0] = 'Aprender juntos';
    data.galeria[0].alt = 'Descripción accesible';
  });
  assert.deepEqual(validateContentChange('moderador', source, next).rejected, []);
});

test('Moderador puede corregir textos de páginas sin alterar su estructura', () => {
  const next = edit(data => {
    data.paginas.inicio.ofertaDescripcion = 'Conozca nuestras áreas educativas.';
    data.paginas.admisiones.paso2Texto = 'Prepare la documentación necesaria.';
  });
  assert.equal(validateContentChange('moderador', source, next).allowed, true);
  next.paginas.admisiones.paso4Texto = 'Paso nuevo';
  assert.equal(validateContentChange('moderador', source, next).allowed, false);
});

test('Moderador puede actualizar avisos de admisión y el pie sin cambiar configuración', () => {
  const next = edit(data => {
    data.paginas.admisiones.calendarioPendiente = 'Confirme las fechas con el colegio.';
    data.lema = 'Aprender hoy, crecer mañana.';
  });
  assert.equal(validateContentChange('moderador', source, next).allowed, true);
  next.publicUrl = 'https://otro.example/';
  assert.equal(validateContentChange('moderador', source, next).allowed, false);
});

test('Moderador no puede cambiar medio, estado, dato técnico ni estructura', () => {
  const next = edit(data => {
    data.inicio.video.archivo = 'otro.mp4';
    data.admisiones.matriculaAbierta = true;
    data.contacto.telefonos[0].numero = '+50612345678';
    data.galeria.push(structuredClone(data.galeria[0]));
  });
  const result = validateContentChange('moderador', source, next);
  assert.equal(result.allowed, false);
  assert.deepEqual(result.rejected, ['contacto.telefonos.0.numero', 'galeria', 'admisiones.matriculaAbierta', 'inicio.video.archivo']);
});

test('Admin puede sustituir medios y listas, sin cambiar configuración de despliegue', () => {
  const next = edit(data => {
    data.inicio.video.archivo = 'assets/portada/nuevo.mp4';
    data.oferta[0].items.push('Nueva asignatura');
  });
  assert.equal(validateContentChange('admin', source, next).allowed, true);
  next.basePath = '/otro-sitio/';
  assert.deepEqual(validateContentChange('admin', source, next).rejected, ['basePath']);
});

test('Admin no puede inyectar propiedades desconocidas ni alterar estructuras fijas', () => {
  const next = edit(data => {
    data.inicio.tarjetas[0].estilo = 'otro';
    data.inicio.titulo.push('cuarta línea');
  });
  assert.deepEqual(validateContentChange('admin', source, next).rejected,
    ['inicio.titulo', 'inicio.tarjetas.0.estilo']);
});

test('Una identidad desconocida no puede modificar nada', () => {
  assert.equal(validateContentChange('visitante', source, edit(data => { data.mision = 'X'; })).allowed, false);
  assert.equal(validateContentChange('visitante', source, structuredClone(source)).allowed, false);
});

test('Rechaza sustitución de texto por número y elementos de lista mal formados', () => {
  const next = edit(data => {
    data.mision = 4;
    data.galeria.push({ imagen: 'foto.webp' });
  });
  const result = validateContentChange('admin', source, next);
  assert.equal(result.allowed, false);
  assert.ok(result.shapeErrors.some(error => error.startsWith('mision:')));
  assert.ok(result.shapeErrors.some(error => error.includes('galeria.3.titulo')));
});

test('Campos nulos conocidos aceptan su tipo esperado', () => {
  const next = edit(data => {
    data.admisiones.cursoLectivo = '2027';
    data.admisiones.aranceles[0].monto = 50000;
  });
  assert.equal(validateContentChange('admin', source, next).allowed, true);
});

test('Campos nulos con estructura exigen la forma prevista', () => {
  const next = edit(data => { data.historia = { resumen: 'Origen', parrafos: ['Primer año'] }; });
  assert.equal(validateContentChange('admin', source, next).allowed, true);
  next.historia.codigo = '<script>';
  assert.equal(validateContentChange('admin', source, next).allowed, false);
});

test('Moderador puede completar un texto nulo, pero no un medio nulo', () => {
  const next = edit(data => { data.opiniones[0].texto = 'Comentario verificado'; });
  assert.equal(validateContentChange('moderador', source, next).allowed, true);
  next.contacto.mapaEmbed = 'https://example.com/mapa';
  assert.equal(validateContentChange('moderador', source, next).allowed, false);
});

test('Admin no puede duplicar identificadores de tarjetas', () => {
  const next = edit(data => { data.inicio.tarjetas.push(structuredClone(data.inicio.tarjetas[0])); });
  const result = validateContentChange('admin', source, next);
  assert.equal(result.allowed, false);
  assert.ok(result.shapeErrors.some(error => error.includes('identificadores')));
});

test('Admin gestiona noticias y Moderador corrige solo su texto', () => {
  const article = { id: '11111111-1111-4111-8111-111111111111', fecha: '2026-11-27', titulo: 'Actividad', resumen: 'Resumen', texto: 'Detalle', imagen: null, alt: '' };
  const withNews = edit(data => { data.publicaciones.push(article); });
  assert.equal(validateContentChange('admin', source, withNews).allowed, true);
  assert.equal(validateContentChange('moderador', source, withNews).allowed, false);
  const corrected = structuredClone(withNews);
  corrected.publicaciones[0].titulo = 'Nueva actividad';
  corrected.publicaciones[0].texto = 'Detalle corregido';
  assert.equal(validateContentChange('moderador', withNews, corrected).allowed, true);
  corrected.publicaciones[0].fecha = '2026-11-28';
  assert.equal(validateContentChange('moderador', withNews, corrected).allowed, false);
  corrected.publicaciones[0].fecha = article.fecha;
  corrected.publicaciones[0].imagen = 'estudiantes-480.webp';
  assert.equal(validateContentChange('moderador', withNews, corrected).allowed, false);
});
