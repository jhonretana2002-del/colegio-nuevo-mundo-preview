export function validateDraft(data){
 const errors=[];const a=data.admisiones;
 if(!data.nombre.trim()||data.inicio.titulo.some(line=>!line.trim()))errors.push('Complete el nombre del colegio y las tres líneas del título.');
 if(!data.lema.trim()||Array.from(data.lema).length>100)errors.push('Complete el lema del colegio en un máximo de 100 caracteres.');
 if(data.paginas&&Object.values(data.paginas).some(page=>Object.values(page).some(value=>typeof value!=='string'||!value.trim())))errors.push('Complete los títulos y textos de presentación de las páginas.');
 if(data.paginas){
  const names={navegacion:'Menú del sitio',inicio:'Inicio',conocenos:'Conócenos',oferta:'Oferta educativa',vida:'Vida en el colegio',admisiones:'Admisiones',contacto:'Contacto',pie:'Pie de página',opiniones:'Opiniones',noticias:'Noticias',error404:'Página no encontrada',lumi:'Lumi'};
  for(const [page,items] of Object.entries(data.paginas))for(const [key,value] of Object.entries(items)){
   if(typeof value!=='string')continue;
   const limit=page==='lumi'?(key==='launcherName'?20:key.endsWith('Pregunta')?100:key.endsWith('Resumen')||key.endsWith('Enlace')||key.endsWith('Etiqueta')||key.endsWith('Aria')||['launcherSign','heading1','heading2','kicker','schoolName','chatTitle','questionsHeading','advisorButton','advisorSubtext','inputLabel','inputPlaceholder','advisorPlaceholder','demoNote','contactLink','authorVisitor'].includes(key)?60:['matriculaRespuesta','advisorAnswer','advisorConfirmation','fallbackAnswer'].includes(key)?350:250):key.startsWith('marca')&&key!=='marcaAria'?30:key==='tituloPestana'||key==='apartadosAriaPrefijo'||key.endsWith('Enlace')||key.endsWith('Submenu')||key.endsWith('Etiqueta')||key.endsWith('PanelTitulo')||key==='menuBoton'||['marcaAria','navAria','arancelesRubro','arancelesMonto','arancelesCondicion','arancelesMontoPendiente','consultaAria','videoControl','videoPausar','videoReintentar','videoPausado','videoReproduciendo','videoCredito','pausarCarrusel','reanudarCarrusel'].includes(key)||key.startsWith('form')&&!['formNota','formRevisionNota','formEstado'].includes(key)?60:key==='aviso'||key.endsWith('Aviso')||['videoError','atribucionVideoNota','formNota','formRevisionNota','formEstado','consultaWhatsappMensaje'].includes(key)?250:key==='whatsappEtiqueta'?40:key==='descripcionBuscadores'?180:key==='titulo'||/Titulo(?:Linea\d)?$/.test(key)?100:key==='antetitulo'||key.endsWith('Antetitulo')?80:500;
   if(Array.from(value).length>limit)errors.push(`Acorte el texto «${value.slice(0,30)}…» en ${names[page]??page}: máximo ${limit} caracteres.`);
  }
 }
 const opinionCopy=data.paginas?.opiniones;
 if(opinionCopy){
  const disclosures=[
   [opinionCopy.recomendacionSinComentario,/sin comentario/i],
   [opinionCopy.recomendacionSinNotaAviso,/sin nota num[eé]rica/i],
   [opinionCopy.verificadasCuentaNota,/no son testimonios ni calificaciones/i],
   [opinionCopy.verificadasNota,/no est[aá] confirmado/i],
   [opinionCopy.ejemploEtiqueta,/ejemplo/i],
   [opinionCopy.ejemploEtiqueta,/ficticio/i],
   [opinionCopy.ejemploEstrellasAria,/ejemplo/i],
   [opinionCopy.ejemploEstrellasAria,/no es una calificaci[oó]n real/i],
  ];
  if(disclosures.some(([value,pattern])=>typeof value!=='string'||!pattern.test(value)))errors.push('Conserve en Opiniones los avisos que distinguen las recomendaciones verificadas, las notas ausentes y los ejemplos ficticios.');
 }
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contacto.correo))errors.push('Revise el correo electrónico.');
 if(!/^\d{8,15}$/.test(data.contacto.whatsapp.numero))errors.push('WhatsApp debe contener entre 8 y 15 dígitos, incluido el código de país.');
 if((a.calendarioConfirmado||a.matriculaAbierta||a.aranceles.some(f=>f.monto!==null))&&!a.cursoLectivo)errors.push('Indique el curso lectivo antes de confirmar fechas o registrar aranceles.');
 if(a.matriculaAbierta&&!a.calendarioConfirmado)errors.push('Confirme el calendario antes de anunciar matrícula abierta.');
 if([...a.aranceles,a.reserva].some(f=>f.monto!==null&&(!Number.isFinite(f.monto)||f.monto<0)))errors.push('Los montos deben ser números iguales o mayores que cero.');
 if(data.oferta.some(item=>!item.items.length))errors.push('Cada área debe conservar su lista de asignaturas o idiomas.');
 if(data.historia!==null&&(!data.historia.resumen.trim()||!data.historia.parrafos.length||data.historia.parrafos.some(text=>!text.trim())))errors.push('Complete la historia institucional antes de guardar.');
 if(data.horarioAdministrativo!==null&&(!data.horarioAdministrativo.length||data.horarioAdministrativo.some(item=>!item.dias.trim()||!item.horas.trim())))errors.push('Complete los días y horas del horario administrativo.');
 const links=[data.contacto.facebook,data.contacto.instagram,data.contacto.mapa,data.contacto.mapaEmbed,data.inicio.video.fuente,data.inicio.video.licencia,...data.opiniones.map(item=>item.fuente)];
 if(links.some(link=>link!==null&&(!/^https:\/\//i.test(link)||!safeHttps(link))))errors.push('Los enlaces externos deben usar HTTPS y una URL válida.');
 if(data.contacto.mapaEmbed!==null&&!isGoogleMaps(data.contacto.mapaEmbed))errors.push('El mapa incrustado debe proceder de Google Maps.');
 return errors;
}

function safeHttps(value){
 try{const url=new URL(value);return url.protocol==='https:'&&Boolean(url.hostname)&&!url.username&&!url.password;}
 catch{return false;}
}
function isGoogleMaps(value){
 try{const host=new URL(value).hostname.toLowerCase();return host==='google.com'||host.endsWith('.google.com');}
 catch{return false;}
}
