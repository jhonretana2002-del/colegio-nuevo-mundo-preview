import { mayChangeField } from '../lib/content-policy.mjs';

export const GROUPS = [
  { id: 'inicio', title: 'Inicio', description: 'Cambie el mensaje de portada y sus imágenes.', roots: ['inicio'] },
  { id: 'menu', title: 'Menú y encabezado', description: 'Edite el nombre junto al logotipo, los enlaces y los avisos del encabezado.', roots: [] },
  { id: 'institucion', title: 'Conócenos', description: 'Actualice la presentación y los valores del colegio.', roots: ['nombre', 'lema', 'presentacion', 'quienesSomos', 'mision', 'vision', 'historia', 'valores', 'beneficios'] },
  { id: 'oferta', title: 'Oferta educativa', description: 'Revise las áreas, asignaturas e idiomas.', roots: ['oferta'] },
  { id: 'vida', title: 'Vida en el colegio', description: 'Edite servicios, horarios y fotografías.', roots: ['propuesta', 'servicios', 'galeria', 'horarioInstitucional', 'horarioAdministrativo'] },
  { id: 'admisiones', title: 'Admisiones', description: 'Actualice requisitos, fechas y costos.', roots: ['admisiones'] },
  { id: 'contacto', title: 'Contacto', description: 'Mantenga al día teléfonos, ubicación y textos del pie de página.', roots: ['contacto'] },
  { id: 'opiniones', title: 'Opiniones', description: 'Revise los textos que se muestran como opiniones.', roots: ['opiniones', 'presentacionOpiniones'] },
  { id: 'noticias', title: 'Noticias', description: 'Edite la presentación de la página de noticias.', roots: [] },
  { id: 'lumi', title: 'Lumi', description: 'Revise las preguntas y respuestas del asistente de consultas.', roots: [] },
];

