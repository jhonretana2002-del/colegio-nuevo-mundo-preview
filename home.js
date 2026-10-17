const campaign=document.querySelector('.campaign-hero');
if(campaign){
 const messages=[
  {kicker:'APRENDER. CRECER. TRASCENDER.',title:'Un nuevo mundo',highlight:'para tu futuro.',description:'Cada etapa es una oportunidad para aprender, descubrir y crecer. Conozca nuestra comunidad educativa.',label:'Conozca el colegio',target:'#institucion'},
  {kicker:'OFERTA ACADÉMICA',title:'Cada etapa abre',highlight:'posibilidades.',description:'Primaria, secundaria y educación diversificada. Consulte con nuestro equipo los niveles y la disponibilidad vigente.',label:'Explore la oferta académica',target:'#oferta'},
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
