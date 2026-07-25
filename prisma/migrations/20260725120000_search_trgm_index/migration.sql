-- Enable PostgreSQL trigram extension for fuzzy/typo-tolerant text search.
-- Falls back to ILIKE if extension is unavailable (unlikely on managed PG).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for similarity(/) and word_similarity(/) operators.
-- gin_trgm_ops supports both trigram-style and word-similarity matching.
CREATE INDEX IF NOT EXISTS "Requirement_title_trgm_idx"
  ON "Requirement" USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Requirement_body_trgm_idx"
  ON "Requirement" USING GIN (body gin_trgm_ops)
  WHERE body IS NOT NULL;
