import {renderOpinions} from './plantillas-opiniones.mjs';
/* Componentes de portada. Los textos y recursos editables viven en colegio.json. */
export function renderNavigation(current, pages, {e, url}) {
  const sections = {
    'conocenos/': [['quienes-somos','Quiénes somos'],['mision','Misión y visión'],['valores','Nuestros valores']],
    'oferta-educativa/': [['iii-ciclo','III Ciclo'],['diversificada','Educación Diversificada'],['complementarias','Materias complementarias'],['multilingue','Educación multilingüe']],
    'vida-en-el-colegio/': [['propuesta','Nuestra propuesta'],['servicios','Recursos y servicios'],['experiencias','Experiencias']]
  };
  return pages.map(([route, label]) => {
    const parent = `<a href="${url(route)}"${route===current?' aria-current="page"':''}${route==='admisiones/'?' class="nav-admissions"':''}>${e(label)}</a>`;
    if (!sections[route]) return `<div class="nav-item">${parent}</div>`;
    const id = 'submenu-'+route.slice(0,-1);
    return `<div class="nav-item" data-nav-group><div class="nav-parent">${parent}<button class="submenu-toggle" type="button" aria-expanded="false" aria-controls="${id}" aria-label="Apartados de ${e(label)}" hidden><span aria-hidden="true">+</span></button></div><ul class="nav-submenu" id="${id}" hidden>${sections[route].map(([fragment,title])=>`<li><a href="${url(route+'#'+fragment)}">${e(title)}</a></li>`).join('')}</ul></div>`;
  }).join('');
}

export function renderHome(data, {e, url, link, external, form}) {
  const home = data.inicio;
  const cardTitle = id => e(data.oferta.find(item=>item.id===id).titulo).replace('complementarias', 'complemen&shy;tarias');
  return `<section class="portada-hero" id="bienvenida" aria-labelledby="portada-title">
    <div class="portada-media" aria-hidden="true"><img class="portada-poster" src="${url(home.video.poster)}" width="1280" height="720" alt="" fetchpriority="high"><video id="portada-video" data-src="${url(home.video.archivo)}" muted loop playsinline preload="none" disablepictureinpicture tabindex="-1"></video></div>
    <div class="container portada-content"><p class="eyebrow">${e(home.antetitulo)}</p><h1 id="portada-title">${e(home.titulo[0])}<br>${e(home.titulo[1])}<br><strong>${e(home.titulo[2])}</strong></h1><p class="portada-lead">${e(home.descripcion)}</p>${link('#consulta','Solicitar información','button gold')}</div>
    <div class="container portada-bottom"><button id="portada-video-control" class="video-control" type="button" aria-controls="portada-video" hidden><span class="video-symbol" aria-hidden="true">▶</span><span data-video-label>Reproducir video</span></button><p class="video-credit">Video de archivo · Personas y espacios ajenos al colegio.<br>${external(home.video.fuente,'Yan Krukau / Pexels','credit-link')}</p></div>
    <p id="portada-video-status" class="sr-only" role="status" aria-live="polite"></p>
  </section>
  <section class="home-intro" aria-labelledby="intro-title"><div class="container"><p class="eyebrow">Colegio Nuevo Mundo · Costa Rica</p><h2 id="intro-title">${e(home.introduccion.titulo)}</h2><p>${e(home.introduccion.texto)}</p>${link(url('conocenos/'),'Conozca nuestra esencia')}</div></section>
  <section class="home-offer" id="oferta-inicio" aria-labelledby="offer-title"><div class="container"><div class="section-heading"><div><p class="eyebrow">Un mundo por descubrir</p><h2 id="offer-title">${e(home.ofertaTitulo)}</h2></div><p>Explore cada área y consulte sus asignaturas e idiomas.</p></div><div class="offer-grid">${home.tarjetas.map(card=>`<article class="offer-card"><a href="${url('oferta-educativa/#'+card.id)}"><img src="${url(card.imagen)}" width="640" height="480" loading="lazy" decoding="async" alt="" class="offer-image-${card.id}"><div class="offer-card-copy"><h3>${cardTitle(card.id)}</h3><span>Conocer más <span aria-hidden="true">↗</span></span></div></a></article>`).join('')}</div><p class="image-note">Imágenes de referencia e ilustrativas; selección final sujeta a validación del colegio.</p></div></section>
  <section class="home-life" id="vida-inicio" aria-labelledby="life-title"><div class="container home-life-grid"><figure><img src="${url(home.acompanamiento.imagen)}" width="640" height="853" loading="lazy" decoding="async" alt="${e(home.acompanamiento.alt)}"><figcaption>Imagen de referencia de la propuesta visual.</figcaption></figure><div><p class="eyebrow">Cerca, en cada paso</p><h2 id="life-title">${e(home.acompanamiento.titulo)}</h2><div class="home-benefits">${data.beneficios.map(x=>`<article><h3>${e(x.titulo)}</h3><p>${e(x.descripcion)}</p></article>`).join('')}</div>${link(url('vida-en-el-colegio/'),'Explore la vida en el colegio')}</div></div></section>
  ${renderOpinions(data, {e, external})}
  <section class="home-contact" id="consulta" aria-label="Consulta de admisiones"><div class="container">${form}<p class="matricula-image-note">Imagen ilustrativa generada con IA · Uniforme y emblema de referencia del Colegio Nuevo Mundo.</p></div></section>
  <aside class="media-attribution"><div class="container"><p>Video de portada: ${external(home.video.fuente,'Yan Krukau / Pexels','credit-link')}. Recurso de archivo para esta propuesta de diseño. ${external(home.video.licencia,'Consultar licencia','credit-link')}.</p></div></aside>`;
}
