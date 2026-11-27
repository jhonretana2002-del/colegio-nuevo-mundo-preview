import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { stagePreview } from './stage-preview.mjs';
import { createPreviewServer } from '../scripts/servir-vista-previa.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generated = ['index.html', '404.html', 'institucional-datos.js', 'conocenos/index.html', 'oferta-educativa/index.html', 'vida-en-el-colegio/index.html', 'admisiones/index.html', 'contacto/index.html', 'noticias/index.html'];
const source = JSON.parse(await readFile(path.join(root, 'contenido/colegio.json'), 'utf8'));

async function workspace(t) {
  const folder = await mkdtemp(path.join(tmpdir(), 'cnm-preview-'));
  t.after(async () => {
    if (folder.startsWith(path.resolve(tmpdir()) + path.sep)) await rm(folder, { recursive: true, force: true });
  });
  return folder;
}

test('la vista previa actual conserva el contenido de todos los archivos generados', async t => {
  const folder = await workspace(t);
  const outputRoot = path.join(folder, 'preview');
  await stagePreview({ content: source, outputRoot });
  for (const file of generated) {
    const actual = (await readFile(path.join(outputRoot, file), 'utf8')).replaceAll('\r\n', '\n');
    const expected = (await readFile(path.join(root, file), 'utf8')).replaceAll('\r\n', '\n');
    assert.equal(actual, expected, file);
  }
  assert.ok((await readFile(path.join(outputRoot, 'assets/portada/portada-poster.jpg'))).length > 0);
  await assert.rejects(stagePreview({ content: source, outputRoot }), /ya existe/);
});

test('los cambios de texto solo aparecen en la salida aislada', async t => {
  const folder = await workspace(t);
  const outputRoot = path.join(folder, 'preview');
  const changed = structuredClone(source);
  changed.presentacion += ' Revisión de prueba.';
  const current = await readFile(path.join(root, 'index.html'));
  await stagePreview({ content: changed, outputRoot });
  assert.match(await readFile(path.join(outputRoot, 'index.html'), 'utf8'), /Revisión de prueba/);
  assert.deepEqual(await readFile(path.join(root, 'index.html')), current);
});

test('las etiquetas de admisión editadas aparecen en Inicio y Admisiones sin tocar el sitio actual', async t => {
  const folder = await workspace(t);
  const changed = structuredClone(source);
  changed.paginas.admisiones.formNombre = 'Nombre de la persona encargada';
  changed.paginas.admisiones.formWhatsappNombre = 'Persona encargada:';
  changed.paginas.admisiones.arancelesPanelTitulo = 'Costos del colegio';
  const outputRoot = path.join(folder, 'preview');
  await stagePreview({ content: changed, outputRoot });
  for (const route of ['index.html', 'admisiones/index.html']) {
    assert.match(await readFile(path.join(outputRoot, route), 'utf8'), /Nombre de la persona encargada/);
    assert.doesNotMatch(await readFile(path.join(root, route), 'utf8'), /Nombre de la persona encargada/);
  }
  assert.match(await readFile(path.join(outputRoot, 'institucional-datos.js'), 'utf8'), /"formWhatsappNombre": "Persona encargada:"/);
  assert.match(await readFile(path.join(outputRoot, 'admisiones/index.html'), 'utf8'), /Costos del colegio/);
});

