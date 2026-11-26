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
});
