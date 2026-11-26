# Gestión de contenidos · avance de implementación

## Entrega disponible

La ruta `/admin/` contiene un prototipo de edición de borradores. Organiza Inicio, Conócenos, Oferta educativa, Vida en el colegio, Admisiones, Contacto y Opiniones. Genera los formularios desde los valores editables de `contenido/colegio.json` y la política de roles: Admin puede modificar texto, estados y referencias visuales; Moderador solo recibe campos textuales. Permite revisar diferencias, deshacer el último cambio y descargar una copia completa del JSON.

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
4. Revisar el contenido con el responsable institucional correspondiente.
5. El responsable técnico incorpora la copia aprobada en `contenido/colegio.json`, regenera y verifica el sitio antes de publicarlo.

En GitHub Pages la recarga vuelve a los datos originales; cerrar la pestaña sin descargar pierde el borrador. Admin puede seleccionar otros archivos ya presentes en el catálogo local. La carga de fotografías o videos nuevos todavía no está disponible.

## Integración privada pendiente

Se necesita identificar la ruta o repositorio del proyecto privado antes de implementar su integración. El repositorio público no contiene el servidor citado en el acceso administrativo anterior.

El panel definitivo deberá incluir acceso del personal, permisos de editor y publicador, guardado de borradores, revisión previa, historial y recuperación. La publicación debe regenerar el sitio desde una versión aprobada y confirmar el despliegue. Las credenciales permanecen en el servidor; nunca se incluyen claves de GitHub en el navegador.

Los valores de servicios, horarios y opiniones presentes en `contenido/colegio.json` ya aparecen en el editor. Quedan pendientes los textos escritos directamente en plantillas, la carga de medios nuevos, las noticias, la vista previa generada, el flujo de aprobación y el despliegue. No se inventan publicaciones ni registros de usuarios para simular una integración.

## Verificación

Ejecutar `node --test admin/field-catalog.test.mjs lib/media-policy.test.mjs backend/*.test.mjs scripts/content-policy.test.mjs scripts/gestion.test.mjs`. Las pruebas cubren roles, cobertura de campos, medios disponibles, guardado, autenticación y validaciones del borrador. Se comprobó en un navegador local la navegación por siete categorías, la edición de una tarjeta y la revisión de diferencias en un ancho móvil.
