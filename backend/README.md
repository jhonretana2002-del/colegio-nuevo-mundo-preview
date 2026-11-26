# Base administrativa con MariaDB

Esta carpeta prepara el almacenamiento del panel. El sitio público sigue siendo estático y se genera desde la revisión aprobada; este código no activa por sí solo el acceso `/admin/`.

## Inicio

1. Crear una base MariaDB con `utf8mb4` y un usuario de aplicación con privilegios sobre esa base. Usar MariaDB 10.6 o posterior como objetivo de compatibilidad.
2. Configurar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` en el entorno privado del servidor. `.env.example` solo muestra los nombres; no cargar secretos al repositorio.
3. En esta carpeta, ejecutar `pnpm install --frozen-lockfile` y `pnpm db:migrate` desde el servidor que pueda conectar con MariaDB.

Las migraciones usan un bloqueo de base de datos, checksum e identificadores de archivo ordenados. No se modifican migraciones ya aplicadas; se crea una nueva para cada cambio. Los DDL de MariaDB confirman implícitamente y las tablas usan `IF NOT EXISTS` para poder reintentar tras una interrupción.

## Modelo inicial

- `admin_users` y `admin_sessions`: identidad y sesiones; el hash de contraseña y el hash de token se calculan en la aplicación. Nunca guardar contraseñas ni tokens completos.
- `content_documents`, `content_revisions` y `content_publications`: documento lógico, historial inmutable y puntero a la revisión pública. El JSON conserva la forma de `contenido/colegio.json`; la política de `lib/content-policy.mjs` debe validarse antes de insertar una revisión.
- `media_assets` y `media_variants`: metadatos y rutas de archivos en almacenamiento externo. Los binarios no van en MariaDB.
- `audit_events` y `publish_jobs`: trazabilidad y resultado de despliegues.

Las claves UUID se generan en la aplicación. Los tiempos se escriben en UTC. La API debe comprobar que solo Admin apruebe, publique o cambie medios; MariaDB no sustituye la autorización de servidor. Antes de producción faltan autenticación, API, respaldo, procesamiento de medios y conexión con el generador.