const TITLES = {
  antetitulo: 'Frase superior', descripcion: 'Descripción', introduccion: 'Presentación',
  imagen: 'Imagen', imagenGrande: 'Imagen grande', archivo: 'Video', poster: 'Póster',
  titulo: 'Título', texto: 'Texto', resumen: 'Resumen', parrafos: 'Párrafos',
  dias: 'Días', horas: 'Horas', monto: 'Monto', rubro: 'Rubro', condicion: 'Condición',
  numero: 'Número', correo: 'Correo', direccion: 'Dirección', cursoLectivo: 'Curso lectivo',
  matriculaAbierta: 'Matrícula abierta', calendarioConfirmado: 'Calendario confirmado',
  fechaTexto: 'Fecha visible', alt: 'Texto alternativo', fuente: 'Fuente', licencia: 'Licencia',
  autor: 'Autor', aviso: 'Aviso', consulta: 'Mensaje de consulta',
  nombre: 'Nombre del colegio', lema: 'Lema del colegio (pie de página)', presentacion: 'Presentación general',
  quienesSomos: 'Quiénes somos', mision: 'Misión', vision: 'Visión',
  ofertaTitulo: 'Título de la oferta', acompanamiento: 'Acompañamiento',
  imagenGrande: 'Imagen para pantallas grandes', mapaEmbed: 'Mapa dentro de la página',
  prematricula: 'Prematrícula', periodo: 'Período de matrícula',
  items: 'Asignatura o idioma', propuesta: 'Idea', requisitos: 'Requisito',
};
const SECTION_TITLES = {
  titulo: 'Mensaje principal',
  video: 'Video de portada', introduccion: 'Presentación de portada', tarjetas: 'Tarjetas de oferta',
  acompanamiento: 'Acompañamiento', valores: 'Valores', beneficios: 'Beneficios',
  servicios: 'Servicios', galeria: 'Galería de fotos', oferta: 'Áreas educativas',
  propuesta: 'Nuestra propuesta', horarioInstitucional: 'Horario del colegio',
  horarioAdministrativo: 'Horario de oficina', aranceles: 'Costos',
  reserva: 'Reserva', horarioPrematricula: 'Horario de prematrícula',
  telefonos: 'Teléfonos', whatsapp: 'WhatsApp', opiniones: 'Opiniones',
  presentacionOpiniones: 'Presentación de opiniones', ejemplos: 'Opiniones de muestra',
};
const MEDIA_KEYS = new Set(['imagen', 'imagenGrande', 'archivo', 'poster']);
const URL_KEYS = new Set(['facebook', 'instagram', 'mapa', 'mapaEmbed', 'fuente', 'licencia']);
const OBJECT_TEMPLATES = {
  historia: { resumen: '', parrafos: [''] },
  horarioAdministrativo: [{ dias: '', horas: '' }],
};
const PAGE_LABELS = {
  aviso: 'Aviso de vista previa', saltarEnlace: 'Enlace para saltar al contenido', menuBoton: 'Botón del menú',
  marcaColegio: 'Primera línea junto al logotipo', marcaNombre: 'Nombre junto al logotipo', marcaPais: 'País junto al logotipo',
  marcaAria: 'Descripción accesible del logotipo', navAria: 'Descripción accesible del menú', consultarTemaEnlace: 'Enlace para consultar un tema',
  inicioEnlace: 'Inicio', ofertaEnlace: 'Oferta educativa', admisionesEnlace: 'Admisiones', contactoEnlace: 'Contacto', noticiasEnlace: 'Noticias',
  quienesSubmenu: 'Quiénes somos', misionSubmenu: 'Misión y visión', valoresSubmenu: 'Nuestros valores',
  iiiCicloSubmenu: 'III Ciclo', diversificadaSubmenu: 'Educación Diversificada', complementariasSubmenu: 'Materias complementarias', multilingueSubmenu: 'Educación multilingüe',
  propuestaSubmenu: 'Nuestra propuesta', serviciosSubmenu: 'Recursos y servicios', experienciasSubmenu: 'Experiencias',
  whatsappEtiqueta: 'Etiqueta de WhatsApp', adminEnlace: 'Enlace al acceso administrativo',
  consultaCorreoTexto: 'Texto antes del correo', consultaWhatsappMensaje: 'Mensaje inicial de WhatsApp', consultaWhatsappEnlace: 'Botón de WhatsApp',
  formNombre: 'Campo: nombre de la familia', formTelefono: 'Campo: teléfono', formCorreo: 'Campo: correo', formNivel: 'Campo: nivel de interés',
  formNivelSeleccione: 'Opción inicial del nivel', formNivelCiclo: 'Opción III Ciclo', formNivelDiversificada: 'Opción Educación Diversificada', formNivelOrientacion: 'Opción de orientación',
  formMensaje: 'Campo: consulta', formRevisar: 'Botón para revisar', formNota: 'Aviso del formulario',
  formRevisionTitulo: 'Título de revisión', formRevisionNota: 'Aviso antes de enviar', formEnviar: 'Botón para abrir WhatsApp',
  formValidacion: 'Mensaje al completar un campo', formEstado: 'Aviso de consulta preparada',
  formWhatsappNombre: 'WhatsApp: nombre', formWhatsappTelefono: 'WhatsApp: teléfono', formWhatsappCorreo: 'WhatsApp: correo',
  formWhatsappNivel: 'WhatsApp: nivel', formWhatsappConsulta: 'WhatsApp: consulta',
  arancelesCursoTexto: 'Texto del curso lectivo', arancelesTablaTitulo: 'Título de la tabla de costos',
  arancelesRubro: 'Columna de rubro', arancelesMonto: 'Columna de monto', arancelesCondicion: 'Columna de condición',
  arancelesMontoPendiente: 'Texto cuando falta el monto', arancelesPanelTitulo: 'Título de aranceles',
  arancelesResumenCursoTexto: 'Resumen del curso lectivo', arancelesResumenPendiente: 'Resumen sin costos confirmados',
  requisitosPanelTitulo: 'Título de requisitos', prematriculaPanelTitulo: 'Título de prematrícula',
  prematriculaReservaEtiqueta: 'Etiqueta de reserva', prematriculaConfirmadaNota: 'Nota de reserva confirmada', prematriculaPendienteNota: 'Nota de reserva pendiente',
  periodoPanelTitulo: 'Título del período', periodoCursoEtiqueta: 'Etiqueta de curso lectivo', periodoPendienteNota: 'Nota de fechas pendientes',
  reservaEtiqueta: 'Etiqueta de reserva', verRequisitosEnlace: 'Enlace a requisitos', consultarArancelesEnlace: 'Enlace a aranceles',
  historiaPanelTitulo: 'Título para abrir la historia', contacteEnlace: 'Enlace para contactar', verOfertaEnlace: 'Enlace a la oferta',
  solicitarInfoEnlace: 'Botón para solicitar información', galeriaAviso: 'Aviso de las fotografías', coordinarConsultaEnlace: 'Enlace para coordinar una consulta',
  telefonoEtiqueta: 'Etiqueta de teléfono', llamarEnlace: 'Enlace para llamar', whatsappEnlace: 'Enlace de WhatsApp',
  correoEtiqueta: 'Etiqueta de correo', correoEnlace: 'Enlace para escribir correo', mapaEnlace: 'Enlace del mapa',
  facebookEnlace: 'Enlace de Facebook', instagramEnlace: 'Enlace de Instagram', mapaTitulo: 'Título del mapa',
  prepararConsultaEnlace: 'Botón para preparar consulta',
  consultaAria: 'Descripción del botón de consulta', videoControl: 'Botón para reproducir video', videoPausar: 'Botón para pausar video', videoReintentar: 'Botón para reintentar video',
  videoError: 'Aviso si el video falla', videoPausado: 'Aviso de video pausado', videoReproduciendo: 'Aviso de video en reproducción', videoAviso: 'Nota del video', videoCredito: 'Crédito del video',
  imagenOfertaAviso: 'Nota de imagen de la oferta', imagenAcompanamientoAviso: 'Nota de imagen de acompañamiento', imagenMatriculaAviso: 'Nota de imagen de matrícula',
  atribucionVideoEtiqueta: 'Etiqueta del crédito del video', atribucionVideoNota: 'Nota sobre el video', consultarLicenciaEnlace: 'Enlace para consultar la licencia',
  invitacionFacebookEnlace: 'Enlace de invitación a Facebook', invitacionInstagramEnlace: 'Enlace de invitación a Instagram', verOriginalEnlace: 'Enlace a recomendación original',
  pausarCarrusel: 'Botón para pausar opiniones', reanudarCarrusel: 'Botón para reanudar opiniones',
  matriculaPregunta: 'Pregunta sobre matrícula', matriculaResumen: 'Tema: matrícula', matriculaRespuesta: 'Respuesta sobre matrícula', matriculaEnlace: 'Enlace a admisiones',
  requisitosPregunta: 'Pregunta sobre requisitos', requisitosResumen: 'Tema: requisitos', requisitosAntes: 'Texto antes de la lista de requisitos', requisitosDespues: 'Aviso después de los requisitos', requisitosEnlace: 'Enlace a requisitos',
  costosPregunta: 'Pregunta sobre costos', costosResumen: 'Tema: costos', costosCursoEtiqueta: 'Etiqueta del curso lectivo', costosPendiente: 'Texto para un monto pendiente', costosReservaAntes: 'Texto antes del monto de reserva', costosReservaDespues: 'Aviso después de la reserva', costosEnlace: 'Enlace a aranceles',
  cuposPregunta: 'Pregunta sobre cupos', cuposResumen: 'Tema: cupos y fechas', cuposCursoEtiqueta: 'Etiqueta del curso lectivo', cuposPendiente: 'Aviso de fechas pendientes', cuposNota: 'Aviso sobre disponibilidad', cuposEnlace: 'Enlace a fechas de matrícula',
  ofertaPregunta: 'Pregunta sobre materias e idiomas', ofertaResumen: 'Tema: oferta educativa', ofertaNota: 'Aviso sobre la oferta', ofertaEnlace: 'Enlace a materias e idiomas',
  visitaPregunta: 'Pregunta sobre visitas', visitaResumen: 'Tema: visitas', visitaIntroduccion: 'Texto antes de la dirección', visitaHorarioEtiqueta: 'Etiqueta del horario', visitaNota: 'Aviso sobre coordinación', visitaEnlace: 'Enlace a contacto',
  titulo: 'Título principal', introduccion: 'Texto introductorio', antetitulo: 'Frase superior', descripcionBuscadores: 'Resumen para buscadores',
  introAntetitulo: 'Frase de presentación', consultaEnlace: 'Botón de consulta', conocenosEnlace: 'Enlace para conocer el colegio', ofertaAntetitulo: 'Frase de la oferta', ofertaDescripcion: 'Descripción de la oferta', tarjetasEnlace: 'Enlace de tarjetas', vidaAntetitulo: 'Frase de vida en el colegio', vidaEnlace: 'Enlace a vida en el colegio',
  quienesAntetitulo: 'Frase de quiénes somos', quienesTitulo: 'Título de quiénes somos', misionAntetitulo: 'Frase de misión', misionTitulo: 'Título de misión', visionAntetitulo: 'Frase de visión', visionTitulo: 'Título de visión', valoresAntetitulo: 'Frase de valores', valoresTitulo: 'Título de valores', historiaTitulo: 'Título de historia', historiaAlternativaTitulo: 'Título para presentar el colegio', historiaInvitacion: 'Invitación a conocer el colegio',
  instruccion: 'Instrucción para consultar la oferta', nota: 'Nota sobre la oferta',
  propuestaAntetitulo: 'Frase de nuestra propuesta', propuestaTitulo: 'Título de nuestra propuesta', horarioAntetitulo: 'Frase del horario', horarioNota: 'Nota sobre visitas', serviciosAntetitulo: 'Frase de servicios', serviciosTitulo: 'Título de servicios', experienciasAntetitulo: 'Frase de experiencias', experienciasTitulo: 'Título de experiencias',
  procesoTitulo: 'Título del proceso', detallesTitulo: 'Título de detalles',
  fechasTitulo: 'Título de fechas y reserva', calendarioPendiente: 'Aviso de fechas pendientes', detalleAntetitulo: 'Frase de los detalles',
  requisitosResumen: 'Resumen de requisitos', prematriculaResumen: 'Resumen de prematrícula', periodoResumen: 'Resumen del período',
  arancelesPendientes: 'Aviso de aranceles pendientes', arancelesNota: 'Nota sobre la reserva',
  referenciaAntetitulo: 'Frase de fechas y reserva', consultaAntetitulo: 'Frase del formulario', consultaTitulo: 'Título del formulario de consulta', consultaTexto: 'Explicación del formulario',
  paso1Titulo: 'Paso 1: título', paso1Texto: 'Paso 1: explicación', paso2Titulo: 'Paso 2: título', paso2Texto: 'Paso 2: explicación', paso3Titulo: 'Paso 3: título', paso3Texto: 'Paso 3: explicación',
  contactoAntetitulo: 'Frase de contacto', contactoTitulo: 'Título de contacto', ubicacionAntetitulo: 'Frase de ubicación', ubicacionTitulo: 'Título de ubicación', visitasNota: 'Nota sobre visitas', sinNoticias: 'Mensaje sin noticias',
  llamadaTitulo: 'Título de la invitación', llamadaTexto: 'Texto de la invitación',
  horarioTitulo: 'Título de horario', atencionTitulo: 'Título de horario de atención',
  verificadasAntetitulo: 'Frase de opiniones verificadas', verificadasTituloLinea1: 'Título: primera línea', verificadasTituloLinea2: 'Título: segunda línea', verificadasIntroduccion: 'Introducción de opiniones',
  invitacionFacebookAntetitulo: 'Frase de invitación a Facebook', invitacionFacebookTitulo: 'Título de invitación a Facebook', invitacionFacebookTexto: 'Texto de invitación a Facebook',
  invitacionInstagramAntetitulo: 'Frase de invitación a Instagram', invitacionInstagramTitulo: 'Título de invitación a Instagram', invitacionInstagramTexto: 'Texto de invitación a Instagram',
  ejemplosAntetitulo: 'Frase de la muestra de opiniones', ejemplosIntroduccion: 'Introducción de la muestra',
};

