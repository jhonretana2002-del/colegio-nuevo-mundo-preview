# Gestión de contenidos · avance de implementación

## Entrega disponible

La ruta `/admin/` contiene un prototipo de edición de borradores. Organiza Inicio, Conócenos, Oferta educativa, Vida en el colegio, Admisiones, Contacto, Opiniones y Noticias. Dentro de cada categoría hay apartados que se abren al tocarlos, con nombres cotidianos. Los títulos, introducciones y resúmenes de las seis páginas interiores se editan en su categoría. También se editan enlaces de texto de Inicio, presentación e invitaciones de Opiniones, títulos de secciones, pasos y avisos de Admisiones, notas de Contacto, encabezados del pie y el mensaje de Noticias. El lema existente en Conócenos se refleja en el pie de todas las páginas. Admin puede modificar texto, estados e imágenes o videos; Moderador solo recibe campos textuales. Permite revisar diferencias, deshacer el último cambio y descargar una copia completa del JSON.

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

Se necesita identificar el alojamiento y repositorio privado de producción antes de desplegar la integración. Este repositorio de vista previa ya incluye un servidor privado de referencia en `backend/`, pero todavía no está conectado al proyecto completo ni a una instancia MariaDB real.

Si ya se importó contenido a MariaDB con una versión anterior del proyecto, el responsable técnico debe respaldar la base y ejecutar `pnpm db:upgrade-content <id-de-Admin>` desde `backend/` antes de abrir el panel. El comando conserva los valores existentes y añade solo campos nuevos a una revisión de trabajo. No publica el resultado; después de actualizar, debe repetirse la revisión institucional del borrador.

El panel privado preparado incluye acceso del personal, permisos de Admin y Moderador, guardado de borradores y transición a revisión, aprobación o devolución. Moderador puede enviar a revisión un borrador propio; solo Admin lo aprueba o devuelve, y debe explicar qué corregir. Antes de decidir, el panel compara la versión guardada con el contenido público; también muestra un historial de las últimas 20 versiones, sin restauración todavía. Aprobar todavía no cambia la página pública. Faltan vista previa completa con las plantillas actuales, recuperación desde la interfaz, publicación y despliegue. La publicación debe regenerar el sitio desde una versión aprobada y confirmar el despliegue. Las credenciales permanecen en el servidor; nunca se incluyen claves de GitHub en el navegador.

Los valores de servicios, horarios, opiniones y encabezados de páginas presentes en `contenido/colegio.json` ya aparecen en el editor. Quedan pendientes otros textos escritos directamente en plantillas, la gestión de publicaciones de noticias, la vista previa generada y el despliegue. La carga privada de medios y el flujo de aprobación están preparados, pero aún requieren pruebas con MariaDB real. No se inventan publicaciones ni registros de usuarios para simular una integración.

## Verificación

Ejecutar `node --test admin/field-catalog.test.mjs lib/media-policy.test.mjs backend/*.test.mjs scripts/content-policy.test.mjs scripts/gestion.test.mjs scripts/opiniones.test.mjs scripts/video-portada.test.mjs`. Las pruebas cubren roles, cobertura de campos, medios disponibles, guardado, autenticación y validaciones del borrador. La generación con los textos actuales deja el HTML público sin cambios. La navegación por las siete categorías anteriores y la revisión de diferencias se comprobó en un navegador local; falta validar la nueva categoría Noticias con usuarios.
