# Base administrativa con MariaDB

Esta carpeta prepara el almacenamiento del panel. El sitio público sigue siendo estático y se genera desde la revisión aprobada; este código no activa por sí solo el acceso `/admin/`.

## Inicio

1. Crear una base MariaDB con `utf8mb4` y un usuario de aplicación con privilegios sobre esa base. Usar MariaDB 10.6 o posterior como objetivo de compatibilidad.
2. Configurar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` y `MFA_ENCRYPTION_KEY` en el entorno privado del servidor. La clave MFA debe ser aleatoria, de 32 bytes expresados en 64 caracteres hexadecimales. `.env.example` solo muestra los nombres; no cargar secretos al repositorio.
3. En esta carpeta, ejecutar `pnpm install --frozen-lockfile` y `pnpm db:migrate` desde el servidor que pueda conectar con MariaDB.

Las migraciones usan un bloqueo de base de datos, checksum e identificadores de archivo ordenados. No se modifican migraciones ya aplicadas; se crea una nueva para cada cambio. Los DDL de MariaDB confirman implícitamente y las tablas usan `IF NOT EXISTS` para poder reintentar tras una interrupción.

## Modelo inicial

- `admin_users` y `admin_sessions`: identidad y sesiones; el hash de contraseña y el hash de token se calculan en la aplicación. Nunca guardar contraseñas ni tokens completos.
- `content_documents`, `content_revisions` y `content_publications`: documento lógico, historial inmutable y puntero a la revisión pública. El JSON conserva la forma de `contenido/colegio.json`; la política de `lib/content-policy.mjs` debe validarse antes de insertar una revisión.
- `content_working`: puntero al último borrador de trabajo, separado de la revisión pública. Permite continuar tras recargar y conservar cambios de otros editores.
- `media_assets` y `media_variants`: metadatos y rutas de archivos en almacenamiento externo. Los binarios no van en MariaDB.
- `audit_events` y `publish_jobs`: trazabilidad y resultado de despliegues.

`admin_mfa_state` guarda el último intervalo TOTP aceptado para impedir reutilizar un código. Las claves UUID se generan en la aplicación. Los tiempos se escriben en UTC. La API debe comprobar que solo Admin apruebe, publique o cambie medios; MariaDB no sustituye la autorización de servidor. Antes de producción faltan respaldo, procesamiento de medios y conexión con el generador.

## Borradores

`content-store.mjs` expone `getPublished`, `getWorking` y `saveDraft`. El guardado usa una transacción, bloquea la fila del documento, compara `expectedVersion`, valida el rol y el contenido frente a la revisión de trabajo, inserta una revisión inmutable, mueve el puntero de trabajo y audita el cambio. El contenido publicado no cambia al guardar un borrador. La API obtiene `actorId` y `role` exclusivamente de una sesión autenticada, nunca del cuerpo de la solicitud.

La importación inicial de `contenido/colegio.json` y la publicación se implementarán después de conectar una instancia MariaDB real. Los tests de esta capa usan una conexión simulada; no certifican aún la migración SQL en el motor.

## Identidad y sesiones

`auth-store.mjs` prepara contraseñas con `scrypt` y sal individual, sesiones de ocho horas con token aleatorio de 256 bits y almacenamiento exclusivo de su hash. `readSession` obtiene la identidad y el rol desde la base; nunca se aceptan esos valores enviados por el navegador. Admin debe tener un secreto TOTP configurado y presentar un código de seis dígitos; las cuentas Moderador también lo requieren cuando tienen un secreto configurado. Los secretos se cifran con AES-256-GCM, y cada código aceptado queda marcado en una transacción junto con la nueva sesión. La clave de cifrado requiere respaldo seguro y rotación planificada.

`account-provision.mjs` contiene las operaciones de alta, reemplazo MFA y restablecimiento de contraseña para una herramienta privada de operación. El alta Admin exige confirmar un TOTP generado con `generateMfaSecret()` y presentado mediante `enrollmentUri()`. El intervalo confirmado se marca como usado. Los dos procesos de recuperación exigen registrar responsable y motivo, revocan todas las sesiones y se auditan en la misma transacción que el cambio. **No son rutas HTTP ni validan por sí mismas la identidad del operador**: una herramienta privada debe autenticar y autorizar al responsable, verificar la identidad de la persona solicitante y limitar el acceso a la base. No mostrar el URI de inscripción por correo ni registrarlo en logs. Faltan esa herramienta y la validación operativa de recuperación.

`http-api.mjs` contiene la API HTTP inicial para login, sesión, logout, lectura publicada y borradores. Exige origen HTTPS, secretos CSRF/MFA y una función `loginGate`; no incluye un ejecutable que abra un puerto. `login-limit.mjs` proporciona esa función con contadores de quince minutos almacenados en MariaDB y claves HMAC para no guardar IP o correo en claro en la tabla de límites. La API obtiene rol e identidad de la sesión, usa cookie segura y comprueba origen y CSRF en mutaciones. Antes de activarla faltan aprovisionamiento y recuperación de cuentas, TLS/proxy confiable y pruebas de integración con MariaDB.

El prototipo `admin/` consulta `/api/auth/me` al iniciar. Cuando la API privada existe, ofrece acceso, lee `/api/content/colegio/working` y guarda con versión y CSRF; si no existe (404, como en GitHub Pages), conserva la descarga local del borrador. La API y el prototipo deben estar bajo el mismo origen HTTPS. El formulario sigue limitado a los campos del prototipo: la cobertura completa de secciones y medios queda pendiente.