export function readPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

export function writePath(object, path, value) {
  const parts = path.split('.');
  const key = parts.pop();
  const parent = parts.reduce((node, part) => node[part], object);
  parent[key] = value;
}

function groupFor(parts) {
  if (parts[0] === 'paginas') return parts[1] === 'conocenos' ? 'institucion' : parts[1] === 'navegacion' ? 'menu' : parts[1] === 'pie' ? 'contacto' : parts[1];
  return GROUPS.find(group => group.roots.includes(parts[0]))?.id;
}

function labelFor(path, content) {
  const parts = path.split('.');
  const key = parts.at(-1);
  if (parts[0] === 'paginas') return path === 'paginas.pie.aviso' ? 'Aviso del pie de página' : PAGE_LABELS[key] ?? key;
  if (parts.length === 1) return TITLES[key] ?? key;
  if (/^\d+$/.test(key)) return parts.at(-2)==='titulo'?`Línea ${Number(key)+1} del título`:`${TITLES[parts.at(-2)] ?? 'Texto'} ${Number(key) + 1}`;
  if (parts.length === 2) return TITLES[key] ?? key.replace(/([A-Z])/g, ' $1').toLowerCase();
  const parent = readPath(content, parts.slice(0, -1).join('.'));
  const name = parent?.titulo ?? parent?.rubro ?? parent?.autor;
  return name ? `${name}: ${TITLES[key] ?? key}` : (TITLES[key] ?? key.replace(/([A-Z])/g, ' $1').toLowerCase());
}

