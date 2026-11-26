CREATE TABLE IF NOT EXISTS content_working (
  document_id CHAR(36) NOT NULL PRIMARY KEY,
  revision_id CHAR(36) NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_working_document FOREIGN KEY (document_id) REFERENCES content_documents(id) ON DELETE RESTRICT,
  CONSTRAINT fk_working_revision FOREIGN KEY (document_id, revision_id) REFERENCES content_revisions(document_id, id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
