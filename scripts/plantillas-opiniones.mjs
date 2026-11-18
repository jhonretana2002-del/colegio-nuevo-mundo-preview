import assert from 'node:assert/strict';
export function renderOpinions(data,{e,external}){
 if(data.presentacionOpiniones?.modo==='ejemplos')return renderExamples(data.presentacionOpiniones,e);
 const opinions=(data.opiniones??[]).filter(item=>item.verificada);
 for(const item of opinions){
  assert.ok(item.autor && item.fecha && /^https:\/\//.test(item.fuente),'Una opinión debe tener autor, fecha y fuente verificable.');
  assert.ok(item.tipo==='recomendacion' || item.texto,'Una opinión escrita debe conservar el texto de la fuente.');
 }
 const rating=item=>{
  if(item.puntuacion!==undefined && item.puntuacion!==null){
   assert.ok(Number.isFinite(item.puntuacion) && item.puntuacion>=0 && item.puntuacion<=5 && item.escala===5, 'La puntuación debe proceder de la fuente y usar una escala de cinco.');
   const stars=Array.from({length:5},(_,i)=>`<span class="${i<Math.floor(item.puntuacion)?'star-filled':'star-empty'}">${i<Math.floor(item.puntuacion)?'★':'☆'}</span>`).join('');
   return `<div class="opinion-rating"><span class="opinion-stars" aria-hidden="true">${stars}</span><span>${e(item.puntuacion)} / 5 · ${e(item.plataforma??'Facebook')}</span></div>`;
  }
  return '<div class="opinion-rating"><span class="opinion-recommend-star" aria-hidden="true">★</span><span>Recomienda el colegio<small>Recomendación positiva · sin nota numérica</small></span></div>';
 };
 const cards=opinions.map(item=>`<article class="opinion-card"><p class="opinion-type">Recomendación pública · Facebook</p><div class="opinion-author"><span aria-hidden="true">${e(item.autor.slice(0,1))}</span><div><h3>${e(item.autor)}</h3><time datetime="${e(item.fecha)}">${e(item.fechaTexto)}</time></div></div>${item.texto?`<blockquote><p>${e(item.texto)}</p></blockquote>`:`<p class="opinion-message">Recomienda al Colegio Nuevo Mundo CR.</p><p class="opinion-context">Recomendación sin comentario escrito.</p>`}${rating(item)}${external(item.fuente,'Ver recomendación original','opinion-link')}</article>`);
 cards.push(`<article class="opinion-card opinion-invitation"><p class="opinion-type">Participa en la comunidad</p><h3>Tu experiencia puede orientar a otra familia.</h3><p class="opinion-message">Consulta las recomendaciones públicas o comparte tu experiencia en el perfil del colegio.</p>${external(data.contacto.facebook+'/reviews/','Ir a recomendaciones','opinion-link')}</article>`);
 cards.push(`<article class="opinion-card opinion-invitation"><p class="opinion-type">Conoce el colegio</p><h3>Una comunidad que aprende y comparte.</h3><p class="opinion-message">Descubre las actividades y novedades que el colegio comparte en sus redes.</p>${external(data.contacto.instagram,'Explorar nuestra comunidad','opinion-link')}</article>`);
 const originals=cards.join('');
 // Copia visual para continuidad; sin duplicar elementos en el recorrido de teclado.
 const copies=originals.replaceAll('<a ', '<a tabindex="-1" ');
 return `<section class="home-opinions" id="opiniones" aria-labelledby="opinions-title"><div class="container"><p class="eyebrow">Experiencias y comunidad</p><h2 id="opinions-title">Lo que comparte<br>nuestra comunidad.</h2><p class="opinions-intro">Recomendaciones públicas y espacios para conocer el Colegio Nuevo Mundo.</p><p class="opinions-source-note">${opinions.length} recomendación pública verificada. Las tarjetas de invitación no son testimonios ni calificaciones.</p><button id="opinions-toggle" class="opinions-toggle" type="button" aria-controls="opinions-track" aria-pressed="false" hidden>Pausar carrusel</button></div><div class="opinions-marquee"><div class="opinions-track" id="opinions-track"><div class="opinions-set">${originals}</div><div class="opinions-set opinions-copy" aria-hidden="true">${copies}</div></div></div><div class="container"><p class="opinions-note">Se conserva la fecha original de cada recomendación. El vínculo del autor con una familia del colegio no está confirmado.</p></div></section>`;
}

function renderExamples(config,e){
 assert.ok(config.ejemplos.length>0,'Se necesita al menos una tarjeta de ejemplo.');
 const cards=config.ejemplos.map(item=>{
  assert.ok(item.tipo==='ejemplo' && item.puntuacion===5 && item.autor && item.texto,'Los ejemplos deben identificarse como tales.');
  return `<article class="opinion-card opinion-example"><div class="opinion-author"><span aria-hidden="true"></span><div><h3>${e(item.autor)}</h3><small class="opinion-example-label">Reseña de ejemplo · nombre ficticio</small></div></div><blockquote><p>«${e(item.texto)}»</p></blockquote><div class="opinion-rating opinion-example-rating" role="img" aria-label="Cinco estrellas de ejemplo; no es una calificación real"><span class="opinion-stars" aria-hidden="true">★★★★★</span></div></article>`;
 }).join('');
 return `<section class="home-opinions" id="opiniones" aria-labelledby="opinions-title"><div class="container"><p class="eyebrow">Experiencias de familias · muestra de diseño</p><h2 id="opinions-title">${e(config.titulo)}</h2><p class="opinions-intro">Así se presentarán las experiencias de las familias del Colegio Nuevo Mundo.</p><p class="opinions-example-notice">${e(config.aviso)}</p><button id="opinions-toggle" class="opinions-toggle" type="button" aria-controls="opinions-track" aria-pressed="false" hidden>Pausar carrusel</button></div><div class="opinions-marquee"><div class="opinions-track" id="opinions-track"><div class="opinions-set">${cards}</div><div class="opinions-set opinions-copy" aria-hidden="true">${cards}</div></div></div></section>`;
}