function sectionFor(path, content) {
  const parts = path.split('.');
  const root = parts[0];
  if (root === 'paginas') {
    if (parts[1] === 'pie') return { section: 'paginas.pie', sectionTitle: 'Pie de página' };
    if (parts[1] === 'navegacion') return { section: 'paginas.navegacion', sectionTitle: 'Nombre, menú y avisos' };
    if (parts[1] === 'lumi') {
      const topic = ['matricula', 'requisitos', 'costos', 'cupos', 'oferta', 'visita'].find(name => parts[2].startsWith(name));
      const titles = { matricula: 'Matrícula', requisitos: 'Requisitos', costos: 'Costos y reserva', cupos: 'Cupos y fechas', oferta: 'Materias e idiomas', visita: 'Visitas' };
      return { section: `paginas.lumi.${topic}`, sectionTitle: titles[topic] };
    }
    const key = parts[2];
    let part = ['titulo', 'introduccion', 'antetitulo', 'descripcionBuscadores'].includes(key) ? 'presentacion' : key.startsWith('paso') ? 'pasos' : 'contenido';
    if (parts[1] === 'admisiones' && part === 'contenido') {
      if (key.startsWith('consulta') || key.startsWith('form')) part = 'consulta';
      else if (key.startsWith('aranceles')) part = 'costos';
      else if (['fechasTitulo', 'referenciaAntetitulo', 'calendarioPendiente', 'prematriculaResumen', 'periodoResumen'].includes(key) || key.startsWith('prematricula') || key.startsWith('periodo') || key==='reservaEtiqueta') part = 'fechas';
      else part = 'detalles';
    }
    if (parts[1] === 'contacto' && part === 'contenido') {
      if (['telefonoEtiqueta','llamarEnlace','whatsappEtiqueta','whatsappEnlace','correoEtiqueta','correoEnlace','facebookEnlace','instagramEnlace'].includes(key)) part = 'metodos';
      else if (['mapaEnlace','mapaTitulo','ubicacionAntetitulo','ubicacionTitulo','horarioTitulo','atencionTitulo','visitasNota'].includes(key)) part = 'ubicacion';
    }
    if (parts[1] === 'inicio' && part === 'contenido') {
      if (key.startsWith('video') || key.startsWith('atribucionVideo') || key === 'consultarLicenciaEnlace') part = 'video';
      else if (key.startsWith('imagen')) part = 'imagenes';
    }
    if (parts[1] === 'opiniones') part = key.startsWith('verificadas') ? 'verificadas' : key.startsWith('invitacionFacebook') ? 'facebook' : key.startsWith('invitacionInstagram') ? 'instagram' : 'ejemplos';
    const title = { presentacion: 'Presentación de la página', pasos: 'Pasos de admisión', contenido: 'Textos de las secciones', video: 'Textos del video', imagenes: 'Notas de las imágenes', fechas: 'Fechas y reserva', costos: 'Costos y aranceles', consulta: 'Formulario de consulta', detalles: 'Requisitos y detalles', metodos: 'Formas de contacto', ubicacion: 'Ubicación y horario', verificadas: 'Opiniones verificadas', facebook: 'Invitación a Facebook', instagram: 'Invitación a Instagram', ejemplos: 'Muestra de opiniones' }[part];
    return { section: `${parts[0]}.${parts[1]}.${part}`, sectionTitle: title };
  }
  let section = root;
  if (['nombre', 'lema', 'presentacion', 'quienesSomos', 'mision', 'vision', 'historia'].includes(root)) section = 'institucion.general';
  if (root === 'inicio' || root === 'admisiones' || root === 'contacto' || root === 'presentacionOpiniones') section = parts.length > 2 ? `${root}.${parts[1]}` : `${root}.general`;
  if (['oferta', 'valores', 'beneficios', 'servicios', 'galeria', 'opiniones'].includes(root) && /^\d+$/.test(parts[1] ?? '')) section = `${root}.${parts[1]}`;
  if (root === 'inicio' && parts[1] === 'tarjetas' && /^\d+$/.test(parts[2] ?? '')) section = `inicio.tarjetas.${parts[2]}`;
  if (root === 'admisiones' && parts[1] === 'aranceles' && /^\d+$/.test(parts[2] ?? '')) section = `admisiones.aranceles.${parts[2]}`;
  if (root === 'contacto' && parts[1] === 'telefonos' && /^\d+$/.test(parts[2] ?? '')) section = `contacto.telefonos.${parts[2]}`;
  const sectionParts = section.split('.');
  const number = sectionParts.find(part => /^\d+$/.test(part));
  const parentKey = sectionParts.find(part => part in SECTION_TITLES) ?? root;
  const item = number !== undefined ? readPath(content, section) : null;
  const offerName = section.startsWith('inicio.tarjetas.') ? content.oferta.find(offer => offer.id === item?.id)?.titulo : null;
  const name = item?.titulo ?? item?.rubro ?? item?.autor ?? offerName;
  const title = number === undefined ? (SECTION_TITLES[parentKey] ?? 'Información general') :
    `${SECTION_TITLES[parentKey] ?? 'Elemento'}: ${name ?? `n.º ${Number(number) + 1}`}`;
  return { section, sectionTitle: title };
}

