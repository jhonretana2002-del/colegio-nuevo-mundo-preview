import {validateDraft} from './validacion.mjs';
import {GROUPS, editableFields, optionalTemplate, readPath, writePath} from './field-catalog.mjs';
import {invalidMediaChanges} from '../lib/media-policy.mjs';
const $=id=>document.getElementById(id);
let original,draft,undo,active=0,privateMode=false,csrfToken=null,documentId=null,version=null,role='admin',fields=[];
let availableMedia=[];
const labels=new Map();
const get=readPath;
function set(path,value){writePath(draft,path,value);}
function make(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
const changes=()=>[...labels].filter(([path])=>JSON.stringify(get(original,path))!==JSON.stringify(get(draft,path)));
const reviewErrors=()=>[
 ...validateDraft(draft),
 ...invalidMediaChanges(original,draft,availableMedia.map(item=>item.storageKey)).map(path=>`Revise el archivo elegido para «${labels.get(path)??path}».`),
];
function mediaLabel(item){
 if(item.storageKey.startsWith('uploads/'))return item.mimeType==='video/mp4'?'Video nuevo':'Imagen nueva';
 if(item.storageKey.includes('portada-optimizada'))return 'Video actual de portada';
 if(item.storageKey.includes('portada-poster'))return 'Imagen actual de portada';
 const name=item.storageKey.split('/').at(-1).replace(/\.[^.]+$/,'').replace(/-(640|960|1280|480)$/,'').replaceAll('-',' ');
 const size=/-(640|960|1280|480)\./.exec(item.storageKey)?.[1];
 return `${name[0].toUpperCase()+name.slice(1)}${size?` · ${size} px`:''}`;
}
function previewUrl(item){return item?.previewUrl??(item?original.basePath+item.storageKey:null);}
async function uploadFile(file,path,select,preview){
 if(!privateMode||role!=='admin'||!file)return;
 const extension=file.name.split('.').at(-1).toLowerCase();
 const mime=file.type||({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp4:'video/mp4'}[extension]);
 const video=path.endsWith('.archivo');
 if(!mime||(video?mime!=='video/mp4':!['image/jpeg','image/png','image/webp'].includes(mime))){$('state').textContent=video?'Seleccione un video MP4.':'Seleccione una imagen JPG, PNG o WebP.';return;}
 if(file.size>(video?100:12)*1024*1024){$('state').textContent=video?'El video no puede superar 100 MB.':'La imagen no puede superar 12 MB.';return;}
 $('state').textContent='Subiendo archivo…';
 try{
  const response=await fetch('/api/media',{method:'POST',headers:{'Content-Type':mime,'X-CSRF-Token':csrfToken},body:file});
  if(response.status===401){showLogin();return;}
  const result=await response.json();
  if(!response.ok){$('state').textContent=result.error??'No se pudo subir el archivo.';return;}
  availableMedia.push(result);const option=make('option',mediaLabel(result));option.value=result.storageKey;select.append(option);
  undo=structuredClone(draft);set(path,result.storageKey);select.value=result.storageKey;preview.src=previewUrl(result);$('review').hidden=true;update();
  $('state').textContent='Archivo listo. Revise y guarde el borrador para usarlo.';
 }catch{$('state').textContent='No se pudo subir el archivo. Intente de nuevo.';}
}
function update(){
 $('preview-eyebrow').textContent=draft.inicio.antetitulo;$('preview-title').textContent=draft.inicio.titulo.join('\n');$('preview-description').textContent=draft.inicio.descripcion;
 const n=changes().length;$('state').textContent=n?`${n} ${n===1?"campo modificado":"campos modificados"} · sin guardar`:(privateMode?'Borrador de trabajo · sin cambios':'Contenido original · sin cambios');$('undo').disabled=!undo;
}
function render(focusSection=null){
 fields=editableFields(draft,role);for(const field of fields)labels.set(field.path,field.label);
 const group=GROUPS[active];$('section-title').textContent=group.title;$('section-description').textContent=group.description;$('fields').replaceChildren();
 document.querySelectorAll('#categories button').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===active)));
 const sections=new Map();
 fields.filter(field=>field.group===group.id).forEach(({path,label,kind,section,sectionTitle})=>{
  if(!sections.has(section)){
   const details=make('details',undefined,'editor-group');details.open=section===focusSection||(focusSection===null&&sections.size===0);
   details.append(make('summary',sectionTitle));$('fields').append(details);sections.set(section,details);
  }
  const target=sections.get(section);
  const box=make('div',undefined,'field');const id='field-'+path.replaceAll('.','-');
  if(kind==='optional-structure'){
   box.append(make('strong',label));const button=make('button',`Agregar ${label.toLowerCase()}`);button.type='button';
   button.addEventListener('click',()=>{undo=structuredClone(draft);set(path,optionalTemplate(path));$('review').hidden=true;render(section);update();});
   box.append(button);target.append(box);return;
  }
  const lab=make('label',label);lab.htmlFor=id;const value=get(draft,path);
  const input=kind==='media'?make('select'):kind==='text'&&String(value??'').length>90?make('textarea'):make('input');input.id=id;
  if(input.tagName==='INPUT')input.type=kind==='boolean'?'checkbox':kind==='number'?'number':kind==='email'?'email':kind==='url'?'url':'text';
  if(kind==='boolean')input.checked=Boolean(value);
  else if(kind==='media'){
   const matching=availableMedia.filter(item=>kind==='media'&&(path.endsWith('.archivo')?item.mimeType==='video/mp4':item.mimeType.startsWith('image/')));
   for(const item of matching){const option=make('option',mediaLabel(item));option.value=item.storageKey;input.append(option);}
   if(!matching.some(item=>item.storageKey===value)){const option=make('option','Archivo actual');option.value=value;input.prepend(option);}
   input.value=value;
  }else input.value=value??'';
  if(kind==='number'){input.min='0';input.step='any';}
  input.addEventListener(kind==='boolean'?'change':'input',()=>{
   undo=structuredClone(draft);let next=kind==='boolean'?input.checked:input.value;
   if(kind==='number')next=next===''?null:Number(next);
   if(value===null&&['text','url'].includes(kind))next=next.trim()||null;
   set(path,next);$('review').hidden=true;update();
  });box.append(lab,input);
  if(kind==='media'){
   const preview=make(path.endsWith('.archivo')?'video':'img');preview.className='asset-preview';preview.alt=label;
   if(preview.tagName==='VIDEO')preview.controls=true;
   const selected=availableMedia.find(item=>item.storageKey===value);
   if(selected)preview.src=previewUrl(selected);
   input.addEventListener('change',()=>{const chosen=availableMedia.find(item=>item.storageKey===input.value);if(chosen)preview.src=previewUrl(chosen);});
   box.append(preview);
   if(privateMode&&role==='admin'){
    const uploadLabel=make('label',path.endsWith('.archivo')?'Agregar un video nuevo':'Agregar una imagen nueva');
    const upload=make('input');upload.type='file';upload.accept=path.endsWith('.archivo')?'video/mp4':'image/jpeg,image/png,image/webp';
    upload.addEventListener('change',()=>{void uploadFile(upload.files?.[0],path,input,preview);upload.value='';});
    uploadLabel.append(upload);box.append(uploadLabel);
   }
  }
  if(kind==='number')box.append(make('small','Vacío: pendiente. Cero: sin costo.'));
  target.append(box);
 });
}
$('form').addEventListener('submit',event=>{
 event.preventDefault();const errors=reviewErrors();$('errors').replaceChildren(...errors.map(text=>make('p',text)));$('changes').replaceChildren();
 const items=changes();const display=value=>value&&typeof value==='object'?JSON.stringify(value):value??'Pendiente';
 for(const [path,label] of items){const box=make('div',undefined,'change');box.append(make('strong',label),make('p','Original: '+display(get(original,path)),'before'),make('p','Borrador: '+display(get(draft,path))));$('changes').append(box);}
 if(!items.length)$('changes').append(make('p',privateMode?'No hay cambios para guardar.':'No hay cambios para descargar.'));
 $('download').disabled=errors.length>0||items.length===0;$('save').disabled=errors.length>0||items.length===0;$('review').hidden=false;$('review-title').focus();
});
$('undo').addEventListener('click',()=>{if(!undo)return;draft=undo;undo=null;$('review').hidden=true;render();update();});
$('download').addEventListener('click',()=>{
 if(reviewErrors().length||!changes().length)return;
 const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)+'\n'],{type:'application/json'}));const anchor=make('a');anchor.href=url;anchor.download='colegio-borrador.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('state').textContent='Borrador descargado · pendiente de revisión';
});
async function loadContent(){
 let content;
 if(privateMode){
  const response=await fetch('/api/content/colegio/working',{cache:'no-store'});
  if(response.status===401){showLogin();return;}
  if(!response.ok)throw Error('No se pudo cargar el borrador de trabajo.');
  const result=await response.json();documentId=result.documentId;version=result.version;content=result.content;
 }else{
  const response=await fetch('../contenido/colegio.json',{cache:'no-store'});
  if(!response.ok)throw Error('No se pudo cargar el contenido.');content=await response.json();
  $('connection-title').textContent='Esta es una muestra';
  $('connection-text').textContent='Descargue el borrador para conservar sus cambios.';
 }
 original=content;draft=structuredClone(content);
 availableMedia=[];
 try{
  const response=await fetch(privateMode?'/api/media':'../contenido/medios-disponibles.json',{cache:'no-store'});
  if(response.status===401&&privateMode){showLogin();return;}
  if(response.ok){const items=await response.json();availableMedia=privateMode?items:items.map(storageKey=>({storageKey,mimeType:storageKey.endsWith('.mp4')?'video/mp4':'image/webp',previewUrl:null}));}
 }catch{availableMedia=[];}
 labels.clear();$('categories').replaceChildren();$('pending').replaceChildren();undo=null;
 GROUPS.forEach((group,i)=>{const button=make('button',group.title);button.type='button';button.setAttribute('aria-controls','form');button.addEventListener('click',()=>{active=i;render();});$('categories').append(button);});
 original.pendientes.forEach(text=>$('pending').append(make('li',text)));$('workspace').hidden=false;$('form').hidden=false;render();update();
}
function showLogin(){csrfToken=null;documentId=null;version=null;$('workspace').hidden=true;$('login').hidden=false;$('state').textContent='Inicie sesión para editar el contenido.';}
function configurePrivate(identityRole){
 privateMode=true;role=identityRole;$('login').hidden=true;$('notice').textContent='Sus cambios se guardan como borrador. La página del colegio no cambia hasta su aprobación.';
 $('connection-title').textContent=`Sesión: ${role==='admin'?'Admin':'Moderador'}`;
 $('connection-text').textContent='Puede guardar sus cambios y continuar más tarde.';
 $('review-help').textContent='Guarde el borrador para conservarlo. La página publicada no cambia hasta su aprobación.';
 $('download').hidden=true;$('save').hidden=false;$('logout').hidden=false;
 $('footer').textContent='Los cambios guardados permanecen en el servidor. La publicación requiere aprobación.';
}
$('login').addEventListener('submit',async event=>{
 event.preventDefault();$('state').textContent='Verificando acceso…';
 try{
  const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('login-email').value,password:$('login-password').value,totp:$('login-totp').value})});
  if(!response.ok){$('state').textContent=response.status===429?'Demasiados intentos. Intente más tarde.':'No se pudo iniciar sesión. Revise sus credenciales y el código.';return;}
  const session=await response.json();csrfToken=session.csrfToken;$('login-password').value='';$('login-totp').value='';configurePrivate(session.role);await loadContent();
 }catch{$('state').textContent='No se pudo conectar con el servidor.';}
});
$('save').addEventListener('click',async()=>{
 const errors=reviewErrors();if(errors.length||!changes().length)return;
 $('save').disabled=true;$('state').textContent='Guardando borrador…';
 try{
  const response=await fetch('/api/content/colegio/drafts',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({documentId,expectedVersion:version,content:draft})});
  if(response.status===401){showLogin();return;}
  if(response.status===409){$('state').textContent='Otro editor guardó cambios. Recargue la página antes de continuar.';return;}
  if(!response.ok){const result=await response.json();$('state').textContent=result.error??'No se pudo guardar el borrador.';return;}
  const result=await response.json();version=result.version;original=structuredClone(draft);undo=null;$('review').hidden=true;update();$('state').textContent='Borrador guardado en el servidor · pendiente de publicación';
 }catch{$('state').textContent='No se pudo conectar con el servidor. El borrador sigue en esta pestaña.';}
 finally{$('save').disabled=false;}
});
$('logout').addEventListener('click',async()=>{
 try{await fetch('/api/auth/logout',{method:'POST',headers:{'X-CSRF-Token':csrfToken}});}catch{}finally{showLogin();$('login-email').value='';}
});
try{
 const session=await fetch('/api/auth/me',{cache:'no-store'});
 if(session.status===404){await loadContent();}
 else if(session.status===401){showLogin();}
 else if(session.ok){const identity=await session.json();csrfToken=identity.csrfToken;configurePrivate(identity.role);await loadContent();}
 else throw Error('No se pudo comprobar la sesión.');
}catch{$('state').textContent='No se pudo cargar el editor. Recargue la página o consulte al administrador.';}
