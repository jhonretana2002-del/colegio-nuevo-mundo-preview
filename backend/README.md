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

## Borradores

`content-store.mjs` expone `getPublished` y `saveDraft`. El guardado usa una transacción, bloquea la fila del documento, compara `expectedVersion`, valida el rol y el contenido frente a la revisión publicada, inserta una revisión inmutable y audita el cambio. La API HTTP deberá obtener `actorId` y `role` exclusivamente de una sesión autenticada, nunca del cuerpo de la solicitud.

La importación inicial de `contenido/colegio.json`, la API HTTP y la publicación se implementarán después de conectar una instancia MariaDB real. Los tests de esta capa usan una conexión simulada; no certifican aún la migración SQL en el motor.

## Identidad y sesiones

`auth-store.mjs` prepara contraseñas con `scrypt` y sal individual, sesiones de ocho horas con token aleatorio de 256 bits y almacenamiento exclusivo de su hash. `readSession` obtiene la identidad y el rol desde la base; nunca se aceptan esos valores enviados por el navegador. Las cuentas que tienen un secreto MFA configurado no inician una sesión normal hasta integrar la verificación del segundo factor. Faltan protección de intentos de login, recuperación y flujo MFA para activar el servidor público.

`http-api.mjs` contiene la API HTTP inicial para login, sesión, logout, lectura publicada y borradores. Exige origen HTTPS, secreto CSRF y una función `loginGate` de límite de intentos; no incluye un ejecutable que abra un puerto. La API obtiene rol e identidad de la sesión, usa cookie segura y comprueba origen y CSRF en mutaciones. Antes de activarla faltan la implementación persistente de `loginGate`, MFA, aprovisionamiento de cuentas, TLS/proxy confiable y pruebas de integración con MariaDB.
