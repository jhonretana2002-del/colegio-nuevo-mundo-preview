# Avance del panel administrativo

Este checklist corresponde a la guía de implementación del panel administrativo entregada el 25 de noviembre de 2026. El repositorio actual es una exportación pública; el prototipo `/admin/` aún no autentica, guarda ni publica. Las casillas se marcan solo cuando hay evidencia.

## Fase 1: base y permisos

- [x] Identificar la fuente de contenido (`contenido/colegio.json`), el generador (`scripts/generar-sitio.mjs`) y el prototipo `/admin/`. Evidencia: `README.md` y `GUIA_GESTION_CONTENIDOS.md`.
- [x] Preparar una política inicial de cambios por rol y pruebas automatizadas. Evidencia: `lib/content-policy.mjs` y `scripts/content-policy.test.mjs`.
- [x] Validar tipos, campos desconocidos, listas repetibles e identificadores duplicados antes de aceptar un borrador. Evidencia: `lib/content-shape.mjs` y `scripts/content-policy.test.mjs`.
- [x] Definir el modelo inicial de MariaDB para cuentas, sesiones, revisiones, medios, auditoría y publicaciones. Evidencia: `backend/migrations/001_initial.sql`, `backend/db.mjs` y `backend/db.test.mjs`. Pendiente: ejecución contra una instancia real.
- [x] Preparar la capa de lectura publicada y guardado de borradores con transacción, control de versión, validación de rol y auditoría. Evidencia: `backend/content-store.mjs` y `backend/content-store.test.mjs`. Pendiente: conexión a una API autenticada y prueba con MariaDB real.
- [x] Preparar hash de contraseñas y sesiones persistentes con roles leídos de MariaDB. Evidencia: `backend/auth-store.mjs` y `backend/auth-store.test.mjs`. Pendiente: pruebas con MariaDB real.
- [x] Preparar la API HTTP inicial de sesión y borradores con origen, cookie segura y CSRF. Evidencia: `backend/http-api.mjs` y `backend/http-api.test.mjs`. Pendiente: despliegue privado.
- [x] Preparar límite de intentos persistente por cuenta e IP en MariaDB. Evidencia: `backend/migrations/002_login_limits.sql`, `backend/login-limit.mjs` y `backend/login-limit.test.mjs`. Pendiente: prueba contra MariaDB real.
- [x] Preparar verificación TOTP para Admin, secreto cifrado y rechazo de códigos reutilizados. Evidencia: `backend/mfa.mjs`, `backend/auth-store.mjs`, `backend/migrations/003_mfa_state.sql` y pruebas. Pendiente: integración con MariaDB real.
- [x] Preparar operaciones transaccionales de alta y recuperación de cuentas con confirmación MFA, revocación de sesiones y auditoría. Evidencia: `backend/account-provision.mjs` y pruebas. Pendiente: herramienta privada para operadores y verificación presencial de identidad.
- [x] Preparar puntero de borrador de trabajo y API de lectura autenticada; el guardado usa la revisión de trabajo sin modificar la publicada. Evidencia: `backend/migrations/004_content_working.sql`, `backend/content-store.mjs` y pruebas. Pendiente: prueba con MariaDB real.
- [x] Conectar el prototipo a sesión y guardado de borradores cuando exista una API privada bajo el mismo origen; conservar descarga local en GitHub Pages. Evidencia: `admin/gestion.js` y `admin/index.html`. Pendiente: prueba visual e integración con servidor privado.
- [ ] Confirmar ubicación y acceso al proyecto privado con servidor, hosting y mecanismo de despliegue.
- [ ] Completar inventario y esquema versionado de todos los campos editables.
- [ ] Implementar API, almacenamiento de revisiones y auditoría en el servidor privado.
- [ ] Implementar inicio de sesión, recuperación, MFA para Admin y autorización por campo en cada operación del servidor.
- [ ] Probar el prototipo con guardado real y repetir pruebas de permisos contra la API y MariaDB.

La política preparada no protege la página pública por sí sola. Es una pieza para ejecutar dentro del servidor antes de guardar cambios.

## Fase 2: edición completa

- [ ] Exponer todos los campos textuales del sitio en formularios por sección.
- [ ] Implementar biblioteca y reemplazo de imágenes, posters y videos solo para Admin.
- [ ] Generar vista previa con las plantillas y estilos actuales.
- [ ] Verificar cobertura por campo, roles y vistas de escritorio y móvil.

## Fase 3: publicación y entrega

- [ ] Implementar revisión, aprobación, generación y despliegue reversible.
- [ ] Ejecutar pruebas de seguridad, contenido, accesibilidad y regresión visual.
- [ ] Probar fallo de despliegue, restauración y respaldo.
- [ ] Entregar manual y completar aceptación con los responsables del colegio.
