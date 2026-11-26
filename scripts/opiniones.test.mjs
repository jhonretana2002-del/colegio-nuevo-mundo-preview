import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderOpinions} from './plantillas-opiniones.mjs';
const configured=JSON.parse(await readFile(new URL('../contenido/colegio.json',import.meta.url),'utf8'));
const data={...configured,presentacionOpiniones:{modo:'verificadas'}};
const helpers={e:s=>String(s),external:(url,text)=>`<a href="${url}">${text}</a>`};
test('no inventa texto, estrellas o condición de padre para una recomendación sin comentario',()=>{
 const html=renderOpinions(data,helpers);
 assert.ok(html.includes('Mario AZ')&&html.includes('6 de octubre de 2016'));
 assert.ok(html.includes('sin comentario escrito'));
 assert.ok(!html.includes('★★★★★')&&!html.includes('padre de familia'));
 assert.ok(html.includes('aria-hidden="true"')&&html.includes('tabindex="-1"'));
 assert.ok(html.includes('opinion-recommend-star')&&html.includes('sin nota numérica'));
 assert.ok(!html.includes('5 / 5'));
});
test('presenta una nota numérica solo cuando está informada y rechaza escalas inválidas',()=>{
 const draft=structuredClone(data);Object.assign(draft.opiniones[0],{puntuacion:4,escala:5});
 assert.ok(renderOpinions(draft,helpers).includes('4 / 5'));
 draft.opiniones[0].puntuacion=6;assert.throws(()=>renderOpinions(draft,helpers));
});
test('ignora recomendaciones no verificadas y exige fuentes de las verificadas',()=>{
 const draft=structuredClone(data);draft.opiniones[0].verificada=false;
 assert.ok(!renderOpinions(draft,helpers).includes('Mario AZ'));
 draft.opiniones[0].verificada=true;draft.opiniones[0].fuente='';
 assert.throws(()=>renderOpinions(draft,helpers));
});

test('las cinco estrellas ficticias se identifican en cada tarjeta y no se atribuyen a redes sociales',()=>{
 const html=renderOpinions(configured,helpers);
 assert.ok(html.includes('★★★★★')&&html.includes('no corresponden a testimonios reales'));
 assert.equal((html.match(/Reseña de ejemplo · nombre ficticio/g)||[]).length,6);
 assert.ok(!html.includes('Recomendación pública')&&!html.includes('Ver recomendación original'));
});

test('textos editoriales cambian en ambos modos sin quitar avisos de procedencia',()=>{
 const verified=structuredClone(data);
 verified.paginas.opiniones.invitacionFacebookTitulo='Comparta su experiencia con otras familias.';
 const verifiedHtml=renderOpinions(verified,helpers);
 assert.ok(verifiedHtml.includes('Comparta su experiencia con otras familias.'));
 assert.ok(verifiedHtml.includes('sin nota numérica'));
 const examples=structuredClone(configured);
 examples.paginas.opiniones.ejemplosIntroduccion='Así aparecerá una muestra de diseño.';
 const exampleHtml=renderOpinions(examples,helpers);
 assert.ok(exampleHtml.includes('Así aparecerá una muestra de diseño.'));
 assert.ok(exampleHtml.includes('Reseña de ejemplo · nombre ficticio'));
});
