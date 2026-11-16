# Adaptación de contenidos del Colegio Nuevo Mundo

Implementación local de la guía y las vistas aprobadas para continuar el trabajo. Rama: `codex/adaptacion-contenidos`. No publica cambios en GitHub Pages.

## Estructura implementada

| Página | Contenido |
| --- | --- |
| Inicio | Bienvenida, tres accesos, beneficios, tres experiencias y orientación de admisión. |
| Conócenos | Presentación, misión y visión íntegras, valores y consulta sobre trayectoria. |
| Oferta educativa | III Ciclo, Diversificada, complementarias e idiomas en un acordeón. |
| Vida en el colegio | Propuesta, horario institucional visible, tecnología, alimentación, transporte y fotografías. |
| Admisiones | Proceso y referencias de fechas y reserva visibles; requisitos, prematrícula, período y aranceles desplegables; consulta con revisión previa. |
| Contacto | Teléfonos, WhatsApp, correo, dirección, enlace al mapa, redes y horario institucional. |
| Noticias | Acceso secundario y estado vacío hasta disponer de publicaciones reales. |

## Una fuente para los datos

Editar `contenido/colegio.json` y ejecutar:

```powershell
node scripts/generar-sitio.mjs
python scripts/verificar-sitio.py
python scripts/servir-sitio.py --port 4873
```

Abrir `http://127.0.0.1:4873/colegio-nuevo-mundo-preview/`.

El generador escribe las páginas, la página 404 y `institucional-datos.js`. Los datos de contacto, asignaturas, horarios, requisitos y aranceles se reutilizan también en el pie de página y Lumi. Las páginas exportadas se sirven directamente en GitHub Pages sin Node ni Python en el servidor. No editar a mano las páginas generadas, porque se sobrescriben al regenerar.

Los textos de página y las plantillas están en `scripts/generar-sitio.mjs`. El aspecto está en `institucional.css`; la interacción, en `institucional.js`. La identidad y la animación de Lumi se mantienen en `partials/lumi.html` y `matricula-chat.css`.

## Acordeones

- El cursor y el foco resaltan el encabezado; no abren el contenido.
- Clic, toque, Enter o Espacio abren la información debajo del título.
- Abrir otra opción cierra la anterior del mismo grupo. Pulsar la opción abierta la cierra.
- III Ciclo y Requisitos se abren inicialmente; servicios puede comenzar cerrado.
- Un enlace como `/oferta-educativa/#complementarias` abre el panel correspondiente.
- Se conservan destinos para las anclas antiguas de la portada.
- No se utilizan ventanas emergentes para leer estas categorías. El diálogo existente de Lumi conserva su función de chat.
- Se respeta movimiento reducido. La impresión incluye todos los detalles y luego recupera el estado anterior.
- Sin JavaScript, las páginas y los desplegables nativos siguen disponibles; la consulta directa por WhatsApp también.

## Consultas

El formulario muestra el mensaje preparado y un enlace para abrir WhatsApp. La familia decide enviarlo allí. Editar un dato invalida la vista previa anterior. El sitio no almacena la consulta, no envía mensajes y no confirma una matrícula. La atención humana de Lumi sigue identificada como demostración.

## Fases y estado

1. **Inventario y validación:** los contenidos facilitados están centralizados; los pendientes institucionales se enumeran en `pendientes`. La validación de Dirección y Admisiones continúa pendiente.
2. **Redacción y distribución:** implementadas las categorías y la portada compacta. La historia no se inventa; misión y visión se conservan completas.
3. **Prototipo e interacción:** acordeones, navegación entre páginas, enlaces directos y consulta preparados para revisión en escritorio y móvil.
4. **Integración:** exportación estática y respuestas de Lumi conectadas a la fuente común. El repositorio público no incluye el servidor privado; no se ha simulado un panel editorial operativo. La edición actual del JSON y la regeneración requieren apoyo técnico. Integrar el panel privado o acordar una solución de gestión es una tarea pendiente.
5. **Revisión y publicación:** verificar la copia local y los textos; publicar solo después de revisar la versión y aprobar los datos de la institución. La actualización de la vista previa pública fue autorizada posteriormente por el propietario.
6. **Mantenimiento:** conservar los cambios en Git; revisar datos antes de cada campaña y actualizar la fuente común. Regenerar y validar antes de publicar.

## Datos que requieren aprobación

- Presentación y explicaciones de valores.
- Historia, si se desea incorporarla.
- Denominación Física Matemática, lista de Diversificada y distribución de idiomas y complementarias por nivel.
- Curso lectivo y fechas con ambos años calendario, condiciones de reserva y valores de aranceles.
- Horario administrativo, condiciones de alimentación y transporte, ubicación del mapa y fotografías.

Mientras faltan estas confirmaciones, las fechas y la reserva aportadas se presentan como referencias para consulta; los aranceles pendientes indican «Consultar con Admisiones». `null` significa pendiente, nunca cero. `matriculaAbierta` permanece en `false`. El generador rechaza montos sin curso lectivo y un anuncio de matrícula abierta sin calendario confirmado. Para confirmar un calendario deben incluirse los años en los textos y el curso en `cursoLectivo`.

`horarioAdministrativo` es independiente de `horarioInstitucional`; no se deduce uno del otro. `contacto.mapaEmbed` permanece en `null` hasta confirmar el marcador. El enlace de búsqueda en Google Maps sigue disponible.

## Verificación

La comprobación estática revisa los recursos y enlaces de las ocho páginas generadas, anclas, referencias ARIA, un único h1, contenido oficial, valores de apertura inicial y destinos usados por Lumi. La revisión de navegador debe comprobar apertura única, hover, teclado, móvil, enlaces antiguos y que la consulta no se envíe al preparar la vista previa.

Comprobado durante esta implementación: apertura y cierre por clic, Enter y Espacio; enlaces antiguos a complementarias; enlace de Lumi al panel correspondiente; navegación móvil y cierre del menú; seis categorías sin desbordamiento a 390 px y revisión de aranceles y contacto a 320 px; vista previa del formulario y su invalidación al editar. Las consultas de prueba permanecieron en la página: no se realizó envío a WhatsApp. La regeneración produjo los mismos nueve archivos de salida sin diferencias. No se sustituye con estas comprobaciones la validación institucional ni la revisión del panel privado.
