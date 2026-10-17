const campaign=document.querySelector('.campaign-hero');
if(campaign){
 const messages=[
  {kicker:'APRENDER. CRECER. TRASCENDER.',title:'Un nuevo mundo',highlight:'para tu futuro.',description:'Cada etapa es una oportunidad para aprender, descubrir y crecer. Conozca nuestra comunidad educativa.',label:'Conozca el colegio',target:'#institucion'},
  {kicker:'SECUNDARIA',title:'Descubre lo que',highlight:'puedes lograr.',description:'Una etapa para aprender, crear y compartir. Conozca experiencias que acompañan el crecimiento de nuestra comunidad estudiantil.',label:'Explore la vida en el colegio',target:'#oferta'},
  {kicker:'ADMISIONES',title:'El primer paso es',highlight:'conocernos.',description:'Encuentre orientación sobre requisitos, niveles y el proceso de admisión. Conversemos sobre el próximo paso de su familia.',label:'Conozca el proceso de admisión',target:'#admisiones'}
 ];
 let current=0;
 const buttons=[...campaign.querySelectorAll('[data-campaign]')];
 const fields={kicker:'campaign-kicker',title:'campaign-title',highlight:'campaign-highlight',description:'campaign-description'};
 function show(index){
  current=(index+messages.length)%messages.length;const item=messages[current];
  for(const [key,id] of Object.entries(fields))document.getElementById(id).textContent=item[key];
  const link=document.getElementById('campaign-link');link.replaceChildren(document.createTextNode(item.label+' '));const arrow=document.createElement('span');arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');link.append(arrow);link.setAttribute('href',item.target);
  buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===current)));document.getElementById('campaign-count').textContent=String(current+1).padStart(2,'0')+' / 03';
 }
 buttons.forEach((button,index)=>button.addEventListener('click',()=>show(index)));
 document.getElementById('campaign-previous').addEventListener('click',()=>show(current-1));
 document.getElementById('campaign-next').addEventListener('click',()=>show(current+1));
}

const experiences=document.querySelector('.experience-carousel');
if(experiences){
 const panels=[...experiences.querySelectorAll('.experience-panel')];
 const choices=[...experiences.querySelectorAll('[data-experience]')];
 const rotation=experiences.querySelector('#experience-rotation');
 const status=experiences.querySelector('#experience-status');
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const viewport=experiences.querySelector('.experience-viewport');
 let current=0,timer=null,visible=false,focusPaused=false,userPaused=motion.matches,touch=null;
 let transitioning=false,pending=null,animations=[],imagesPrepared=false;
 // Las tres diapositivas comparten una celda: su altura se mantiene estable
 // y la imagen anterior permanece debajo durante el fundido de la siguiente.
 viewport.classList.add('is-ready');
 panels.forEach((panel,i)=>{
  panel.hidden=false;panel.inert=i!==current;
  panel.setAttribute('aria-hidden',String(i!==current));
  panel.classList.toggle('is-active',i===current);
 });
 async function prepareImage(panel){
  const image=panel.querySelector('img');
  image.loading='eager';
  try{if(typeof image.decode==='function')await image.decode();}catch{
   // Una imagen que falla no debe bloquear los controles de la galería.
  }
 }
 function schedule(){
  clearTimeout(timer);
  updateRotation();
  if(!transitioning&&!userPaused&&!focusPaused&&visible&&!document.hidden)timer=setTimeout(()=>show(current+1,false),8000);
 }
 function updateRotation(){
  const paused=userPaused||focusPaused;
  rotation.textContent=paused?'Reanudar rotación':'Pausar rotación';
  rotation.setAttribute('aria-pressed',String(paused));
 }
 async function show(index,manual=true){
  const next=(index+panels.length)%panels.length;
  // Los clics rápidos se atienden al terminar el fundido, sin cortarlo.
  if(transitioning){pending={index:next,manual};return;}
  if(next===current){schedule();return;}
  clearTimeout(timer);transitioning=true;
  const previous=panels[current],panel=panels[next];
  await prepareImage(panel);
  previous.inert=true;previous.setAttribute('aria-hidden','true');
  previous.classList.add('is-leaving');previous.classList.remove('is-active');
  current=next;panel.inert=false;panel.setAttribute('aria-hidden','false');panel.classList.add('is-active');
  choices.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===current)));
  experiences.querySelector('#experience-count').textContent=String(current+1).padStart(2,'0')+' / 03';
  if(manual)status.textContent=panel.getAttribute('aria-label')+'. '+panel.querySelector('h3').textContent;
  try{
   if(!motion.matches&&!document.hidden&&typeof panel.animate==='function'){
    animations=[
     previous.querySelector('.experience-text').animate([{opacity:1},{opacity:0}],{duration:180,easing:'ease-out',fill:'both'}),
     panel.querySelector('.experience-text').animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:560,delay:200,easing:'ease-out',fill:'both'}),
     panel.querySelector('.experience-image').animate([{opacity:0},{opacity:1}],{duration:900,easing:'ease-in-out',fill:'both'})
    ];
    await Promise.allSettled(animations.map(animation=>animation.finished));
   }
  }finally{
   previous.classList.remove('is-leaving');
   animations.forEach(animation=>animation.cancel());animations=[];transitioning=false;
   const queued=pending;pending=null;
   if(queued&&queued.index!==current)show(queued.index,queued.manual);
   else schedule();
  }
 }
 experiences.querySelector('.experience-controls').hidden=false;
 choices.forEach((button,i)=>button.addEventListener('click',()=>show(i)));
 experiences.querySelector('#experience-previous').addEventListener('click',()=>show(current-1));
 experiences.querySelector('#experience-next').addEventListener('click',()=>show(current+1));
 rotation.addEventListener('click',()=>{
  if(userPaused||focusPaused){userPaused=false;focusPaused=false;}
  else userPaused=true;
  schedule();
 });
 // El cursor no detiene la galería. El foco protege la lectura con teclado;
 // reanudar explícitamente también funciona mientras el botón conserva el foco.
 experiences.addEventListener('focusin',event=>{
  if(event.target!==rotation)focusPaused=true;
  schedule();
 });
 experiences.addEventListener('focusout',event=>{
  if(!experiences.contains(event.relatedTarget))focusPaused=false;
  schedule();
 });
 experiences.addEventListener('keydown',event=>{
  if(!event.target.closest('.experience-controls'))return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();show(current+(event.key==='ArrowRight'?1:-1));}
 });
 viewport.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')touch={x:event.clientX,y:event.clientY};});
 viewport.addEventListener('pointercancel',()=>{touch=null;});
 viewport.addEventListener('pointerup',event=>{
  if(!touch)return;const x=event.clientX-touch.x,y=event.clientY-touch.y;touch=null;
  if(Math.abs(x)>55&&Math.abs(x)>Math.abs(y)*1.4)show(current+(x<0?1:-1));
 });
 document.addEventListener('visibilitychange',schedule);
 motion.addEventListener('change',()=>{if(motion.matches){userPaused=true;animations.forEach(animation=>animation.cancel());}schedule();});
 function setVisible(value){
  visible=value;
  if(visible&&!imagesPrepared){imagesPrepared=true;panels.forEach(prepareImage);}
  schedule();
 }
 if('IntersectionObserver' in window){new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting),{threshold:.1}).observe(experiences);}
 else setVisible(true);
 updateRotation();
}
