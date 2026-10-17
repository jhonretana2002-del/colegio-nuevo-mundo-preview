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
 let current=0,timer=null,visible=false,hovered=false,userPaused=motion.matches,animation=null,touch=null;
 function schedule(){
  clearTimeout(timer);
  const focused=experiences.contains(document.activeElement);
  if(!userPaused&&visible&&!hovered&&!focused&&!document.hidden)timer=setTimeout(()=>show(current+1,false),8000);
 }
 function updateRotation(){
  rotation.textContent=userPaused?'Reanudar cambios':'Pausar cambios';
  rotation.setAttribute('aria-pressed',String(userPaused));
 }
 function show(index,manual=true){
  const next=(index+panels.length)%panels.length;
  if(next===current){schedule();return;}
  animation?.cancel();
  panels[current].hidden=true;panels[current].inert=true;
  current=next;const panel=panels[current];panel.hidden=false;panel.inert=false;
  choices.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===current)));
  experiences.querySelector('#experience-count').textContent=String(current+1).padStart(2,'0')+' / 03';
  if(manual)status.textContent=panel.getAttribute('aria-label')+'. '+panel.querySelector('h3').textContent;
  if(!motion.matches&&typeof panel.animate==='function')animation=panel.animate([{opacity:.3,transform:'translateX(-24px)'},{opacity:1,transform:'translateX(0)'}],{duration:520,easing:'cubic-bezier(.2,.65,.3,1)'});
  schedule();
 }
 experiences.querySelector('.experience-controls').hidden=false;
 choices.forEach((button,i)=>button.addEventListener('click',()=>show(i)));
 experiences.querySelector('#experience-previous').addEventListener('click',()=>show(current-1));
 experiences.querySelector('#experience-next').addEventListener('click',()=>show(current+1));
 rotation.addEventListener('click',()=>{userPaused=!userPaused;updateRotation();schedule();});
 experiences.addEventListener('mouseenter',()=>{hovered=true;schedule();});
 experiences.addEventListener('mouseleave',()=>{hovered=false;schedule();});
 experiences.addEventListener('focusin',schedule);
 experiences.addEventListener('focusout',()=>queueMicrotask(schedule));
 experiences.addEventListener('keydown',event=>{
  if(!event.target.closest('.experience-controls'))return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();show(current+(event.key==='ArrowRight'?1:-1));}
 });
 const viewport=experiences.querySelector('.experience-viewport');
 viewport.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')touch={x:event.clientX,y:event.clientY};});
 viewport.addEventListener('pointercancel',()=>{touch=null;});
 viewport.addEventListener('pointerup',event=>{
  if(!touch)return;const x=event.clientX-touch.x,y=event.clientY-touch.y;touch=null;
  if(Math.abs(x)>55&&Math.abs(x)>Math.abs(y)*1.4)show(current+(x<0?1:-1));
 });
 document.addEventListener('visibilitychange',schedule);
 motion.addEventListener('change',()=>{if(motion.matches){userPaused=true;animation?.cancel();}updateRotation();schedule();});
 if('IntersectionObserver' in window){new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.3}).observe(experiences);}
 else{visible=true;schedule();}
 updateRotation();
}
