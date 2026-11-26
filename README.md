# Colegio Nuevo Mundo · Vista previa

Visualización del diseño: https://jhonretana2002-del.github.io/colegio-nuevo-mundo-preview/

Este repositorio contiene solo la exportación estática de demostración. El proyecto completo permanece privado. La vista incluye portada, diseño de noticias vacío y recursos gráficos; el panel y la publicación de noticias requieren el servidor de la aplicación y no funcionan en GitHub Pages. No se incluyen bases de datos, cuentas, claves o publicaciones de prueba.

La información institucional y la restauración del escudo están sujetas a validación. La demostración solicita no indexación y no representa el lanzamiento oficial.

El inicio incluye una portada audiovisual de ancho completo, presentación breve, cuatro accesos a la oferta educativa, acompañamiento y consulta de admisiones. El video de archivo está identificado y acreditado; las imágenes ilustrativas no representan alumnado real ni instalaciones verificadas del colegio.

## Gestión de contenidos

El acceso `/admin/` incluye un prototipo para preparar, revisar y descargar borradores de contenido en GitHub Pages. Su conexión con la API privada para autenticación, guardado, revisión con devolución motivada e historial está preparada en `backend/`, pero aún no se ha desplegado ni probado con MariaDB real. No publica cambios. Consultar `GUIA_GESTION_CONTENIDOS.md` para los campos disponibles y la validación institucional pendiente.

## Lumi

El asistente de matrícula se llama Lumi. El botón conserva el personaje y el emblema de la imagen de referencia; la mano se recorta en una capa y gira suavemente sobre la muñeca. El aro dorado, la cabeza y el cuerpo permanecen estables. La preferencia de reducir movimiento desactiva el saludo.

## Adaptación por categorías

La portada compacta enlaza a Conócenos, Oferta educativa, Vida en el colegio, Admisiones y Contacto. Las listas extensas se consultan en acordeones de apertura única dentro de cada categoría. Noticias continúa como acceso secundario sin publicaciones de prueba.

Los contenidos compartidos se mantienen en `contenido/colegio.json`. Para regenerar la exportación y revisarla:

```powershell
node scripts/generar-sitio.mjs
node --test scripts/video-portada.test.mjs
python scripts/verificar-sitio.py
python scripts/servir-sitio.py --port 4873
```

Vista local: `http://127.0.0.1:4873/colegio-nuevo-mundo-preview/`.

Consultar `GUIA_ADAPTACION_CONTENIDOS.md` para edición, datos pendientes, limitaciones y fases de publicación. Esta implementación no activa el panel privado ni publica automáticamente en GitHub Pages.

La adaptación audiovisual del 15 de noviembre está documentada en `GUIA_PORTADA_AUDIOVISUAL.md`. Los textos e imágenes de portada se editan en `inicio`, dentro de la misma fuente JSON. Las fuentes y el video se sirven localmente; el video no se descarga automáticamente en móvil, con movimiento reducido o con ahorro de datos disponible en el navegador.
