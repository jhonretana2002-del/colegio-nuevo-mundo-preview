# Avance del panel administrativo

Este checklist corresponde a la guía de implementación del panel administrativo entregada el 25 de noviembre de 2026. El repositorio actual es una exportación pública; en GitHub Pages `/admin/` solo prepara descargas locales. Con la API privada bajo el mismo origen puede autenticar, guardar borradores, enviarlos a revisión, aprobarlos o devolverlos con instrucciones, pero aún no publica. Las casillas se marcan solo cuando hay evidencia.

## Fase 1: base y permisos

- [x] Identificar la fuente de contenido (`contenido/colegio.json`), el generador (`scripts/generar-sitio.mjs`) y el prototipo `/admin/`. Evidencia: `README.md` y `GUIA_GESTION_CONTENIDOS.md`.
- [x] Preparar una política inicial de cambios por rol y pruebas automatizadas. Evidencia: `lib/content-policy.mjs` y `scripts/content-policy.test.mjs`.
- [x] Validar tipos, campos desconocidos, listas repetibles e identificadores duplicados antes de aceptar un borrador. Evidencia: `lib/content-shape.mjs` y `scripts/content-policy.test.mjs`.
- [x] Definir el modelo inicial de MariaDB para cuentas, sesiones, revisiones, medios, auditoría y publicaciones. Evidencia: `backend/migrations/001_initial.sql`, `backend/db.mjs` y `backend/db.test.mjs`. Pendiente: ejecución contra una instancia real.
- [x] Preparar la capa de lectura publicada y guardado de borradores con transacción, control de versión, validación de rol y auditoría. Evidencia: `backend/content-store.mjs` y `backend/content-store.test.mjs`. Pendiente: prueba con MariaDB real.
- [x] Preparar hash de contraseñas y sesiones persistentes con roles leídos de MariaDB. Evidencia: `backend/auth-store.mjs` y `backend/auth-store.test.mjs`. Pendiente: pruebas con MariaDB real.
- [x] Preparar la API HTTP inicial de sesión y borradores con origen, cookie segura y CSRF. Evidencia: `backend/http-api.mjs` y `backend/http-api.test.mjs`. Pendiente: despliegue privado.
- [x] Preparar límite de intentos persistente por cuenta e IP en MariaDB. Evidencia: `backend/migrations/002_login_limits.sql`, `backend/login-limit.mjs` y `backend/login-limit.test.mjs`. Pendiente: prueba contra MariaDB real.
- [x] Preparar verificación TOTP para Admin, secreto cifrado y rechazo de códigos reutilizados. Evidencia: `backend/mfa.mjs`, `backend/auth-store.mjs`, `backend/migrations/003_mfa_state.sql` y pruebas. Pendiente: integración con MariaDB real.
- [x] Preparar operaciones transaccionales de alta y recuperación de cuentas con confirmación MFA, revocación de sesiones y auditoría. Evidencia: `backend/account-provision.mjs` y pruebas. Pendiente: herramienta privada para operadores y verificación presencial de identidad.
- [x] Preparar puntero de borrador de trabajo y API de lectura autenticada; el guardado usa la revisión de trabajo sin modificar la publicada. Evidencia: `backend/migrations/004_content_working.sql`, `backend/content-store.mjs` y pruebas. Pendiente: prueba con MariaDB real.
- [x] Conectar el prototipo a sesión y guardado de borradores cuando exista una API privada bajo el mismo origen; conservar descarga local en GitHub Pages. Evidencia: `admin/gestion.js` y `admin/index.html`. Se comprobó navegación y revisión local en navegador; pendiente integración con servidor privado.
- [x] Exponer los valores editables de `contenido/colegio.json` en siete secciones según la política de Admin y Moderador. Evidencia: `admin/field-catalog.mjs` y prueba de cobertura de todos los valores permitidos. Pendiente: trasladar a la fuente JSON los textos aún fijos en plantillas.
- [x] Permitir a Admin elegir imágenes, póster y video de un catálogo local existente, con vista de referencia; validar las rutas y tipos nuevamente en servidor. Evidencia: `contenido/medios-disponibles.json`, `lib/media-policy.mjs` y pruebas. Pendiente: procesamiento de variantes.
- [x] Preparar carga privada de JPG, PNG, WebP y MP4 solo para Admin, con límites, firma básica, archivo aleatorio, registro en MariaDB y vista previa autenticada. Evidencia: `backend/media-store.mjs`, rutas de `backend/http-api.mjs` y pruebas. Pendiente: procesamiento profundo, variantes, respaldo y publicación de binarios.
- [x] Simplificar el editor con nombres legibles, apartados plegables, selección de medios y carga desde el equipo para Admin. Evidencia: `admin/field-catalog.mjs`, `admin/gestion.js` y revisión local en navegador. Pendiente: prueba con usuarios del colegio y servidor privado.
- [x] Preparar alta interactiva de la primera cuenta Admin con contraseña oculta y confirmación MFA; importación inicial repetible de `colegio.json`. Evidencia: `backend/setup-first-admin.mjs`, `backend/seed-content.mjs` y pruebas de importación. Pendiente: ejecución con MariaDB real.
- [x] Preparar servidor privado de panel y API en loopback, con origen HTTPS obligatorio y lista explícita de archivos públicos necesarios. Evidencia: `backend/private-server.mjs` y pruebas de rutas y video. Pendiente: proxy HTTPS y despliegue real.
- [x] Preparar estados de revisión y aprobación en MariaDB: el autor o Admin envía un borrador; solo Admin aprueba la revisión vigente, con control de versión y auditoría. El panel muestra acciones y mensajes sencillos según el estado. Evidencia: `backend/content-store.mjs`, `backend/http-api.mjs`, `admin/gestion.js` y pruebas. Pendiente: prueba contra MariaDB real y validación de uso con personal del colegio.
- [x] Trasladar títulos, introducciones, frases superiores y resúmenes de buscadores de las seis páginas interiores a `contenido/colegio.json`, accesibles por página para Admin y Moderador. Evidencia: `scripts/generar-sitio.mjs`, `admin/field-catalog.mjs` y pruebas; la generación conserva el HTML actual.
- [x] Trasladar textos de secciones principales: presentación y oferta en Inicio, identidad, propuesta, servicios, pasos de admisión, contacto y mensaje de Noticias. Los campos aparecen con nombres legibles para ambos roles. Evidencia: `contenido/colegio.json`, `scripts/plantillas-portada.mjs`, `scripts/generar-sitio.mjs` y pruebas; el HTML público generado sigue idéntico.
- [x] Preparar devolución con motivo obligatorio por Admin, historial de 20 revisiones y comparación de la versión guardada frente al contenido público antes de aprobar. Evidencia: `backend/migrations/005_review_decisions.sql`, `backend/content-store.mjs`, `backend/http-api.mjs`, `admin/gestion.js` y pruebas. Pendiente: prueba con MariaDB real y revisión de facilidad de uso con el personal.
- [x] Pasar a `colegio.json` mensajes informativos de Admisiones, Contacto y pie de página, además de invitaciones y títulos de secciones en Conócenos, Oferta y Vida en el colegio, incluidos misión, visión y horarios. Conectar el lema existente al pie sin duplicar campos y limitar la extensión de títulos para proteger la distribución. Evidencia: `scripts/generar-sitio.mjs`, `admin/field-catalog.mjs` y pruebas. La exportación pública mantiene el HTML actual.
- [x] Hacer editables los enlaces de texto de Inicio y la presentación e invitaciones de Opiniones en sus dos modos, sin alterar las notas que distinguen ejemplos de recomendaciones verificadas. Evidencia: `scripts/plantillas-portada.mjs`, `scripts/plantillas-opiniones.mjs`, `contenido/colegio.json` y pruebas. La generación mantiene el HTML público actual.
- [x] Preparar actualización repetible del contenido almacenado antes de usar campos nuevos: conserva valores editados, añade campos faltantes, crea una revisión de trabajo y audita sin tocar la publicación. El servidor rechaza esquemas antiguos hasta ejecutar el comando. Evidencia: `backend/content-schema.mjs`, `backend/upgrade-content.mjs`, pruebas y guía de operación. Pendiente: probarlo con MariaDB real y respaldo de la instalación.
- [x] Separar el generador de su archivo JSON y de la carpeta pública; preparar una copia local aislada de una revisión aprobada, con estilos y recursos actuales y verificación SHA-256 de archivos cargados. Evidencia: `scripts/generar-sitio.mjs`, `backend/stage-preview.mjs` y pruebas. Pendiente: integrar una vista previa sencilla dentro del panel y verificar contra MariaDB real.
- [ ] Confirmar ubicación y acceso al proyecto privado con servidor, hosting y mecanismo de despliegue.
- [ ] Completar inventario y esquema versionado de todos los campos editables; todavía quedan textos fijos en plantillas, formularios, navegación y pie de página.
- [ ] Implementar API, almacenamiento de revisiones y auditoría en el servidor privado.
- [ ] Implementar inicio de sesión, recuperación, MFA para Admin y autorización por campo en cada operación del servidor.
- [ ] Probar el prototipo con guardado real y repetir pruebas de permisos contra la API y MariaDB.

La política preparada no protege la página pública por sí sola. Es una pieza para ejecutar dentro del servidor antes de guardar cambios.

## Fase 2: edición completa

- [ ] Exponer todos los campos textuales del sitio en formularios por sección.
- [ ] Completar biblioteca y reemplazo de imágenes, póster y videos con procesamiento, variantes y publicación de medios aprobados.
- [ ] Mostrar desde el panel una vista previa de la revisión aprobada con las plantillas y estilos actuales. El paquete local ya se puede generar sin sobrescribir el sitio público.
- [ ] Verificar cobertura por campo, roles y vistas de escritorio y móvil.

## Fase 3: publicación y entrega

- [ ] Completar publicación de revisiones aprobadas, generación del sitio y despliegue reversible. Revisión y aprobación están preparadas en la API privada, sin cambiar la página pública.
- [ ] Ejecutar pruebas de seguridad, contenido, accesibilidad y regresión visual.
- [ ] Probar fallo de despliegue, restauración y respaldo.
- [ ] Entregar manual y completar aceptación con los responsables del colegio.
