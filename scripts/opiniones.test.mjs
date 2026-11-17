import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderOpinions} from './plantillas-opiniones.mjs';
const data=JSON.parse(await readFile(new URL('../contenido/colegio.json',import.meta.url),'utf8'));
const helpers={e:s=>String(s),external:(url,text)=>`<a href="${url}">${text}</a>`};
test('no inventa texto, estrellas o condición de padre para una recomendación sin comentario',()=>{
 const html=renderOpinions(data,helpers);
 assert.ok(html.includes('Mario AZ')&&html.includes('6 de octubre de 2016'));
 assert.ok(html.includes('sin comentario escrito'));
 assert.ok(!html.includes('★★★★★')&&!html.includes('padre de familia'));
 assert.ok(html.includes('aria-hidden="true"')&&html.includes('tabindex="-1"'));
});
test('ignora recomendaciones no verificadas y exige fuentes de las verificadas',()=>{
 const draft=structuredClone(data);draft.opiniones[0].verificada=false;
 assert.ok(!renderOpinions(draft,helpers).includes('Mario AZ'));
 draft.opiniones[0].verificada=true;draft.opiniones[0].fuente='';
 assert.throws(()=>renderOpinions(draft,helpers));
});
