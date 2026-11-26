CREATE TABLE IF NOT EXISTS admin_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','moderador') NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_secret_encrypted VARBINARY(512) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_admin_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- statement
CREATE TABLE IF NOT EXISTS admin_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash BINARY(32) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_admin_sessions_token (token_hash),
  KEY ix_admin_sessions_expiry (expires_at),
  CONSTRAINT fk_admin_sessions_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- statement
CREATE TABLE IF NOT EXISTS content_documents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  content_key VARCHAR(120) NOT NULL,
  locale VARCHAR(16) NOT NULL DEFAULT 'es-CR',
  version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_content_key_locale (content_key, locale)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- statement
CREATE TABLE IF NOT EXISTS content_revisions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  document_id CHAR(36) NOT NULL,
  base_revision_id CHAR(36) NULL,
  author_id CHAR(36) NOT NULL,
  payload JSON NOT NULL,
  schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('borrador','en_revision','aprobado','rechazado') NOT NULL DEFAULT 'borrador',
  comment VARCHAR(1000) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_revision_document (document_id, id),
  KEY ix_revision_history (document_id, created_at),
  CONSTRAINT fk_revision_document FOREIGN KEY (document_id) REFERENCES content_documents(id) ON DELETE RESTRICT,
  CONSTRAINT fk_revision_author FOREIGN KEY (author_id) REFERENCES admin_users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_revision_base FOREIGN KEY (base_revision_id) REFERENCES content_revisions(id) ON DELETE SET NULL,
  CONSTRAINT ck_revision_payload CHECK (JSON_VALID(payload))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- statement
CREATE TABLE IF NOT EXISTS content_publications (
  document_id CHAR(36) NOT NULL PRIMARY KEY,
  revision_id CHAR(36) NOT NULL,
  published_by CHAR(36) NOT NULL,
  published_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_publication_document FOREIGN KEY (document_id) REFERENCES content_documents(id) ON DELETE RESTRICT,
  CONSTRAINT fk_publication_revision FOREIGN KEY (document_id, revision_id) REFERENCES content_revisions(document_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_publication_user FOREIGN KEY (published_by) REFERENCES admin_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- statement
CREATE TABLE IF NOT EXISTS media_assets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  kind ENUM('image','video','poster','document') NOT NULL,
  storage_key VARCHAR(512) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  bytes BIGINT UNSIGNED NOT NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  duration_ms INT UNSIGNED NULL,
  alt_text VARCHAR(500) NULL,
  credit VARCHAR(500) NULL,
  license_url VARCHAR(1000) NULL,
  checksum_sha256 BINARY(32) NOT NULL,
  uploaded_by CHAR(36) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_media_storage_key (storage_key),
  KEY ix_media_kind_created (kind, created_at),
  CONSTRAINT fk_media_uploader FOREIGN KEY (uploaded_by) REFERENCES admin_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- statement
CREATE TABLE IF NOT EXISTS media_variants (
  id CHAR(36) NOT NULL PRIMARY KEY,
  asset_id CHAR(36) NOT NULL,
  storage_key VARCHAR(512) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  bytes BIGINT UNSIGNED NOT NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  UNIQUE KEY uq_variant_storage_key (storage_key),
  CONSTRAINT fk_variant_asset FOREIGN KEY (asset_id) REFERENCES media_assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- statement
CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id CHAR(36) NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(80) NOT NULL,
  target_id VARCHAR(120) NULL,
  metadata JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_audit_created (created_at),
  KEY ix_audit_actor_created (actor_id, created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT ck_audit_metadata CHECK (metadata IS NULL OR JSON_VALID(metadata))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- statement
CREATE TABLE IF NOT EXISTS publish_jobs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  document_id CHAR(36) NOT NULL,
  revision_id CHAR(36) NOT NULL,
  requested_by CHAR(36) NOT NULL,
  status ENUM('pendiente','ejecutando','exitoso','fallido') NOT NULL DEFAULT 'pendiente',
  commit_sha CHAR(40) NULL,
  deployment_url VARCHAR(1000) NULL,
  error_message VARCHAR(2000) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  finished_at DATETIME(6) NULL,
  KEY ix_publish_status_created (status, created_at),
  CONSTRAINT fk_job_revision FOREIGN KEY (document_id, revision_id) REFERENCES content_revisions(document_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_job_user FOREIGN KEY (requested_by) REFERENCES admin_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
