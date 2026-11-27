# Gestión de contenidos · avance de implementación

## Entrega disponible

La ruta `/admin/` contiene un prototipo de edición de borradores. Organiza Inicio, Conócenos, Oferta educativa, Vida en el colegio, Admisiones, Contacto, Opiniones y Noticias. Dentro de cada categoría hay apartados que se abren al tocarlos, con nombres cotidianos. Los títulos, introducciones y resúmenes de las seis páginas interiores se editan en su categoría. También se editan enlaces de texto de Inicio, presentación e invitaciones de Opiniones, títulos de secciones, pasos y avisos de Admisiones, notas de Contacto, encabezados del pie y el mensaje de Noticias. El lema existente en Conócenos se refleja en el pie de todas las páginas. Admin puede modificar texto, estados e imágenes o videos; Moderador solo recibe campos textuales. Permite revisar diferencias, deshacer el último cambio y descargar una copia completa del JSON.

El menú y sus subapartados, el aviso superior y varios textos del pie también se editan. En Admisiones pueden ajustarse las etiquetas y opciones del formulario, los avisos de revisión, el mensaje preparado para WhatsApp y los títulos y textos de aranceles, reserva y matrícula. El mismo formulario aparece en Inicio y Admisiones, por lo que una edición se refleja en ambos lugares. Estos campos se agrupan con nombres comprensibles y límites de longitud para conservar la distribución.
En Contacto también pueden editarse las etiquetas y acciones de teléfono, correo y WhatsApp, los enlaces al mapa y redes sociales y el botón para preparar una consulta. Se añadieron los botones de invitación entre secciones, el aviso de la galería y los nombres de redes del pie. En Inicio pueden modificarse los textos de control, estado y crédito del video y las notas de las imágenes. En Opiniones pueden modificarse las invitaciones y los botones de pausa y reanudación. El esquema de contenido actual es la versión 6; una instalación con contenido anterior debe ejecutar la actualización descrita abajo antes de abrir el panel privado.

En GitHub Pages los cambios solo permanecen en la pestaña y pueden descargarse; no se guarda ni se publica allí. Bajo un servidor privado del mismo origen, el editor consulta la sesión, carga el borrador de trabajo y puede guardarlo en MariaDB mediante la API preparada. Esa integración aún no se ha probado con una instancia real. No se deben introducir expedientes ni datos privados en la vista pública.

## Validación institucional

| Categoría | Confirmación necesaria | Responsable sugerido |
| --- | --- | --- |
| Inicio y Conócenos | Presentación, valores, misión y visión; historia documentada si se incorpora. | Dirección |
| Oferta educativa | Asignaturas de Diversificada, Física Matemática e idiomas/complementarias por nivel. | Coordinación académica |
| Vida en el colegio | Horarios, condiciones de alimentación y transporte; fotografías autorizadas. | Administración |
| Admisiones | Curso lectivo, fechas con años, reserva, aranceles y disponibilidad. | Admisiones |
| Contacto | Teléfonos, correo, horario administrativo y ubicación exacta. | Administración |
| Multimedia | Video y fotografías institucionales y autorización de uso. | Dirección |

El editor muestra la lista pendiente y no la convierte automáticamente en información aprobada. Un monto vacío representa pendiente; cero representa sin costo. Los aranceles requieren curso lectivo y los valores negativos se rechazan.

## Secuencia para el propietario

1. Elegir una categoría y editar sus campos.
2. Seleccionar «Revisar borrador» y comprobar el original frente al texto propuesto.
3. Corregir los avisos de validación. En GitHub Pages, descargar `colegio-borrador.json`; en el servidor privado, guardar el borrador.
4. En el panel privado, enviar el borrador a revisión. Admin compara la versión guardada con el contenido público y la aprueba o la devuelve explicando qué corregir.
5. Si se devuelve, ajustar los campos, guardar una versión nueva y enviarla nuevamente. El historial muestra las últimas 20 versiones y el motivo de devolución.
6. Para publicar, el responsable técnico aún debe incorporar la copia aprobada en `contenido/colegio.json`, regenerar y verificar el sitio. El despliegue desde el panel sigue pendiente.

En GitHub Pages la recarga vuelve a los datos originales; cerrar la pestaña sin descargar pierde el borrador. Allí se pueden seleccionar archivos ya incluidos en la muestra. En el servidor privado, Admin también puede elegir un archivo nuevo de su equipo, esperar a que termine la carga, revisar el cambio y guardar el borrador. Moderador no ve el control para subir archivos. La carga y el guardado se han probado con dobles de MariaDB, pero no con una instancia real ni con el despliegue final.

## Integración privada pendiente

El desarrollo continúa en este repositorio de GitHub. Se necesita definir el alojamiento privado de producción antes de desplegar la integración. El servidor de referencia está en `backend/`; la conexión a una instancia MariaDB real se realizará en la fase final, según el orden acordado para el proyecto.

Si ya se importó contenido a MariaDB con una versión anterior del proyecto, el responsable técnico debe respaldar la base y ejecutar `pnpm db:upgrade-content <id-de-Admin>` desde `backend/` antes de abrir el panel. El comando conserva los valores existentes y añade solo campos nuevos a una revisión de trabajo. No publica el resultado; después de actualizar, debe repetirse la revisión institucional del borrador.

El panel privado preparado incluye acceso del personal, permisos de Admin y Moderador, guardado de borradores y transición a revisión, aprobación o devolución. Moderador puede enviar a revisión un borrador propio; solo Admin lo aprueba o devuelve, y debe explicar qué corregir. Antes de decidir, el panel compara la versión guardada con el contenido público; también muestra un historial de las últimas 20 versiones, sin restauración todavía. Aprobar todavía no cambia la página pública. Existe un paquete de vista previa local con las plantillas actuales; faltan el acceso a esa vista dentro del panel, la recuperación desde la interfaz, la publicación y el despliegue. La publicación debe regenerar el sitio desde una versión aprobada y confirmar el despliegue. Las credenciales permanecen en el servidor; nunca se incluyen claves de GitHub en el navegador.

Los valores de servicios, horarios, opiniones y encabezados de páginas presentes en `contenido/colegio.json` ya aparecen en el editor. Quedan pendientes otros textos escritos directamente en plantillas, la gestión de publicaciones de noticias, la vista previa generada y el despliegue. La carga privada de medios y el flujo de aprobación están preparados, pero aún requieren pruebas con MariaDB real. No se inventan publicaciones ni registros de usuarios para simular una integración.

## Verificación

Ejecutar `node --test admin/*.test.mjs backend/*.test.mjs scripts/*.test.mjs`. Las pruebas cubren roles, cobertura de campos, medios disponibles, guardado, autenticación y validaciones del borrador. La generación con los textos actuales conserva el HTML visible; solo cambian las versiones de los scripts que cargan el contenido nuevo. La navegación por las siete categorías anteriores y la revisión de diferencias se comprobó en un navegador local; falta validar la nueva categoría Noticias con usuarios.
