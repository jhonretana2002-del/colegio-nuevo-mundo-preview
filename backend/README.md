# Base administrativa con MariaDB

Esta carpeta prepara el almacenamiento y un servidor privado para el panel. El sitio público sigue siendo estático; iniciar este servidor no publica borradores ni cambia el diseño público.

## Inicio

1. Crear una base MariaDB con `utf8mb4` y un usuario de aplicación con privilegios sobre esa base. Usar MariaDB 10.6 o posterior como objetivo de compatibilidad.
2. Configurar las variables de `.env.example` en el entorno privado del servidor. `MEDIA_ROOT` debe ser una carpeta absoluta, privada y respaldada con permiso de escritura. `PREVIEW_ROOT` debe ser otra carpeta absoluta, privada y fuera del repositorio para las copias de vista previa. `PUBLIC_ORIGIN` debe ser el origen HTTPS del panel. Los secretos CSRF y de límite de acceso deben ser aleatorios e independientes, con al menos 32 caracteres; la clave MFA debe tener 32 bytes en 64 caracteres hexadecimales. No cargar secretos al repositorio.
3. En `backend/`, ejecutar `pnpm install --frozen-lockfile` y `pnpm db:migrate`.
4. En una terminal privada e interactiva, ejecutar `pnpm db:first-admin`. La contraseña no se muestra. Configurar la aplicación de autenticación con el código que aparece y confirmar un código de seis dígitos. Guardar el ID de cuenta indicado y cerrar la terminal para retirar el secreto de la pantalla. El asistente solo funciona cuando no existe ninguna cuenta Admin.
5. Ejecutar `pnpm db:seed <id-de-Admin>`. Esto importa `contenido/colegio.json` una sola vez como base de trabajo; volver a ejecutarlo no sobrescribe cambios. La importación inicial no equivale a aprobación institucional ni despliega la página.
6. Si la base ya tenía contenido de una versión anterior del proyecto, respaldarla y ejecutar `pnpm db:upgrade-content <id-de-Admin>` antes de iniciar el panel. El comando añade solamente los campos ausentes, conserva los valores editados y crea una nueva revisión de trabajo en estado borrador; no mueve la publicación. Repetirlo sin cambios no crea otra revisión. Una revisión que estaba en aprobación debe enviarse otra vez a revisión tras la actualización.
7. Configurar un proxy HTTPS que envíe **todas** las rutas del origen privado al servicio local y ejecutar `pnpm start`. El proxy debe reemplazar `X-Forwarded-For` con una única IP de cliente válida, sin conservar valores enviados por el visitante; el servidor solo la acepta desde loopback. El proceso escucha solo en `127.0.0.1:PORT`, sirve el panel y su API desde el mismo origen y comprueba que la base y el contenido inicial existan antes de abrir el puerto. No exponer directamente el puerto interno.

Las migraciones usan un bloqueo de base de datos, checksum e identificadores de archivo ordenados. No se modifican migraciones ya aplicadas; se crea una nueva para cada cambio. Los DDL de MariaDB confirman implícitamente y las tablas usan `IF NOT EXISTS` para poder reintentar tras una interrupción.

## Modelo inicial

- `admin_users` y `admin_sessions`: identidad y sesiones; el hash de contraseña y el hash de token se calculan en la aplicación. Nunca guardar contraseñas ni tokens completos.
- `content_documents`, `content_revisions` y `content_publications`: documento lógico, historial inmutable y puntero a la revisión pública. El JSON conserva la forma de `contenido/colegio.json`; la política de `lib/content-policy.mjs` debe validarse antes de insertar una revisión.
- `content_working`: puntero al último borrador de trabajo, separado de la revisión pública. Permite continuar tras recargar y conservar cambios de otros editores.
- `content_review_decisions`: decisión de Admin y motivo de devolución ligados a una revisión. La migración `005_review_decisions.sql` conserva el historial sin reemplazar el contenido de la revisión.
- `media_assets` y `media_variants`: metadatos y rutas de archivos en almacenamiento externo. Los binarios no van en MariaDB.
- `audit_events` y `publish_jobs`: trazabilidad y resultado de despliegues.

`admin_mfa_state` guarda el último intervalo TOTP aceptado para impedir reutilizar un código. Las claves UUID se generan en la aplicación. Los tiempos se escriben en UTC. La API debe comprobar que solo Admin apruebe, publique o cambie medios; MariaDB no sustituye la autorización de servidor. Antes de producción faltan respaldo, procesamiento de medios y conexión con el generador.

