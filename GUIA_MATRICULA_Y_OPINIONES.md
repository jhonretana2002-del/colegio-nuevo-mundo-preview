# Matrícula y opiniones · 17 de noviembre de 2026

## Organización

| Archivo | Responsabilidad |
| --- | --- |
| `matricula-portada.css` | Fondo fijo, panel de consulta y adaptación móvil. |
| `opiniones.css` | Tarjetas, desplazamiento continuo a la derecha y alternativas sin movimiento. |
| `opiniones.js` | Pausa manual, visibilidad de pestaña/sección y movimiento reducido. |
| `scripts/plantillas-opiniones.mjs` | Estructura y validación de las recomendaciones. |
| `contenido/colegio.json`, campo `opiniones` | Autor, fecha, texto disponible, vínculo original y estado de verificación. |
| `assets/portada/matricula-estudiante.webp` | Imagen ilustrativa optimizada, 119 KB aproximadamente. |

Las páginas HTML se regeneran con `node scripts/generar-sitio.mjs`. No editar directamente `index.html`. La nueva imagen y los estilos se sirven localmente desde el repositorio; no hay widgets sociales, rastreadores ni claves de API.

## Matrícula

En escritorio, la imagen permanece fija respecto de la ventana mientras el panel se desplaza. El formulario mantiene su revisión previa y envío manual por WhatsApp. En pantallas de hasta 900 px se presenta un retrato superior y el formulario debajo, con fondo normal para evitar saltos y recortes del uniforme. La preferencia de movimiento reducido también desactiva el fondo fijo.

Imagen generada con la herramienta integrada de imágenes, usando `estudiantes-960.webp` y `logo-480.webp` como referencias. Es una estudiante ficticia y no acredita matrícula real ni instalaciones reales. El resultado original se conserva fuera del repositorio; el recurso final optimizado está en `assets/portada/matricula-estudiante.webp`.

Especificación final de generación: fotografía horizontal 16:9, estudiante ficticia costarricense de secundaria, rostro y torso a la derecha, biblioteca luminosa desenfocada a la izquierda; polo azul marino de franjas horizontales gris claro y escudo rojo/azul, negro y dorado del colegio en el pecho; sin mochila que cubra el emblema, texto publicitario ni otras personas. Se pidió conservar el uniforme, las proporciones y el diseño del escudo de las referencias.

## Contenido verificable del carrusel

### Presentación ilustrativa solicitada

La presentación activa se configura en `contenido/colegio.json`, en `presentacionOpiniones.modo: "ejemplos"`. Incluye tres textos representativos, nombres ficticios, avatares circulares y cinco estrellas de muestra. El aviso general y la identificación en cada tarjeta indican que no son testimonios reales. Las estrellas de estos ejemplos no se atribuyen a Facebook ni a una evaluación de una familia real.

Los textos se editan en `presentacionOpiniones.ejemplos`. Cada entrada debe conservar `tipo: "ejemplo"`. Para volver a las fuentes verificadas, cambiar el modo a `"verificadas"` y regenerar. La recomendación de Mario AZ sigue conservada, con su fuente y fecha, en el campo `opiniones`; no se le asignaron cinco estrellas ficticias.

### Fuentes reales conservadas

Se consultaron búsquedas públicas y el apartado de recomendaciones de la página `facebook.com/colegionuevomundocr/reviews/`. La página mostraba «Aún sin calificación (1 opinión)» y una recomendación de **Mario AZ**, del **6 de octubre de 2016**, sin comentario escrito.

Fuente directa: https://www.facebook.com/mario77899/posts/pfbid0ruiq3CpqbRNPB7icpE2dnyABsgiYQyexf9Prd7rWogqmdGohNLCtMh5jgxTBUHQal

No se atribuye al autor la condición de padre de familia: no consta en la fuente consultada. Tampoco se añaden estrellas, una nota media ni una experiencia escrita que no exista. Las otras dos tarjetas son invitaciones a consultar recomendaciones y conocer las redes del colegio; están identificadas como tales.

Para incorporar más recomendaciones, agregar únicamente entradas comprobadas con autor, fecha, texto si existe y enlace a la publicación original. Conservar la plataforma de procedencia y no reutilizar los testimonios del colegio SEK. `verificada: false` excluye una entrada de la exportación. El vínculo familiar solo debe darse por confirmado cuando exista evidencia.

## Interacción y accesibilidad

El movimiento es continuo hacia la derecha. Se pausa con el botón, al situar el puntero sobre las tarjetas, al salir de pantalla o al ocultar la pestaña. La pausa manual se conserva. El acceso con teclado muestra las tarjetas originales estáticas y permite recorrer sus enlaces. Las copias visuales están fuera del árbol accesible y del recorrido de tabulación. Sin JavaScript o con movimiento reducido se ofrece una fila estática que puede desplazarse manualmente.

La cinta mide el ancho visible y repite el bloque completo hasta cubrirlo antes de iniciar el movimiento. Los dos bloques tienen la misma anchura y la velocidad se mantiene en 24 píxeles por segundo, también al cambiar el tamaño de ventana. Las repeticiones son copias visuales de las mismas tarjetas, no nuevas opiniones.

Las recomendaciones positivas sin nota numérica llevan una estrella dorada y la etiqueta «Recomienda el colegio», con la aclaración correspondiente. Una puntuación sobre cinco solo se representa si existen los campos `puntuacion` y `escala: 5` respaldados por la fuente. Las invitaciones a redes no reciben puntuaciones.

## Verificación

Comprobados: escritorio de 1280 px, pantallas de 390 y 320 px sin desbordamiento horizontal, fondo fijo durante el desplazamiento, fondo normal en móvil, avance del carrusel hacia la derecha, pausa manual, copias sin tabulación y revisión del formulario con datos ficticios sin envío externo.

```powershell
node scripts/generar-sitio.mjs
node --test scripts/video-portada.test.mjs scripts/gestion.test.mjs scripts/opiniones.test.mjs
python scripts/verificar-sitio.py
```

Las capturas de trabajo están en `output/mejoras-2026-11-17/`; la evidencia de la recomendación consultada se conserva en `output/referencias-2026-11-17/facebook-recomendacion.jpg`. Ambos directorios son artefactos locales y se excluyen de la publicación.
