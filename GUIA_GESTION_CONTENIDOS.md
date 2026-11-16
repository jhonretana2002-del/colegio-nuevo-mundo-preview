# Gestión de contenidos · siguiente fase

## Entrega disponible

La ruta `/admin/` contiene un prototipo funcional de edición de borradores. Se conecta por lectura a `contenido/colegio.json`; organiza Inicio, Conócenos, Contacto, Oferta educativa y Admisiones. Permite ajustar campos, revisar diferencias, deshacer el último cambio y descargar una copia completa del JSON. El borrador conserva los campos que el editor aún no expone.

Los cambios solo permanecen en memoria de la pestaña. La descarga permite conservarlos, pero no actualiza el archivo del repositorio ni la página pública. No hay autenticación, base de datos, guardado ni publicación desde este prototipo. No se deben introducir expedientes ni datos privados. GitHub Pages continúa siendo una exportación estática.

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
3. Corregir los avisos de validación y descargar `colegio-borrador.json`.
4. Revisar el contenido con el responsable institucional correspondiente.
5. El responsable técnico incorpora la copia aprobada en `contenido/colegio.json`, regenera y verifica el sitio antes de publicarlo.

La recarga vuelve a los datos originales. Cerrar la pestaña sin descargar pierde el borrador. Las imágenes y los videos se mantienen como recursos existentes hasta disponer del material definitivo.

## Integración privada pendiente

Se necesita identificar la ruta o repositorio del proyecto privado antes de implementar su integración. El repositorio público no contiene el servidor citado en el acceso administrativo anterior.

El panel definitivo deberá incluir acceso del personal, permisos de editor y publicador, guardado de borradores, revisión previa, historial y recuperación. La publicación debe regenerar el sitio desde una versión aprobada y confirmar el despliegue. Las credenciales permanecen en el servidor; nunca se incluyen claves de GitHub en el navegador.

Noticias, servicios, horarios y biblioteca multimedia se incorporarán al editor después de conectar el modelo de datos y almacenamiento del proyecto privado. No se inventan publicaciones ni registros de usuarios para simular una integración.

## Verificación

Ejecutar `node --test scripts/gestion.test.mjs`. Las comprobaciones cubren montos pendientes, curso lectivo, cero, negativos y datos de contacto/listas inválidos. La revisión de navegador comprueba edición, diferencias, descarga, deshacer, navegación por categorías y adaptación móvil.
