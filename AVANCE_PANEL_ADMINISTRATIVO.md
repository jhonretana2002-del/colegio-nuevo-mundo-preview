# Avance del panel administrativo

Este checklist corresponde a la guía de implementación del panel administrativo entregada el 25 de noviembre de 2026. El repositorio actual es una exportación pública; el prototipo `/admin/` aún no autentica, guarda ni publica. Las casillas se marcan solo cuando hay evidencia.

## Fase 1: base y permisos

- [x] Identificar la fuente de contenido (`contenido/colegio.json`), el generador (`scripts/generar-sitio.mjs`) y el prototipo `/admin/`. Evidencia: `README.md` y `GUIA_GESTION_CONTENIDOS.md`.
- [x] Preparar una política inicial de cambios por rol y pruebas automatizadas. Evidencia: `lib/content-policy.mjs` y `scripts/content-policy.test.mjs`.
- [x] Validar tipos, campos desconocidos, listas repetibles e identificadores duplicados antes de aceptar un borrador. Evidencia: `lib/content-shape.mjs` y `scripts/content-policy.test.mjs`.
- [ ] Confirmar ubicación y acceso al proyecto privado con servidor, hosting y mecanismo de despliegue.
- [ ] Completar inventario y esquema versionado de todos los campos editables.
- [ ] Implementar API, almacenamiento de revisiones y auditoría en el servidor privado.
- [ ] Implementar inicio de sesión, recuperación, MFA para Admin y autorización por campo en cada operación del servidor.
- [ ] Conectar el prototipo con guardado real y repetir pruebas de permisos contra la API.

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
