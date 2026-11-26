import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mayChangeField } from '../lib/content-policy.mjs';
import { editableFields, optionalTemplate, readPath, writePath } from './field-catalog.mjs';

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
  assert.ok(admin.some(field => field.path === 'galeria.0.imagenGrande' && field.kind === 'media'));
  assert.ok(admin.some(field => field.path === 'admisiones.matriculaAbierta' && field.kind === 'boolean'));
  assert.ok(admin.some(field => field.path === 'historia' && field.kind === 'optional-structure'));
  assert.ok(admin.some(field => field.path === 'horarioAdministrativo' && field.kind === 'optional-structure'));
  assert.equal(admin.find(field => field.path === 'nombre').label, 'Nombre del colegio');
  assert.equal(admin.find(field => field.path === 'galeria.0.imagen').sectionTitle, 'Galería de fotos: Convivir y descubrir');
  assert.equal(admin.find(field => field.path === 'inicio.tarjetas.0.imagen').sectionTitle, 'Tarjetas de oferta: III Ciclo');
});

test('lectura y escritura de rutas conservan la estructura del documento', () => {
  const copy = structuredClone(content);
  writePath(copy, 'oferta.0.items.0', 'Nueva asignatura');
  assert.equal(readPath(copy, 'oferta.0.items.0'), 'Nueva asignatura');
  assert.equal(readPath(content, 'oferta.0.items.0'), 'Español');
  assert.deepEqual(optionalTemplate('historia'), { resumen: '', parrafos: [''] });
});
