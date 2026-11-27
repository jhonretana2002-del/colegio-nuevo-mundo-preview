import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderHome } from './plantillas-portada.mjs';

const configured = JSON.parse(await readFile(new URL('../contenido/colegio.json', import.meta.url), 'utf8'));
const helpers = {
  e: value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
  url: value => String(value),
  link: (href, label) => `<a href="${href}">${label}</a>`,
  external: (href, label) => `<a href="${href}">${label}</a>`,
  form: '<form></form>',
};

test('los textos del video y las imágenes de portada salen del contenido editable', () => {
  const draft = structuredClone(configured);
  Object.assign(draft.paginas.inicio, {
    videoPausar: 'Detener video',
    videoError: 'Revise la reproducción.',
    imagenOfertaAviso: 'Fotos ilustrativas.',
    imagenMatriculaAviso: 'Imagen de muestra.',
  });
  const html = renderHome(draft, helpers);
  assert.ok(html.includes('data-pause="Detener video"'));
  assert.ok(html.includes('data-error="Revise la reproducción."'));
  assert.ok(html.includes('<p class="image-note">Fotos ilustrativas.</p>'));
  assert.ok(html.includes('<p class="matricula-image-note">Imagen de muestra.</p>'));
});