test('el formulario escapa HTML en textos editados y en los datos para WhatsApp', async t => {
  const folder = await workspace(t);
  const changed = structuredClone(source);
  changed.paginas.admisiones.formNombre = '<img src=x onerror=alert(1)>';
  changed.paginas.admisiones.formWhatsappNombre = '<script>alert(1)</script>';
  const outputRoot = path.join(folder, 'preview');
  await stagePreview({ content: changed, outputRoot });
  const page = await readFile(path.join(outputRoot, 'admisiones/index.html'), 'utf8');
  const data = await readFile(path.join(outputRoot, 'institucional-datos.js'), 'utf8');
  assert.match(page, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(page, /<img src=x onerror=alert\(1\)>/);
  assert.match(data, /\\u003cscript>/);
  assert.doesNotMatch(data, /<script>alert\(1\)<\/script>/);
});

test('Contacto y los enlaces compartidos reflejan textos editados sin alterar las páginas actuales', async t => {
  const folder = await workspace(t);
  const changed = structuredClone(source);
  changed.paginas.contacto.llamarEnlace = 'Marcar ahora';
  changed.paginas.contacto.mapaEnlace = 'Ver el mapa';
  changed.paginas.pie.facebookEnlace = 'Nuestra comunidad en Facebook';
  changed.paginas.vida.galeriaAviso = 'Fotografías de muestra para revisión.';
  changed.paginas.conocenos.verOfertaEnlace = 'Explorar las áreas educativas';
  const outputRoot = path.join(folder, 'preview');
  await stagePreview({ content: changed, outputRoot });
  assert.match(await readFile(path.join(outputRoot, 'contacto/index.html'), 'utf8'), /Marcar ahora →/);
  assert.match(await readFile(path.join(outputRoot, 'contacto/index.html'), 'utf8'), /Ver el mapa/);
  assert.match(await readFile(path.join(outputRoot, 'vida-en-el-colegio/index.html'), 'utf8'), /Fotografías de muestra para revisión/);
  assert.match(await readFile(path.join(outputRoot, 'index.html'), 'utf8'), /Nuestra comunidad en Facebook/);
  assert.match(await readFile(path.join(outputRoot, 'conocenos/index.html'), 'utf8'), /Explorar las áreas educativas/);
  assert.doesNotMatch(await readFile(path.join(root, 'contacto/index.html'), 'utf8'), /Marcar ahora/);
});

test('la marca, la ruta de navegación y la consulta cambian desde el panel y escapan HTML', async t => {
  const folder = await workspace(t);
  const changed = structuredClone(source);
  changed.paginas.navegacion.marcaNombre = 'OTRO NOMBRE';
  changed.paginas.navegacion.marcaAria = 'Otro colegio, inicio';
  changed.paginas.navegacion.navAria = 'Menú del colegio';
  changed.paginas.navegacion.inicioEnlace = 'Portada';
  changed.paginas.navegacion.consultarTemaEnlace = 'Preguntar por esta área';
  const outputRoot = path.join(folder, 'preview');
  await stagePreview({ content: changed, outputRoot });
  const home = await readFile(path.join(outputRoot, 'index.html'), 'utf8');
  const offer = await readFile(path.join(outputRoot, 'oferta-educativa/index.html'), 'utf8');
  const life = await readFile(path.join(outputRoot, 'vida-en-el-colegio/index.html'), 'utf8');
  assert.match(home, /<strong>OTRO NOMBRE<\/strong>/);
  assert.match(home, /aria-label="Otro colegio, inicio"/);
  assert.match(home, /aria-label="Menú del colegio"/);
  assert.match(offer, /<a href="\/colegio-nuevo-mundo-preview\/">Portada<\/a> \/ /);
  assert.match(life, /Preguntar por esta área/);
  assert.doesNotMatch(await readFile(path.join(root, 'index.html'), 'utf8'), /OTRO NOMBRE/);
});

test('Lumi usa las frases editadas y conserva requisitos y costos tomados del contenido', async t => {
  const folder = await workspace(t);
  const changed = structuredClone(source);
  changed.paginas.lumi.matriculaPregunta = '¿Cómo puedo comenzar?';
  changed.paginas.lumi.requisitosAntes = 'Documentos de referencia:';
  changed.paginas.lumi.costosPendiente = 'monto por confirmar';
  changed.paginas.lumi.visitaNota = 'Coordine la visita con el equipo.';
  changed.admisiones.requisitos[0] = 'Documento actualizado';
  const outputRoot = path.join(folder, 'preview');
  await stagePreview({ content: changed, outputRoot });
  const generated = await readFile(path.join(outputRoot, 'institucional-datos.js'), 'utf8');
  assert.match(generated, /¿Cómo puedo comenzar\?/);
  assert.match(generated, /Documentos de referencia: Documento actualizado/);
  assert.match(generated, /monto por confirmar/);
  assert.match(generated, /Coordine la visita con el equipo\./);
  assert.doesNotMatch(await readFile(path.join(root, 'institucional-datos.js'), 'utf8'), /¿Cómo puedo comenzar\?/);
});

test('la ventana de Lumi muestra textos editados y escapa el contenido de la plantilla', async t => {
  const folder = await workspace(t);
  const changed = structuredClone(source);
  changed.paginas.lumi.launcherSign = 'Conversemos';
  changed.paginas.lumi.heading1 = 'Una consulta clara';
  changed.paginas.lumi.closeAria = 'Cerrar <Lumi>';
  changed.paginas.lumi.advisorAnswer = 'Esta conversación es una demostración.';
  const outputRoot = path.join(folder, 'preview');
  await stagePreview({ content: changed, outputRoot });
  const page = await readFile(path.join(outputRoot, 'index.html'), 'utf8');
  const data = await readFile(path.join(outputRoot, 'institucional-datos.js'), 'utf8');
  assert.match(page, /<span class="lumi-sign" aria-hidden="true">Conversemos<\/span>/);
  assert.match(page, /<h3>Una consulta clara<br>empieza aquí\.<\/h3>/);
  assert.match(page, /aria-label="Cerrar &lt;Lumi&gt;"/);
  assert.doesNotMatch(page, /\{\{lumi\./);
  assert.match(data, /"advisorAnswer": "Esta conversación es una demostración\."/);
  assert.doesNotMatch(await readFile(path.join(root, 'index.html'), 'utf8'), /Una consulta clara/);
});

test('copia un medio aprobado y verifica su hash antes de generar', async t => {
  const folder = await workspace(t);
  const mediaRoot = path.join(folder, 'media');
  await mkdir(mediaRoot);
  const name = '11111111-1111-4111-8111-111111111111.webp';
  const key = `uploads/${name}`;
  const bytes = await readFile(path.join(root, source.inicio.acompanamiento.imagen));
  await writeFile(path.join(mediaRoot, name), bytes);
  const changed = structuredClone(source);
  changed.inicio.acompanamiento.imagen = key;
  const mediaRecords = [{ storage_key: key, checksum_sha256: createHash('sha256').update(bytes).digest() }];
  const outputRoot = path.join(folder, 'preview');
  const result = await stagePreview({ content: changed, outputRoot, mediaRoot, mediaRecords });
  assert.equal(result.uploadedMedia, 1);
  assert.deepEqual(await readFile(path.join(outputRoot, key)), bytes);
  assert.match(await readFile(path.join(outputRoot, 'index.html'), 'utf8'), /uploads\/11111111/);
  const badOutput = path.join(folder, 'bad');
  await assert.rejects(stagePreview({ content: changed, outputRoot: badOutput, mediaRoot, mediaRecords: [{ storage_key: key, checksum_sha256: Buffer.alloc(32) }] }), /no coincide/);
  await assert.rejects(access(badOutput), { code: 'ENOENT' });
});

test('la vista previa local sirve páginas y recursos solo bajo el prefijo del sitio', async t => {
  const folder = await workspace(t);
  const outputRoot = path.join(folder, 'preview');
  await stagePreview({ content: source, outputRoot });
  const server = createPreviewServer(outputRoot, source.basePath);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(origin + source.basePath);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Colegio Nuevo Mundo/);
  const style = await fetch(origin + source.basePath + 'portada.css');
  assert.equal(style.status, 200);
  assert.match(style.headers.get('content-type'), /text\/css/);
  const media = await fetch(origin + source.basePath + source.inicio.video.archivo, { headers: { Range: 'bytes=0-3' } });
  assert.equal(media.status, 206);
  assert.equal((await media.arrayBuffer()).byteLength, 4);
  assert.equal((await fetch(origin + '/admin/')).status, 404);
  assert.equal((await fetch(origin + source.basePath + '.env')).status, 404);
});
