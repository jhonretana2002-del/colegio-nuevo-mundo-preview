"""Preparación puntual de los recursos locales de la propuesta audiovisual."""
from pathlib import Path
from urllib.request import Request, urlopen
import json
import re
import shutil
from io import BytesIO
from fontTools.ttLib import TTFont
from fontTools import subset

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'assets/portada'
TARGET.mkdir(parents=True, exist_ok=True)
for name in ['portada-optimizada.mp4', 'portada-poster.jpg']:
    shutil.copy2(ROOT / 'output/muestra-portada-audiovisual/assets' / name, TARGET / name)

fonts = ROOT / 'assets/fuentes'
fonts.mkdir(parents=True, exist_ok=True)
families = [('Kumbh Sans', 'Kumbh+Sans:wght@400;500;600;700;800', 'kumbhsans'),
            ('Noto Sans', 'Noto+Sans:wght@400;500;600;700', 'notosans')]
rules = ['/* Fuentes locales: Google Fonts, subconjunto latino. Licencias OFL en assets/fuentes. */']
for family, query, slug in families:
    request = Request('https://fonts.googleapis.com/css2?family='+query+'&display=swap',
                      headers={'User-Agent': 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36'})
    css = urlopen(request, timeout=30).read().decode()
    latin = css.split('/* latin */')[-1]
    assert '@font-face' in latin and 'fonts.gstatic.com' in latin
    urls = list(dict.fromkeys(re.findall(r'url\((https://[^)]+)\)', latin)))
    for i, url in enumerate(urls):
        name = f'{slug}-latin-{i}.woff2'
        font = TTFont(BytesIO(urlopen(url, timeout=30).read()))
        options = subset.Options()
        options.flavor = 'woff2'
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=list(range(0x100)) + list(range(0x2000,0x2070)) +
                           [0x131,0x152,0x153,0x2bb,0x2bc,0x2c6,0x2da,0x2dc,0x304,0x308,0x329,0x20a1,0x20ac,0x2122,0x2191,0x2193,0x2212,0x2215,0xfeff,0xfffd])
        subsetter.subset(font)
        font.flavor = 'woff2'
        font.save(fonts/name)
        latin = latin.replace(url, f'assets/fuentes/{name}')
    latin = latin.replace("format('truetype')", "format('woff2')")
    rules.append(latin.strip())
    license_url = f'https://raw.githubusercontent.com/google/fonts/main/ofl/{slug}/OFL.txt'
    (fonts/f'{slug}-OFL.txt').write_bytes(urlopen(license_url, timeout=30).read())
(ROOT/'fuentes.css').write_text('\n\n'.join(rules)+'\n', encoding='utf-8')

credit = {
    'archivo': 'portada-optimizada.mp4', 'autor': 'Yan Krukau',
    'titulo': 'Group of People Studying in the Library',
    'fuente': 'https://www.pexels.com/video/group-of-people-studying-in-the-library-8199398/',
    'licencia': 'https://www.pexels.com/license/', 'consultado': '2026-11-15',
    'adaptacion': '16 segundos, 1280 × 720, H.264, sin audio; optimizado para web.',
    'aviso': 'Video de archivo: personas y espacios ajenos al Colegio Nuevo Mundo.'
}
(TARGET/'creditos.json').write_text(json.dumps(credit, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Video, póster, fuentes latinas y licencias disponibles localmente.')
