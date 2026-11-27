/* Cinta continua: cada mitad siempre cubre al menos el ancho visible. */
const section=document.querySelector('.home-opinions');
if(section){
 const button=document.getElementById('opinions-toggle');
 const marquee=section.querySelector('.opinions-marquee');
 const track=document.getElementById('opinions-track');
 const [original,copy]=track.children;
 const cards=[...original.children];
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let manualPause=false,hover=false,inView=true,keyboard=false,player;
 const clone=card=>{
  const node=card.cloneNode(true);node.setAttribute('aria-hidden','true');
  node.querySelectorAll('a').forEach(link=>link.tabIndex=-1);
  return node;
 };
 const sync=()=>{
  const staticMode=motion.matches||keyboard||!track.animate;
  section.classList.toggle('opinions-static',staticMode);
  if(staticMode)player?.cancel();
  else if(manualPause||hover||document.hidden||!inView)player?.pause();
  else player?.play();
  button.textContent=manualPause?button.dataset.resume:button.dataset.pause;
  button.setAttribute('aria-pressed',String(manualPause));
  button.hidden=motion.matches||!track.animate;
 };
 function rebuild(){
  player?.cancel();
  section.classList.toggle('opinions-static',motion.matches||keyboard||!track.animate);
  original.replaceChildren(...cards);
  // Agrandar ambos bloques evita el hueco en ventanas mayores que tres tarjetas.
  const period=original.getBoundingClientRect().width;
  const repeats=Math.max(1,Math.ceil(marquee.clientWidth/period));
  for(let i=1;i<repeats;i++)original.append(...cards.map(clone));
  copy.replaceChildren(...[...original.children].map(clone));
  if(track.animate){
   const distance=original.getBoundingClientRect().width;
   player=track.animate([{transform:`translateX(${-distance}px)`},{transform:'translateX(0)'}],{duration:distance/24*1000,iterations:Infinity,easing:'linear'});
  }
  sync();
 }
 section.classList.add('opinions-ready');
 button.addEventListener('click',()=>{manualPause=!manualPause;sync();});
 marquee.addEventListener('pointerenter',()=>{hover=true;sync();});
 marquee.addEventListener('pointerleave',()=>{hover=false;sync();});
 marquee.addEventListener('focusin',()=>{keyboard=true;sync();});
 marquee.addEventListener('focusout',()=>queueMicrotask(()=>{
  if(!marquee.contains(document.activeElement)){keyboard=false;rebuild();}
 }));
 motion.addEventListener('change',rebuild);
 document.addEventListener('visibilitychange',sync);
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();}).observe(section);
 rebuild();
 if('ResizeObserver' in window)new ResizeObserver(rebuild).observe(marquee);
 else window.addEventListener('resize',rebuild);
}
