(()=>{
 const launcher=document.querySelector('#matricula-chat-launcher');
 const dialog=document.querySelector('#matricula-chat');
 if(!launcher||!dialog||typeof dialog.showModal!=='function')return;
 const home=dialog.querySelector('#matricula-chat-home');
 const conversation=dialog.querySelector('#matricula-chat-conversation');
 const log=dialog.querySelector('#matricula-chat-log');
 const form=dialog.querySelector('#matricula-chat-form');
 const input=dialog.querySelector('#matricula-chat-input');
 const advisorNotice=dialog.querySelector('#matricula-chat-advisor-notice');
 const submit=dialog.querySelector('#matricula-chat-send');
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let advisorMode=false;
 const faqs=[
  {label:'¿Cómo iniciar la matrícula?',short:'Proceso de matrícula',keys:['matricula','inscribir','inscripcion','ingreso','proceso'],answer:'El primer paso es conversar con admisiones. Indique el nivel de interés y consulte la disponibilidad. El equipo le orientará sobre los requisitos y los pasos oficiales para continuar.'},
  {label:'¿Qué requisitos se solicitan?',short:'Requisitos de ingreso',keys:['requisito','documento','papel','traslado'],answer:'Los requisitos deben confirmarse con admisiones según el nivel y la situación del estudiante. Solicite la lista oficial antes de preparar documentos. Esta demostración no recibe expedientes ni archivos.'},
  {label:'¿Cuáles son los costos?',short:'Costos y condiciones',keys:['costo','precio','tarifa','pago','mensualidad','cuota','beca'],answer:'Los montos de matrícula, mensualidad y las condiciones de pago deben confirmarse directamente con admisiones. Todavía no contamos con tarifas oficiales publicadas en esta vista previa.'},
  {label:'¿Hay cupos disponibles?',short:'Fechas y disponibilidad',keys:['cupo','fecha','disponibilidad','disponible','cuando','abierta'],answer:'La disponibilidad y las fechas de matrícula pueden variar por nivel. El equipo de admisiones debe confirmar los cupos y el calendario vigente. Esta demostración no reserva espacios.'},
  {label:'¿Qué niveles ofrece el colegio?',short:'Niveles de secundaria',keys:['nivel','secundaria','primaria','grado','ciclo','oferta'],answer:'La información presentada en el sitio corresponde a Secundaria: III Ciclo y Educación Diversificada. Consulte con admisiones la oferta vigente y la disponibilidad para el nivel que le interesa.'},
  {label:'¿Puedo coordinar una visita?',short:'Conocer el colegio',keys:['visita','conocer','ubicacion','direccion','donde','horario'],answer:'Puede consultar con admisiones la posibilidad de una visita y coordinar los detalles. El colegio se ubica en Barrio Los Sauces, San Francisco de Dos Ríos, 75 metros al sur de la Escuela Santa Marta, San José.'}
 ];
 const make=(tag,text,className)=>{
  const element=document.createElement(tag);
  if(text)element.textContent=text;
  if(className)element.className=className;
  return element;
 };
 function message(text,from='bot'){
  const item=make('div',null,'matricula-message matricula-message-'+from);
  item.append(make('span',from==='user'?'Usted':'Asistente de matrícula','matricula-message-author'),make('p',text));
  log.append(item);
  while(log.children.length>24)log.firstElementChild.remove();
  if(!reducedMotion.matches&&typeof item.animate==='function')item.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
  item.scrollIntoView({block:'nearest',behavior:'instant'});
 }
 function openConversation(advisor=false){
  const entering=conversation.hidden;
  advisorMode=advisor;home.hidden=true;conversation.hidden=false;
  advisorNotice.hidden=!advisor;
  input.placeholder=advisor?'Escriba una consulta de prueba…':'Escriba su pregunta…';
  submit.setAttribute('aria-label',advisor?'Probar mensaje para un asesor':'Enviar pregunta al asistente');
  if(entering)dialog.querySelector('#matricula-chat-back').focus({preventScroll:true});
 }
 function ask(faq){
  openConversation();message(faq.label,'user');message(faq.answer);
 }
 function showAdvisor(announce=true){
  openConversation(true);
  if(announce)message('Me gustaría hablar con un asesor.','user');
  message('Será un gusto acompañarle en su próximo paso. Esta es una vista previa de la atención personalizada: la conexión con asesores aún no está activa. Puede probar cómo se verá su consulta; no se enviará ningún mensaje.');
 }
 for(const faq of faqs){
  const button=make('button',null,'matricula-faq-button');button.type='button';
  button.append(make('span',faq.short),make('span','↗','matricula-faq-arrow'));
  button.addEventListener('click',()=>ask(faq));dialog.querySelector('#matricula-chat-questions').append(button);
 }
 launcher.hidden=false;
 launcher.addEventListener('click',()=>{
  dialog.showModal();launcher.setAttribute('aria-expanded','true');
  dialog.querySelector('#matricula-chat-close').focus({preventScroll:true});
 });
 dialog.querySelector('#matricula-chat-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{launcher.setAttribute('aria-expanded','false');launcher.focus({preventScroll:true});});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 dialog.querySelectorAll('[data-matricula-advisor]').forEach(button=>button.addEventListener('click',()=>showAdvisor()));
 dialog.querySelector('#matricula-chat-back').addEventListener('click',()=>{
  home.hidden=false;conversation.hidden=true;
  dialog.querySelector('.matricula-faq-button').focus({preventScroll:true});
 });
 dialog.querySelector('[data-matricula-contact]').addEventListener('click',()=>dialog.close());
 form.addEventListener('submit',event=>{
  event.preventDefault();const text=input.value.trim().slice(0,300);if(!text)return;
  input.value='';message(text,'user');
  if(advisorMode){message('Consulta de prueba mostrada. No se ha enviado a un asesor ni se ha guardado. Cuando se active este servicio, el equipo podrá continuar la conversación desde su bandeja.');return;}
  const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/asesor|persona|humano|hablar con alguien/.test(normalized)){showAdvisor(false);return;}
  const faq=[...faqs.slice(1),faqs[0]].find(item=>item.keys.some(key=>normalized.includes(key)));
  message(faq?faq.answer:'Puedo orientarle sobre matrícula, requisitos, costos, cupos, niveles y visitas. Puede volver a las preguntas frecuentes o elegir «Hablar con un asesor». Las consultas particulares deben confirmarse con admisiones.');
 });
})();
