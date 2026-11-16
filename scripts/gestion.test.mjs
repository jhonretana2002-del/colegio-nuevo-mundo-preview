import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateDraft} from '../admin/validacion.mjs';
const original=JSON.parse(await readFile(new URL('../contenido/colegio.json',import.meta.url),'utf8'));
test('los datos actuales mantienen montos pendientes y son un borrador válido',()=>assert.deepEqual(validateDraft(original),[]));
test('no permite exportar un arancel sin curso lectivo',()=>{const data=structuredClone(original);data.admisiones.aranceles[0].monto=100;assert.ok(validateDraft(data).some(text=>text.includes('curso lectivo')));});
test('cero conserva su significado y los montos negativos se rechazan',()=>{const data=structuredClone(original);data.admisiones.cursoLectivo='2027';data.admisiones.aranceles[0].monto=0;assert.deepEqual(validateDraft(data),[]);data.admisiones.aranceles[0].monto=-1;assert.ok(validateDraft(data).length);});
test('rechaza contacto inválido y listas vacías',()=>{const data=structuredClone(original);data.contacto.correo='incorrecto';data.contacto.whatsapp.numero='texto';data.oferta[0].items=[];assert.equal(validateDraft(data).length,3);});
