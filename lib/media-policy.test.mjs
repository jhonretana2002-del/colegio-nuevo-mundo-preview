import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { invalidMediaChanges } from './media-policy.mjs';

const before = JSON.parse(await readFile(new URL('../contenido/colegio.json', import.meta.url), 'utf8'));
const available = JSON.parse(await readFile(new URL('../contenido/medios-disponibles.json', import.meta.url), 'utf8'));

test('catálogo de medios contiene archivos existentes y sin rutas peligrosas', async () => {
  for (const item of available) {
    assert.match(item, /^[a-zA-Z0-9/_-]+\.(?:mp4|jpg|jpeg|png|webp)$/);
    await access(new URL(`../${item}`, import.meta.url));
  }
  assert.equal(new Set(available).size, available.length);
});

test('Admin solo puede referenciar un medio local disponible y del tipo correcto', () => {
  const after = structuredClone(before);
  after.inicio.acompanamiento.imagen = 'estudiantes-480.webp';
  assert.deepEqual(invalidMediaChanges(before, after, available), []);
  after.inicio.acompanamiento.imagen = '../otro.webp';
  assert.deepEqual(invalidMediaChanges(before, after, available), ['inicio.acompanamiento.imagen']);
  after.inicio.acompanamiento.imagen = 'assets/portada/portada-optimizada.mp4';
  assert.deepEqual(invalidMediaChanges(before, after, available), ['inicio.acompanamiento.imagen']);
  after.inicio.acompanamiento.imagen = before.inicio.acompanamiento.imagen;
  after.galeria.push({ ...before.galeria[0], imagen: 'fuera.webp' });
  assert.deepEqual(invalidMediaChanges(before, after, available), ['galeria.3.imagen']);
});

test('Noticias admite una imagen opcional pero exige que la elegida esté disponible', () => {
  const after = structuredClone(before);
  const article = { id: '11111111-1111-4111-8111-111111111111', fecha: '2026-11-27', titulo: 'Actividad', resumen: 'Resumen', texto: 'Detalle', imagen: null, alt: '' };
  after.publicaciones.push(article);
  assert.deepEqual(invalidMediaChanges(before, after, available), []);
  article.imagen = 'estudiantes-480.webp';
  assert.deepEqual(invalidMediaChanges(before, after, available), []);
  article.imagen = 'imagen-inexistente.webp';
  assert.deepEqual(invalidMediaChanges(before, after, available), ['publicaciones.0.imagen']);
});
