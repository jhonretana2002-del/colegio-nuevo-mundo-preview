CREATE TABLE IF NOT EXISTS content_review_decisions (
  revision_id CHAR(36) NOT NULL PRIMARY KEY,
  document_id CHAR(36) NOT NULL,
  reviewer_id CHAR(36) NOT NULL,
  decision ENUM('aprobado','rechazado') NOT NULL,
  reason VARCHAR(1000) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_review_document_created (document_id, created_at),
  CONSTRAINT fk_review_revision FOREIGN KEY (document_id, revision_id) REFERENCES content_revisions(document_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_review_reviewer FOREIGN KEY (reviewer_id) REFERENCES admin_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
