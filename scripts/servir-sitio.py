"""Vista local con el mismo prefijo que GitHub Pages, sin paquetes adicionales."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import json
import argparse

ROOT = Path(__file__).resolve().parents[1]
BASE = json.loads((ROOT / 'contenido/colegio.json').read_text(encoding='utf-8'))['basePath']

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/':
            self.send_response(302)
            self.send_header('Location', BASE)
            self.end_headers()
            return
        if not path.startswith(BASE):
            self.send_error(404)
            return
        self.path = self.path[len(BASE)-1:]
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=4873)
args = parser.parse_args()
print(f'Vista local: http://127.0.0.1:{args.port}{BASE}', flush=True)
ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT))).serve_forever()
