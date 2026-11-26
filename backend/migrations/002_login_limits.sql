CREATE TABLE IF NOT EXISTS login_limits (
  key_hash BINARY(32) NOT NULL PRIMARY KEY,
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  reset_at DATETIME(6) NOT NULL,
  KEY ix_login_limits_reset (reset_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
