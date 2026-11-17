const section=document.querySelector('.home-opinions');
if(section){
 const button=document.getElementById('opinions-toggle');
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let manualPause=false;
 let inView=true;
 const sync=()=>{
  const paused=manualPause||motion.matches||document.hidden||!inView;
  section.classList.toggle('opinions-paused',paused);
  button.textContent=manualPause?'Reanudar carrusel':'Pausar carrusel';
  button.setAttribute('aria-pressed',String(manualPause));
  button.hidden=motion.matches;
 };
 section.classList.add('opinions-ready');
 button.addEventListener('click',()=>{manualPause=!manualPause;sync();});
 motion.addEventListener('change',sync);
 document.addEventListener('visibilitychange',sync);
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();}).observe(section);
 sync();
}