function candidate(value, path) {
  if (typeof value === 'string') return value + 'x';
  if (typeof value === 'number') return value + 1;
  if (typeof value === 'boolean') return !value;
  if (value === null && path === 'historia') return structuredClone(OBJECT_TEMPLATES.historia);
  if (value === null && path === 'horarioAdministrativo') return structuredClone(OBJECT_TEMPLATES.horarioAdministrativo);
  if (value === null) return 'x';
  return undefined;
}

function fieldKind(value, path) {
  if (path in OBJECT_TEMPLATES) return 'optional-structure';
  const key = path.split('.').at(-1);
  if (MEDIA_KEYS.has(key)) return 'media';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number' || (value === null && key === 'monto')) return 'number';
  if (key === 'correo') return 'email';
  if (URL_KEYS.has(key)) return 'url';
  return 'text';
}

export function editableFields(content, role) {
  const fields = [];
  function visit(value, parts) {
    const path = parts.join('.');
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, [...parts, String(index)]));
    if (value !== null && typeof value === 'object') return Object.entries(value).forEach(([key, item]) => visit(item, [...parts, key]));
    const after = candidate(value, path);
    if (after === undefined || !mayChangeField(role, { path: parts, before: value, after, kind: after !== null && typeof after === 'object' ? 'structure' : 'value' })) return;
    const group = groupFor(parts);
    if (!group) return;
    fields.push({ path, group, label: labelFor(path, content), kind: fieldKind(value, path), value, ...sectionFor(path, content) });
  }
  visit(content, []);
  return fields;
}

export function optionalTemplate(path) {
  return path in OBJECT_TEMPLATES ? structuredClone(OBJECT_TEMPLATES[path]) : undefined;
}