## Borradores

`content-store.mjs` expone lectura publicada y de trabajo, guardado, historial, envío a revisión, aprobación y devolución. El guardado usa una transacción, bloquea la fila del documento, compara `expectedVersion`, valida el rol y el contenido frente a la revisión de trabajo, inserta una revisión con contenido inmutable, mueve el puntero de trabajo y audita el cambio. El autor del borrador o Admin puede enviarlo a revisión; solo Admin puede aprobar o devolver la revisión actual. La devolución exige un motivo de 5 a 1000 caracteres. Las transiciones comparan versión, identificador y estado dentro de una transacción, y generan auditoría. El historial de consulta muestra las últimas 20 versiones sin entregar sus documentos completos. La aprobación **no mueve** `content_publications` ni modifica la página pública. La API obtiene `actorId` y `role` exclusivamente de una sesión autenticada, nunca del cuerpo de la solicitud.

`seed-content.mjs` importa una revisión base y su puntero de lectura en una transacción solo con una cuenta Admin activa que tenga MFA. Es repetible sin sobrescribir. La publicación real queda pendiente. Los tests de esta capa usan una conexión simulada; no certifican aún la migración SQL en MariaDB.

`upgrade-content.mjs` actualiza la estructura JSON de una instalación previa dentro de una transacción. Toma la última revisión de trabajo, agrega campos nuevos de la plantilla sin reemplazar los existentes, valida el resultado, crea una revisión nueva, avanza la versión y registra auditoría. La revisión publicada sigue apuntando al contenido anterior. El servidor privado se niega a abrir el panel con una revisión de trabajo de esquema antiguo. Esta operación todavía no se ha ejecutado en una instancia MariaDB real.

## Vista previa local de una revisión aprobada

`stage-preview.mjs` lee la revisión de trabajo de MariaDB y solo acepta el estado `aprobado`. Comprueba la estructura, los campos y los medios; copia los recursos públicos actuales y los archivos cargados que la revisión utiliza, verificando el SHA-256 de cada uno contra `media_assets`. Genera las siete páginas y la página 404 en una carpeta nueva **fuera del repositorio**. No cambia la revisión publicada, el sitio de GitHub Pages ni los archivos fuente. Si algo falla, elimina únicamente la carpeta temporal que acaba de crear. Nunca sobrescribe una carpeta de destino existente.

Con las variables `DB_*` y `MEDIA_ROOT` de la instalación privada configuradas:

```powershell
node backend/stage-preview.mjs C:\ruta\absoluta\a\vista-colegio
node scripts/servir-vista-previa.mjs C:\ruta\absoluta\a\vista-colegio 4873
```

Abrir `http://127.0.0.1:4873/colegio-nuevo-mundo-preview/`. El servidor local escucha solo en el equipo del operador. La carpeta generada contiene únicamente archivos públicos; no contiene contraseñas ni secretos. En el panel privado, una revisión aprobada muestra **Ver páginas en vista previa**. La API prepara otra copia en `PREVIEW_ROOT` y la sirve bajo `/api/site-preview/`, con sesión obligatoria para cada recurso y acceso solo a la revisión aprobada vigente. Esta copia no cambia la página pública. Faltan publicación, reversión y despliegue con medios procesados. La prueba automatizada compara las páginas generadas con las actuales ignorando únicamente las diferencias de salto de línea de Windows. No se ha probado esta operación con MariaDB real.

## Identidad y sesiones

`auth-store.mjs` prepara contraseñas con `scrypt` y sal individual, sesiones de ocho horas con token aleatorio de 256 bits y almacenamiento exclusivo de su hash. `readSession` obtiene la identidad y el rol desde la base; nunca se aceptan esos valores enviados por el navegador. Admin debe tener un secreto TOTP configurado y presentar un código de seis dígitos; las cuentas Moderador también lo requieren cuando tienen un secreto configurado. Los secretos se cifran con AES-256-GCM, y cada código aceptado queda marcado en una transacción junto con la nueva sesión. La clave de cifrado requiere respaldo seguro y rotación planificada.

