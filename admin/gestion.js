import {validateDraft} from './validacion.mjs';
const $=id=>document.getElementById(id);
const groups=[
 ['Inicio','Un mensaje breve para orientar a las familias. El material multimedia definitivo requiere autorización.',[['inicio.antetitulo','Frase superior'],['inicio.titulo.0','Título · primera línea'],['inicio.titulo.1','Título · segunda línea'],['inicio.titulo.2','Título · tercera línea'],['inicio.descripcion','Descripción de portada','text'],['inicio.introduccion.titulo','Título de presentación'],['inicio.introduccion.texto','Presentación breve','text']]],
 ['Conócenos','Las modificaciones de los textos institucionales deben ser revisadas por Dirección.',[['nombre','Nombre del colegio'],['quienesSomos','Quiénes somos','text'],['mision','Misión','text'],['vision','Visión','text']]],
 ['Contacto','Los datos se reutilizan en el pie de página y en Lumi.',[['contacto.direccion','Dirección','text'],['contacto.telefonos.0.texto','Teléfono principal · texto visible'],['contacto.telefonos.0.numero','Teléfono principal · número para llamar'],['contacto.correo','Correo electrónico','email'],['contacto.whatsapp.texto','WhatsApp · texto visible'],['contacto.whatsapp.numero','WhatsApp · código de país y número']]],
 ['Oferta educativa','Una asignatura o idioma por línea. Confirme su alcance con el colegio.',[]],
 ['Admisiones','Deje los montos pendientes vacíos. Registrar un importe requiere indicar el curso lectivo y no acredita su aprobación.',[['admisiones.cursoLectivo','Curso lectivo'],['admisiones.prematricula','Referencia de prematrícula','text'],['admisiones.periodo','Referencia de matrícula','text'],['admisiones.requisitos','Requisitos · uno por línea','list']]]
];
let original,draft,undo,active=0;
const labels=new Map();
const get=(obj,path)=>path.split('.').reduce((value,key)=>value[key],obj);
function set(path,value){const parts=path.split('.');const key=parts.pop();parts.reduce((node,key)=>node[key],draft)[key]=value;}
function make(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
const changes=()=>[...labels].filter(([path])=>JSON.stringify(get(original,path))!==JSON.stringify(get(draft,path)));
function update(){
 $('preview-eyebrow').textContent=draft.inicio.antetitulo;$('preview-title').textContent=draft.inicio.titulo.join('\n');$('preview-description').textContent=draft.inicio.descripcion;
 const n=changes().length;$('state').textContent=n?`${n} ${n===1?"campo modificado":"campos modificados"} · sin guardar`:'Contenido original · sin cambios';$('undo').disabled=!undo;
}
function render(){
 const [title,description,fields]=groups[active];$('section-title').textContent=title;$('section-description').textContent=description;$('fields').replaceChildren();
 document.querySelectorAll('#categories button').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===active)));
 fields.forEach(([path,label,type='short'])=>{
  const box=make('div',undefined,'field');const lab=make('label',label);const input=make(['text','list'].includes(type)?'textarea':'input');input.id='field-'+path.replaceAll('.','-');lab.htmlFor=input.id;
  if(input.tagName==='INPUT')input.type=type==='number'?'number':type==='email'?'email':'text';
  input.value=type==='list'?get(draft,path).join('\n'):get(draft,path)??'';
  if(type==='number'){input.min='0';input.step='any';}
  input.addEventListener('input',()=>{
   undo=structuredClone(draft);let value=input.value;
   if(type==='list')value=value.split('\n').map(s=>s.trim()).filter(Boolean);
   if(type==='number')value=value===''?null:Number(value);
   if(path==='admisiones.cursoLectivo')value=value.trim()||null;
   set(path,value);$('review').hidden=true;update();
  });box.append(lab,input);
  if(type==='number')box.append(make('small','Colones. Vacío: pendiente. Cero: sin costo.'));
  $('fields').append(box);
 });
}
$('form').addEventListener('submit',event=>{
 event.preventDefault();const errors=validateDraft(draft);$('errors').replaceChildren(...errors.map(text=>make('p',text)));$('changes').replaceChildren();
 const items=changes();const display=value=>Array.isArray(value)?value.join('\n'):value??'Pendiente';
 for(const [path,label] of items){const box=make('div',undefined,'change');box.append(make('strong',label),make('p','Original: '+display(get(original,path)),'before'),make('p','Borrador: '+display(get(draft,path))));$('changes').append(box);}
 if(!items.length)$('changes').append(make('p','No hay cambios para descargar.'));
 $('download').disabled=errors.length>0||items.length===0;$('review').hidden=false;$('review-title').focus();
});
$('undo').addEventListener('click',()=>{if(!undo)return;draft=undo;undo=null;$('review').hidden=true;render();update();});
$('download').addEventListener('click',()=>{
 if(validateDraft(draft).length||!changes().length)return;
 const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)+'\n'],{type:'application/json'}));const anchor=make('a');anchor.href=url;anchor.download='colegio-borrador.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('state').textContent='Borrador descargado · pendiente de revisión';
});
try{
 const response=await fetch('../contenido/colegio.json',{cache:'no-store'});if(!response.ok)throw Error();original=await response.json();draft=structuredClone(original);
 original.oferta.forEach((item,i)=>groups[3][2].push([`oferta.${i}.items`,item.titulo,'list']));original.admisiones.aranceles.forEach((fee,i)=>groups[4][2].push([`admisiones.aranceles.${i}.monto`,fee.rubro+' · monto','number']));
 groups.forEach(([title,,fields],i)=>{fields.forEach(([path,label])=>labels.set(path,label));const button=make('button',title);button.type='button';button.setAttribute('aria-controls','form');button.addEventListener('click',()=>{active=i;render();});$('categories').append(button);});
 original.pendientes.forEach(text=>$('pending').append(make('li',text)));$('form').hidden=false;render();update();
}catch{$('state').textContent='No se pudo cargar el contenido. Recargue la página o consulte al administrador.';}
