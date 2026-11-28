import {validateDraft} from './validacion.mjs';
import {GROUPS, editableFields, optionalTemplate, readPath, writePath} from './field-catalog.mjs';
import {invalidMediaChanges} from '../lib/media-policy.mjs';
import {changedFields} from '../lib/content-policy.mjs';
import {NEWS_TEMPLATE} from '../lib/content-shape.mjs';
const $=id=>document.getElementById(id);
let original,draft,published,undo,active=0,privateMode=false,csrfToken=null,documentId=null,version=null,revisionId=null,revisionStatus=null,reviewReason=null,canSubmit=false,role='admin',fields=[];
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
 if(item.storageKey.startsWith('uploads/')){
  const reference=(item.id??item.storageKey.split('/').at(-1)).slice(0,8);
  const shape=item.width&&item.height?(item.width>item.height*1.2?'horizontal':item.height>item.width*1.2?'vertical':'cuadrada'):null;
  return `${item.mimeType==='video/mp4'?'Video nuevo':`Imagen nueva${shape?` ${shape}`:''}`} · ref. ${reference}`;
 }
 if(item.storageKey.includes('portada-optimizada'))return 'Video actual de portada';
 if(item.storageKey.includes('portada-poster'))return 'Imagen actual de portada';
 const name=item.storageKey.split('/').at(-1).replace(/\.[^.]+$/,'').replace(/-(640|960|1280|480)$/,'').replaceAll('-',' ');
 const size=/-(640|960|1280|480)\./.exec(item.storageKey)?.[1];
 return `${name[0].toUpperCase()+name.slice(1)}${size?` · ${size} px`:''}`;
}
function addMediaOption(select,item){
 if([...select.options].some(option=>option.value===item.storageKey))return;
 const option=make('option',mediaLabel(item));option.value=item.storageKey;select.append(option);
}
function previewUrl(item){return item?.previewUrl??(item?original.basePath+item.storageKey:null);}
function mediaHelp(path){
 if(path.endsWith('.archivo'))return 'Video MP4 de hasta 100 MB. Revise la reproducción antes de aprobar.';
 if(path.endsWith('.poster'))return 'Imagen horizontal para la portada, preferiblemente de proporción 16:9.';
 if(path.includes('.acompanamiento.'))return 'Imagen vertical para el bloque de acompañamiento.';
 if(path.includes('.tarjetas.')||path.startsWith('galeria.'))return 'Imagen horizontal. Revise el encuadre de la tarjeta o galería.';
 if(path.startsWith('publicaciones.'))return 'Imagen opcional para la noticia. Descríbala en el campo siguiente.';
 return 'Revise cómo se ve la imagen antes de aprobar.';
}
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
  availableMedia.push(result);
  document.querySelectorAll('select[data-media-kind]').forEach(other=>{
   if(other.dataset.mediaKind===(result.mimeType==='video/mp4'?'video':'image'))addMediaOption(other,result);
  });
  addMediaOption(select,result);
  undo=structuredClone(draft);set(path,result.storageKey);select.value=result.storageKey;preview.src=previewUrl(result);$('review').hidden=true;update();
  $('state').textContent='Archivo listo. Revise y guarde el borrador para usarlo.';
 }catch{$('state').textContent='No se pudo subir el archivo. Intente de nuevo.';}
}
function update(){
 $('preview-eyebrow').textContent=draft.inicio.antetitulo;$('preview-title').textContent=draft.inicio.titulo.join('\n');$('preview-description').textContent=draft.inicio.descripcion;
 const n=changes().length;$('state').textContent=n?`${n} ${n===1?"campo modificado":"campos modificados"} · sin guardar`:(privateMode?'Borrador de trabajo · sin cambios':'Contenido original · sin cambios');$('undo').disabled=!undo;
 renderWorkflow();
}
function renderWorkflow(){
 if(!privateMode||!revisionStatus)return;
 $('workflow').hidden=false;
 const names={borrador:'Borrador guardado',en_revision:'En revisión',aprobado:'Aprobado',rechazado:'Devuelto para corrección'};
 $('workflow-status').textContent=names[revisionStatus]??'Contenido de trabajo';
 $('workflow-help').textContent=revisionStatus==='aprobado'?'El contenido está aprobado. La página pública todavía no ha cambiado.':revisionStatus==='en_revision'?'Admin puede aprobarlo o devolverlo con una explicación. La página pública todavía no ha cambiado.':revisionStatus==='rechazado'?'Corrija el contenido indicado y guarde un borrador nuevo.':'Guarde todos sus cambios antes de enviar el borrador a revisión.';
 $('review-reason').hidden=revisionStatus!=='rechazado'||!reviewReason;
 $('review-reason').textContent=reviewReason?`Corrección solicitada: ${reviewReason}`:'';
 $('submit-review').hidden=revisionStatus!=='borrador'||!canSubmit;
 $('submit-review').disabled=changes().length>0;
 $('approve-review').hidden=role!=='admin'||revisionStatus!=='en_revision';
 $('approve-review').disabled=changes().length>0;
 $('preview-approved').hidden=revisionStatus!=='aprobado'||changes().length>0;
 $('reject-box').hidden=role!=='admin'||revisionStatus!=='en_revision';
 $('reject-review').disabled=changes().length>0;
}
async function loadRevisions(){
 if(!privateMode)return;
 try{
  const response=await fetch('/api/content/colegio/revisions',{cache:'no-store'});
  if(!response.ok)return;
  const items=await response.json();const list=$('history-list');list.replaceChildren();
  for(const item of items){
   const date=new Date(item.createdAt);const when=Number.isNaN(date.getTime())?'Fecha no disponible':new Intl.DateTimeFormat('es-CR',{dateStyle:'medium',timeStyle:'short'}).format(date);
   const status={borrador:'Borrador',en_revision:'En revisión',aprobado:'Aprobado',rechazado:'Devuelto'}[item.status]??'Versión';
   const line=make('li');line.append(make('strong',status),document.createTextNode(` · ${when}${item.isCurrent?' · versión actual':''}${item.isPublished?' · página pública':''}`));
   if(item.reason)line.append(make('p',`Corrección solicitada: ${item.reason}`));
   list.append(line);
  }
  if(!items.length)list.append(make('li','Todavía no hay versiones guardadas.'));
  $('revision-history').hidden=false;
 }catch{$('revision-history').hidden=true;}
}
function renderPublishedDiff(){
 if(!privateMode||!published)return;
 const differences=changedFields(published,original);
 const byPath=new Map(editableFields(original,'admin').map(field=>[field.path,field]));
 const list=$('published-diff-list');list.replaceChildren();
 $('published-diff-summary').textContent=differences.length?`${differences.length} ${differences.length===1?'cambio guardado':'cambios guardados'} respecto a la página pública. Revise también las imágenes y videos en sus apartados antes de aprobar.`:'Esta versión coincide con el contenido de la página pública.';
 const format=value=>value===null||value===undefined?'Pendiente':typeof value==='object'?JSON.stringify(value,null,2):String(value);
 for(const change of differences){
  const path=change.path.join('.');const root=change.path[0];
  const field=byPath.get(path);const name=field?.label??GROUPS.find(group=>group.roots.includes(root))?.title??root;
  const mediaChanged=['imagen','imagenGrande','poster','archivo'].includes(change.path.at(-1));
  const describe=value=>{if(!mediaChanged)return format(value);const item=availableMedia.find(media=>media.storageKey===value);return item?mediaLabel(item):'Archivo seleccionado';};
  const box=make('div',undefined,'published-change');box.append(make('strong',name),make('p','Página pública: '+describe(change.before)),make('p','Versión guardada: '+describe(change.after)));
  if(mediaChanged){
   const item=availableMedia.find(media=>media.storageKey===change.after);
   if(item){const preview=make(item.mimeType==='video/mp4'?'video':'img');preview.className='asset-preview';preview.src=previewUrl(item);if(preview.tagName==='VIDEO')preview.controls=true;else preview.alt=`Vista de ${name}`;box.append(preview);}
  }
  if(field){const open=make('button','Ver en el editor');open.type='button';open.addEventListener('click',()=>{active=GROUPS.findIndex(group=>group.id===field.group);render(field.section);$('field-'+path.replaceAll('.','-'))?.focus();});box.append(open);}
  list.append(box);
 }
 $('published-diff').hidden=false;
}
function render(focusSection=null){
 fields=editableFields(draft,role);for(const field of fields)labels.set(field.path,field.label);
 const group=GROUPS[active];$('section-title').textContent=group.title;$('section-description').textContent=group.description;$('fields').replaceChildren();
 document.querySelectorAll('#categories button').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===active)));
 if(group.id==='noticias'){
  const tools=make('div',undefined,'news-tools');
  tools.append(make('p',draft.publicaciones.length?`${draft.publicaciones.length} ${draft.publicaciones.length===1?'noticia preparada':'noticias preparadas'}. Revise sus datos antes de enviar el borrador.`:'Todavía no hay noticias. La página conserva su aviso actual.'));
  if(role==='admin'){
   const add=make('button','Agregar noticia');add.type='button';add.disabled=draft.publicaciones.length>=30;
   add.addEventListener('click',()=>{undo=structuredClone(draft);const fecha=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Costa_Rica',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());draft.publicaciones.push({...structuredClone(NEWS_TEMPLATE),id:crypto.randomUUID(),fecha});$('review').hidden=true;render(`publicaciones.${draft.publicaciones.length-1}`);update();});
   tools.append(add);
  }
  $('fields').append(tools);
 }
 const sections=new Map();
 fields.filter(field=>field.group===group.id).forEach(({path,label,kind,section,sectionTitle})=>{
  if(!sections.has(section)){
   const details=make('details',undefined,'editor-group');details.open=section===focusSection||(focusSection===null&&sections.size===0);
   details.append(make('summary',sectionTitle));$('fields').append(details);sections.set(section,details);
   if(section.startsWith('publicaciones.')&&role==='admin'){
    const remove=make('button','Quitar esta noticia');remove.type='button';
    remove.addEventListener('click',()=>{undo=structuredClone(draft);draft.publicaciones.splice(Number(section.split('.')[1]),1);$('review').hidden=true;render();update();});
    details.append(remove);
   }
  }
  const target=sections.get(section);
  const box=make('div',undefined,'field');const id='field-'+path.replaceAll('.','-');
  if(kind==='optional-structure'){
   box.append(make('strong',label));const button=make('button',`Agregar ${label.toLowerCase()}`);button.type='button';
   button.addEventListener('click',()=>{undo=structuredClone(draft);set(path,optionalTemplate(path));$('review').hidden=true;render(section);update();});
   box.append(button);target.append(box);return;
  }
  const lab=make('label',label);lab.htmlFor=id;const value=get(draft,path);
  const longText=kind==='text'&&(String(value??'').length>90||/^publicaciones\.\d+\.(resumen|texto)$/.test(path));
  const input=kind==='media'?make('select'):longText?make('textarea'):make('input');input.id=id;
  if(input.tagName==='INPUT')input.type=kind==='boolean'?'checkbox':kind==='number'?'number':kind==='date'?'date':kind==='email'?'email':kind==='url'?'url':'text';
  if(path.startsWith('publicaciones.')){const limit={titulo:100,resumen:250,texto:3000,alt:150}[path.split('.').at(-1)];if(limit)input.maxLength=limit;}
  if(kind==='boolean')input.checked=Boolean(value);
  else if(kind==='media'){
   input.dataset.mediaKind=path.endsWith('.archivo')?'video':'image';
   const matching=availableMedia.filter(item=>kind==='media'&&(path.endsWith('.archivo')?item.mimeType==='video/mp4':item.mimeType.startsWith('image/')));
   if(/^publicaciones\.\d+\.imagen$/.test(path)){const none=make('option','Sin imagen');none.value='';input.append(none);}
   for(const item of matching){const option=make('option',mediaLabel(item));option.value=item.storageKey;input.append(option);}
   if(value!==null&&!matching.some(item=>item.storageKey===value)){const option=make('option','Archivo seleccionado no disponible');option.value=value;input.prepend(option);}
   input.value=value??'';
  }else input.value=value??'';
  if(kind==='number'){input.min='0';input.step='any';}
  input.addEventListener(kind==='boolean'?'change':'input',()=>{
   undo=structuredClone(draft);let next=kind==='boolean'?input.checked:input.value;
   if(kind==='number')next=next===''?null:Number(next);
   if(kind==='media'&&next==='')next=null;
   if(value===null&&['text','url'].includes(kind))next=next.trim()||null;
   set(path,next);
   if(/^publicaciones\.\d+\.titulo$/.test(path))target.querySelector('summary').textContent=`Noticia: ${next.trim()||`n.º ${Number(section.split('.')[1])+1}`}`;
   $('review').hidden=true;update();
  });box.append(lab,input);
  if(kind==='media'){
   box.append(make('small',mediaHelp(path)));
   const preview=make(path.endsWith('.archivo')?'video':'img');preview.className='asset-preview';preview.alt=label;
   if(preview.tagName==='VIDEO'){preview.controls=true;preview.preload='metadata';}
   const selected=availableMedia.find(item=>item.storageKey===value);
   if(selected)preview.src=previewUrl(selected);
   input.addEventListener('change',()=>{const chosen=availableMedia.find(item=>item.storageKey===input.value);if(chosen)preview.src=previewUrl(chosen);else preview.removeAttribute('src');});
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
  if(response.status===409){$('state').textContent='El panel necesita una actualización de contenido. Avise a la persona encargada del sistema.';return;}
  if(!response.ok)throw Error('No se pudo cargar el borrador de trabajo.');
  const result=await response.json();documentId=result.documentId;version=result.version;revisionId=result.revisionId;revisionStatus=result.status;reviewReason=result.reviewReason;canSubmit=result.canSubmit;content=result.content;
  const publicResponse=await fetch('/api/content/colegio',{cache:'no-store'});
  if(publicResponse.status===401){showLogin();return;}
  if(!publicResponse.ok)throw Error('No se pudo comparar el borrador con la página pública.');
  published=(await publicResponse.json()).content;
 }else{
  const response=await fetch('../contenido/colegio.json',{cache:'no-store'});
  if(!response.ok)throw Error('No se pudo cargar el contenido.');content=await response.json();
  published=structuredClone(content);
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
 original.pendientes.forEach(text=>$('pending').append(make('li',text)));$('workspace').hidden=false;$('form').hidden=false;render();update();renderPublishedDiff();
 await loadRevisions();
}
function showLogin(){csrfToken=null;documentId=null;version=null;revisionId=null;revisionStatus=null;reviewReason=null;published=null;canSubmit=false;$('workspace').hidden=true;$('login').hidden=false;$('state').textContent='Inicie sesión para editar el contenido.';}
function configurePrivate(identityRole){
 privateMode=true;role=identityRole;$('login').hidden=true;$('notice').textContent='Sus cambios se guardan como borrador. Revisar o aprobar no modifica todavía la página pública.';
 $('connection-title').textContent=`Sesión: ${role==='admin'?'Admin':'Moderador'}`;
 $('connection-text').textContent='Puede guardar sus cambios y continuar más tarde.';
 $('review-help').textContent='Guarde el borrador para conservarlo. La página pública no cambia al guardarlo ni al aprobarlo.';
 $('download').hidden=true;$('save').hidden=false;$('logout').hidden=false;
 $('footer').textContent='Los cambios guardados permanecen en el servidor. La publicación se realiza por separado.';
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
  const result=await response.json();version=result.version;revisionId=result.revisionId;revisionStatus='borrador';reviewReason=null;canSubmit=true;original=structuredClone(draft);undo=null;$('review').hidden=true;update();renderPublishedDiff();$('state').textContent='Borrador guardado. Puede enviarlo a revisión.';await loadRevisions();
 }catch{$('state').textContent='No se pudo conectar con el servidor. El borrador sigue en esta pestaña.';}
 finally{$('save').disabled=false;}
});
$('submit-review').addEventListener('click',()=>{void changeWorkflow('submit');});
$('approve-review').addEventListener('click',()=>{void changeWorkflow('approve');});
$('reject-review').addEventListener('click',()=>{void changeWorkflow('reject');});
async function changeWorkflow(action){
 const button=$(action==='submit'?'submit-review':action==='approve'?'approve-review':'reject-review');
 if(!privateMode||changes().length||!revisionId||!version)return;
 const reason=$('reject-reason').value.trim();
 if(action==='reject'&&(reason.length<5||reason.length>1000)){$('state').textContent='Explique qué debe corregirse en al menos 5 caracteres.';$('reject-reason').focus();return;}
 button.disabled=true;$('state').textContent=action==='submit'?'Enviando a revisión…':action==='approve'?'Aprobando contenido…':'Devolviendo para corrección…';
 try{
  const response=await fetch(`/api/content/colegio/${action}`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({documentId,revisionId,expectedVersion:version,...(action==='reject'?{reason}:{})})});
  if(response.status===401){showLogin();return;}
  if(response.status===409){$('state').textContent='El borrador cambió. Recargue la página antes de continuar.';return;}
  const result=await response.json();
  if(!response.ok){$('state').textContent=result.error??'No se pudo cambiar el estado del borrador.';return;}
  revisionStatus=result.status;reviewReason=result.reviewReason;$('reject-reason').value='';renderWorkflow();await loadRevisions();
  $('state').textContent=action==='submit'?'Borrador enviado a revisión.':action==='approve'?'Contenido aprobado. La página pública todavía no ha cambiado.':'Contenido devuelto con instrucciones de corrección.';
 }catch{$('state').textContent='No se pudo conectar con el servidor. Intente de nuevo.';}
 finally{renderWorkflow();}
}
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
