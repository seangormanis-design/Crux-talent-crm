-- Full-text search: CV content (per document version) and interaction notes.
-- searchVector is a STORED generated column (Postgres auto-recomputes it on
-- every insert/update of the source column), indexed with GIN for fast
-- `@@ plainto_tsquery(...)` lookups. Prisma has no first-class tsvector
-- support, so these columns are marked Unsupported("tsvector") in
-- schema.prisma and queried via $queryRaw.

ALTER TABLE "document_versions" ADD COLUMN "extractedText" TEXT;
ALTER TABLE "document_versions"
  ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce("extractedText", ''))) STORED;
CREATE INDEX "document_versions_search_idx" ON "document_versions" USING GIN ("searchVector");

ALTER TABLE "interactions"
  ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce("notes", ''))) STORED;
CREATE INDEX "interactions_search_idx" ON "interactions" USING GIN ("searchVector");

-- Extract Intelligence: candidate skills suggested from call notes, reviewed
-- and approved the same way as every other suggestion in this flow — never
-- auto-saved.
ALTER TABLE "interaction_intelligence" ADD COLUMN "suggestedSkills" JSONB;
