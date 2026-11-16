"""Configuración inicial de la portada. No ejecutar de nuevo para editar contenido."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
file = root/'contenido/colegio.json'
data = json.loads(file.read_text(encoding='utf-8'))
assert 'inicio' not in data, 'La portada ya está configurada; edite colegio.json.'
data['revision'] = '2026-11-15'
data['inicio'] = {
    'antetitulo': 'Una comunidad para aprender y crecer',
    'titulo': ['Aprender hoy,', 'transformar', 'mañana.'],
    'descripcion': 'Educación inclusiva, acompañamiento cercano y formación integral para descubrir nuevas oportunidades de aprendizaje.',
    'video': {
        'archivo': 'assets/portada/portada-optimizada.mp4',
        'poster': 'assets/portada/portada-poster.jpg',
        'fuente': 'https://www.pexels.com/video/group-of-people-studying-in-the-library-8199398/',
        'licencia': 'https://www.pexels.com/license/'
    },
    'introduccion': {
        'titulo': 'Un nuevo mundo empieza con cada estudiante.',
        'texto': 'Acompañamos a cada estudiante con atención personalizada y una formación que conecta conocimientos, creatividad e idiomas. Una comunidad cercana, en comunicación permanente con las familias.'
    },
    'ofertaTitulo': 'Aprender, crear y abrir nuevas posibilidades.',
    'tarjetas': [
        {'id': 'iii-ciclo', 'imagen': 'experiencia-docentes-640.webp'},
        {'id': 'diversificada', 'imagen': 'estudiantes-480.webp'},
        {'id': 'complementarias', 'imagen': 'experiencia-creatividad-640.webp'},
        {'id': 'multilingue', 'imagen': 'experiencia-actividades-640.webp'}
    ],
    'acompanamiento': {
        'titulo': 'Crecer con acompañamiento, cada día.',
        'imagen': 'experiencia-actividades-640.webp',
        'alt': 'Actividad de convivencia, imagen de referencia'
    }
}
file.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

file = root/'scripts/generar-sitio.mjs'
source = file.read_text(encoding='utf-8')
source = source.replace("import assert from 'node:assert/strict';", "import assert from 'node:assert/strict';\nimport {renderHome, renderNavigation} from './plantillas-portada.mjs';")
start = source.index('const nav = ')
end = source.index('\nconst brand = ', start)
source = source[:start]+"const nav = current => renderNavigation(current, pages, {e, url});"+source[end:]
start = source.index('const home = ')
end = source.index('\nconst conocenos = ', start)
source = source[:start]+source[end:]
old = '<div class="utility-bar"><div class="container utility-inner"><div><a href="${url(\'conocenos/\')}">Conozca el colegio</a><a href="${url(\'noticias/\')}">Noticias y actividades</a></div><a class="utility-phone" href="tel:${e(data.contacto.telefonos[0].numero)}">${e(data.contacto.telefonos[0].texto)}</a></div></div>'
new = '<div class="utility-bar"><div class="container utility-inner"><div><a class="utility-phone" href="tel:${e(data.contacto.telefonos[0].numero)}">${e(data.contacto.telefonos[0].texto)}</a><a class="utility-email" href="mailto:${e(data.contacto.correo)}">${e(data.contacto.correo)}</a></div><a href="${url(\'noticias/\')}">Noticias y actividades</a></div></div>'
assert old in source
source = source.replace(old, new)
source = source.replace("connect-src 'self'; frame-src", "connect-src 'self'; media-src 'self'; font-src 'self'; frame-src")
old = '<link rel="stylesheet" href="${url(\'institucional.css?v=1\')}">'
new = '<link rel="stylesheet" href="${url(\'fuentes.css?v=1\')}"><link rel="stylesheet" href="${url(\'institucional.css?v=1\')}"><link rel="stylesheet" href="${url(\'navegacion.css?v=2\')}">${file===undefined && route===\'\'?`<link rel="preload" as="image" href="${url(data.inicio.video.poster)}"><link rel="stylesheet" href="${url(\'portada.css?v=2\')}"><script type="module" src="${url(\'portada.js?v=2\')}"></script>`:\'\'}'
assert old in source
source = source.replace(old, new)
source = source.replace("institucional.js?v=1", "institucional.js?v=2")
source = source.replace("matricula-chat.css?v=6", "matricula-chat.css?v=7")
source = source.replace("matricula-chat.js?v=5", "matricula-chat.js?v=6")
source = source.replace("${route===''?' home-page':''}", "${route==='' && file===undefined?' home-page':''}")
source = source.replace("data.presentacion, home);", "data.presentacion, renderHome(data, {e, url, link, external, form}));")
file.write_text(source, encoding='utf-8')
print('Datos de portada y generador preparados.')