`account-provision.mjs` contiene las operaciones de alta, reemplazo MFA y restablecimiento de contraseña para una herramienta privada de operación. El alta Admin exige confirmar un TOTP generado con `generateMfaSecret()` y presentado mediante `enrollmentUri()`. El intervalo confirmado se marca como usado. Los dos procesos de recuperación exigen registrar responsable y motivo, revocan todas las sesiones y se auditan en la misma transacción que el cambio. **No son rutas HTTP ni validan por sí mismas la identidad del operador**; esa validación la aporta `manage-accounts.mjs` para su uso interactivo. No mostrar el URI de inscripción por correo ni registrarlo en logs.

`manage-accounts.mjs` prepara esa herramienta privada para crear cuentas Admin o Moderador y restablecer contraseña o MFA. Solo funciona en terminal interactiva, aplica el límite de intentos, autentica a una cuenta Admin con contraseña y código MFA, usa una sesión temporal que revoca al terminar y registra el ID del operador en las operaciones de cuenta. Para recuperar una cuenta exige un motivo y recuerda verificar la identidad de la persona destinataria por el procedimiento del colegio. Las contraseñas se introducen sin mostrarse; el secreto MFA solo aparece en la terminal privada durante la inscripción. Antes de usarla se deben definir el procedimiento presencial de verificación, la entrega segura de credenciales y el acceso del operador al servidor y MariaDB. No resuelve por sí misma el bloqueo de la **única** cuenta Admin; ese caso requiere un procedimiento de emergencia documentado y supervisado.

Cuando se conecte la base de datos, desde `backend/`:

```powershell
pnpm db:manage-accounts crear-moderador
pnpm db:manage-accounts crear-admin
pnpm db:manage-accounts restablecer-clave
pnpm db:manage-accounts reemplazar-mfa
```

`http-api.mjs` contiene la API HTTP inicial para login, sesión, logout, lectura publicada y borradores. Exige origen HTTPS, secretos CSRF/MFA y una función `loginGate`; `private-server.mjs` la sirve junto a los archivos estrictamente necesarios del panel. `login-limit.mjs` proporciona contadores de quince minutos en MariaDB y claves HMAC para no guardar IP o correo en claro. La API obtiene rol e identidad de la sesión, usa cookie segura y comprueba origen y CSRF en mutaciones. Antes de activarla en producción faltan un proxy TLS confiable, pruebas de integración con MariaDB y el procedimiento operativo de recuperación de cuentas.

El prototipo `admin/` consulta `/api/auth/me` al iniciar. Cuando la API privada existe, ofrece acceso, lee `/api/content/colegio/working`, compara el contenido guardado con `/api/content/colegio` y guarda con versión y CSRF; si no existe (404, como en GitHub Pages), conserva la descarga local del borrador. La API y el prototipo deben estar bajo el mismo origen HTTPS. `admin/field-catalog.mjs` construye formularios para todos los valores editables de `contenido/colegio.json` según el rol; la política del servidor vuelve a validar cada cambio. El formulario agrupa los campos, muestra nombres comprensibles y permite elegir medios con una vista previa. La comparación y el historial son de consulta; la revisión aprobada también ofrece una vista previa de todas las páginas. Todavía no hay restauración.

`GET /api/media` lista archivos locales y los cargados en MariaDB. `POST /api/media` admite solo Admin y usa sesión, origen y CSRF; acepta JPG, PNG, WebP hasta 12 MiB y MP4 hasta 100 MiB. `backend/media-store.mjs` verifica la firma inicial; además decodifica las imágenes con Sharp, exige 320 × 240 píxeles como mínimo y las convierte a WebP con un máximo de 1600 píxeles por lado. El archivo procesado recibe un nombre aleatorio y su tamaño, dimensiones y hash se registran junto con la auditoría en MariaDB. También crea una variante WebP de hasta 480 píxeles en `media_variants`; el panel la pide mediante `?size=small` y, para imágenes antiguas sin variante, recibe el archivo original. Para MP4 comprueba que las cajas `ftyp`, `mdat` y `moov` estén completas antes de guardar el archivo original; esta prueba no verifica códecs ni garantiza reproducción. La vista previa de medios exige sesión. El borrador solo puede referenciar archivos del catálogo local o ya registrados. Antes de producción faltan procesamiento y verificación de códecs de video, limpieza de cargas no usadas, respaldo de `MEDIA_ROOT` y copia de medios aprobados al despliegue público. La publicación sigue pendiente.
