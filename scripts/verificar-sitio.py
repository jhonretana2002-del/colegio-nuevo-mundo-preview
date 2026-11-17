"""Comprobaciones de la exportación estática. Ejecutar después de generar-sitio.mjs."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'contenido/colegio.json').read_text(encoding='utf-8'))
BASE = DATA['basePath']
PAGES = ['index.html', 'conocenos/index.html', 'oferta-educativa/index.html',
         'vida-en-el-colegio/index.html', 'admisiones/index.html',
         'contacto/index.html', 'noticias/index.html', '404.html']

class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.references = []
        self.links = []
        self.defaults = {}
        self.headings = []
        self.scripts = []
        self.videos = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            assert a['id'] not in self.ids, f"Identificador repetido: {a['id']}"
            self.ids.add(a['id'])
        for name in ['aria-controls', 'aria-labelledby', 'aria-describedby', 'for']:
            if a.get(name): self.references.extend(a[name].split())
        for name in ['href', 'src', 'data-src', 'poster']:
            if a.get(name): self.links.append(a[name])
        if tag == 'details' and 'data-disclosure' in a and 'open' in a:
            self.defaults[a['name']] = self.defaults.get(a['name'], 0) + 1
        if tag == 'h1': self.headings.append(a)
        if tag == 'script': self.scripts.append(a.get('src'))
        if tag == 'video': self.videos.append(a)
        assert 'style' not in a and not any(k.startswith('on') for k in a), 'CSP: sin estilos ni manejadores inline.'

pages = {name: Page((ROOT / name).read_text(encoding='utf-8')) for name in PAGES}
for name, page in pages.items():
    assert len(page.headings) == 1, f'{name}: debe existir un h1'
    assert len(page.references) and set(page.references) <= page.ids, f'{name}: referencias ARIA incompletas'
    assert all(n <= 1 for n in page.defaults.values()), f'{name}: varias aperturas predeterminadas'
    assert all(page.scripts), f'{name}: no usar scripts inline'
    for link in page.links:
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc: continue
        if not parsed.path:
            if parsed.fragment: assert unquote(parsed.fragment) in page.ids, (name, link)
            continue
        assert parsed.path.startswith(BASE), f'Ruta fuera del prefijo: {link}'
        target = unquote(parsed.path[len(BASE):])
        if not target or target.endswith('/'): target += 'index.html'
        assert (ROOT / target).is_file(), f'{name}: archivo no encontrado {target}'
        if parsed.fragment and target in pages:
            assert unquote(parsed.fragment) in pages[target].ids, (name, link)
    assert 'matricula-chat-launcher' in page.ids and 'matricula-chat' in page.ids

source = (ROOT/'conocenos/index.html').read_text(encoding='utf-8')
assert DATA['mision'] in source and DATA['vision'] in source
offer = (ROOT/'oferta-educativa/index.html').read_text(encoding='utf-8')
for item in DATA['oferta']:
    assert f'id="{item["id"]}"' in offer
    assert all(subject in offer for subject in item['items'])
home = (ROOT/'index.html').read_text(encoding='utf-8')
assert 'id="requisitos"' not in home and 'id="aranceles"' not in home
video, = pages['index.html'].videos
assert 'src' not in video and video['preload'] == 'none', 'Video sin descarga inicial obligatoria.'
assert all(name in video for name in ['muted', 'loop', 'playsinline', 'data-src'])
assert 'id="consulta"' in home and 'href="#consulta"' in home
assert 'media-src \'self\'' in home and 'font-src \'self\'' in home
assert all(not page.videos for name, page in pages.items() if name != 'index.html')
for card in DATA['inicio']['tarjetas']:
    assert BASE+'oferta-educativa/#'+card['id'] in home
for css in ['fuentes.css', 'portada.css', 'navegacion.css', 'matricula-chat.css', 'matricula-portada.css', 'opiniones.css']:
    for resource in re.findall(r'url\([\'\"]?([^\)\'\"]+)', (ROOT/css).read_text(encoding='utf-8')):
        assert not urlsplit(resource).scheme, f'{css}: recurso externo inesperado'
        assert (ROOT/resource).is_file(), f'{css}: no existe {resource}'
admission = (ROOT/'admisiones/index.html').read_text(encoding='utf-8')
assert all(item in admission for item in DATA['admisiones']['requisitos'])
assert 'Matrícula abierta' not in home if not DATA['admisiones']['matriculaAbierta'] else True
runtime = (ROOT/'institucional-datos.js').read_text(encoding='utf-8')
config = json.loads(runtime.split('window.colegioContent = ', 1)[1].rstrip(';\n'))
assert len(config['faqs']) == 6
for faq in config['faqs']:
    parsed = urlsplit(faq['url'])
    target = parsed.path[len(BASE):] + 'index.html'
    assert target in pages
    if parsed.fragment: assert parsed.fragment in pages[target].ids
for destination in config['legacy'].values():
    parsed = urlsplit(destination)
    target = parsed.path + 'index.html' if parsed.path else 'index.html'
    assert target in pages
    if parsed.fragment: assert parsed.fragment in pages[target].ids
print(f'Correcto: {len(pages)} páginas, enlaces y recursos locales, anclas, ARIA, contenido oficial y referencias de Lumi.')
