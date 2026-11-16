# Portada audiovisual · Colegio Nuevo Mundo

Implementación local del 15 de noviembre de 2026, basada en la guía de siete fases y la referencia visual de SEK Costa Rica. La marca, las categorías y los datos corresponden a Nuevo Mundo.

## Distribución de la portada

1. Aviso de vista previa y franja azul de contacto, con Noticias como acceso secundario.
2. Cabecera blanca fija al desplazarse, seis categorías y apartados que se abren con un botón independiente del enlace principal.
3. Video de ancho completo, título HTML legible, llamada a solicitar información y control de reproducción.
4. Presentación breve y enlace a la identidad institucional.
5. Cuatro tarjetas: III Ciclo, Diversificada, Complementarias y Multilingüe. Cada una abre su panel dentro de Oferta educativa.
6. Imagen de referencia y tres motivos de acompañamiento, con acceso a Vida en el colegio.
7. Consulta de admisiones con revisión antes del envío manual por WhatsApp.
8. Créditos del recurso audiovisual y pie institucional.

Los testimonios se incorporarán cuando existan textos y autorizaciones aprobados. Misión, visión, listas de materias, requisitos, fechas y aranceles conservan sus categorías propias.

## Edición y regeneración

La fuente editable es `contenido/colegio.json`. En `inicio` se administran el antetítulo, las tres líneas del título, la descripción, el video/póster, la introducción y las imágenes de las tarjetas. Los títulos de las tarjetas se toman de `oferta`; los motivos se toman de `beneficios`. La misión y la visión no se han abreviado ni sustituido.

```powershell
node scripts/generar-sitio.mjs
node --test scripts/video-portada.test.mjs
python scripts/verificar-sitio.py
python scripts/servir-sitio.py --port 4873
```

Vista local: http://127.0.0.1:4873/colegio-nuevo-mundo-preview/

La edición actual requiere apoyo técnico. El panel privado de gestión continúa pendiente de integración. No se deben editar los HTML generados para cambiar contenido: la siguiente regeneración los reemplaza.

## Archivos y responsabilidades

| Archivo | Función |
| --- | --- |
| `scripts/plantillas-portada.mjs` | Estructura de la portada y apartados del menú. |
| `navegacion.css` | Cabecera blanca, tipografía común y menú adaptable. |
| `portada.css` | Composición audiovisual y secciones del inicio. |
| `portada.js` | Preferencias del navegador, visibilidad y controles del video. |
| `lib/video-portada.mjs` | Estado de reproducción y protección ante respuestas asíncronas. |
| `assets/portada/creditos.json` | Procedencia y adaptación del video de archivo. |
| `fuentes.css`, `assets/fuentes/` | Fuentes locales Kumbh Sans y Noto Sans, con licencias OFL. |
| `partials/lumi.html`, `matricula-chat.*` | Personaje original, saludo y consulta de preguntas frecuentes. |

Las fuentes están convertidas a WOFF2 con caracteres latinos, puntuación y símbolo del colón. La preparación puntual de recursos utiliza Python con `fonttools` y `brotli`; no se requiere para regenerar las páginas. `scripts/configurar-portada.py` fue una migración inicial y rechaza ejecutarse sobre una portada ya configurada. Para cambios posteriores se edita el JSON directamente.

## Comportamiento del video

- Archivo MP4 local de 16 segundos, 1280 × 720, sin pista de sonido y con repetición. Aproximadamente 1,79 MB, acompañado por un póster de 126 KB.
- En escritorio puede iniciar silenciado si lo permite el navegador. El control de pausa permanece disponible.
- En pantallas de hasta 767 px, con movimiento reducido o con ahorro de datos informado por el navegador, se presenta el póster sin asignar una fuente al video. La familia puede elegir reproducirlo.
- Se pausa al salir de pantalla o al ocultar la pestaña. Una pausa elegida por la persona se conserva al regresar.
- Un rechazo de reproducción o error deja el póster y los enlaces disponibles; el control permite reintentar. Una respuesta tardía de `play()` no puede revocar una pausa posterior.
- El texto y los enlaces se conservan cuando falla el video o JavaScript está desactivado.

Video: **Yan Krukau**, “Group of People Studying in the Library”, [Pexels](https://www.pexels.com/video/group-of-people-studying-in-the-library-8199398/). [Licencia de la fuente](https://www.pexels.com/license/). Personas e instalaciones ajenas al colegio; sustituir por material institucional autorizado para la versión definitiva.

## Navegación, consulta y Lumi

Los enlaces de las categorías navegan directamente. Los botones «Apartados de…» abren su lista; solo una se mantiene abierta. Escape cierra la lista y devuelve el foco al botón; otro Escape cierra el menú móvil. Los acordeones conservan apertura única y enlaces directos. Los enlaces antiguos del inicio continúan dirigiendo a su categoría correspondiente.

La llamada principal de la portada utiliza `#consulta`, para evitar interferir con el enlace antiguo `#consulta-admisiones`, que sigue llevando a Admisiones.

El formulario prepara el mensaje, muestra la revisión y ofrece abrir WhatsApp. Editar un campo invalida la revisión anterior y su enlace. El sitio no almacena la consulta ni confirma recepción, disponibilidad o matrícula. Sin JavaScript se mantiene el enlace de consulta directa.

Lumi conserva el recurso gráfico, el emblema, el aro dorado y el saludo existentes. En móvil se presenta compacto, con opción de mostrar el personaje. Se compacta cerca de la consulta y del pie de página, y se oculta mientras se escribe en el formulario. La atención humana del chat continúa identificada como demostración.

## Verificación y estado de las fases

La verificación estática revisa las ocho páginas generadas, sus recursos, destinos, identificadores, referencias ARIA y contenido institucional. También comprueba que el video tenga descarga diferida y que las cuatro tarjetas apunten a paneles existentes. Las ocho pruebas del controlador cubren carga manual, visibilidad, pausa explícita, rechazo de autoplay, reintento y respuestas tardías.

La revisión visual cubre escritorio y móvil, pausa/reproducción, menú con teclado, enlace a Complementarias, apertura única, respuesta de Lumi y formulario con datos ficticios. No se enviaron mensajes por WhatsApp. Las capturas de revisión están en `output/implementacion-portada-2026-11-15/`.

Las fases de estructura, implementación e integración estática están disponibles para revisión local. La aprobación editorial, las fotografías definitivas, los datos pendientes de Dirección/Admisiones y la gestión privada siguen pendientes. La actualización del repositorio y su vista previa pública fue autorizada por el propietario después de la revisión local. El lanzamiento institucional definitivo sigue sujeto a validación de los datos y del material multimedia.

Respaldo previo de los archivos locales: `output/respaldo-antes-portada-2026-11-15.zip`. Contiene el estado anterior de las fuentes y páginas relevantes, incluidos los cambios que ya estaban sin confirmar en Git.
