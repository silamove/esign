-- Migration 012: Documents legacy/new column sync and backfill (PostgreSQL)
-- Ensures inserts that only set filename/user_id work with legacy NOT NULLs on file_name/creator_id

-- 1) Backfill legacy columns from new ones where missing
UPDATE documents SET file_name = filename WHERE file_name IS NULL AND filename IS NOT NULL;
UPDATE documents SET creator_id = user_id WHERE creator_id IS NULL AND user_id IS NOT NULL;

-- 2) Create or replace sync trigger function to keep columns aligned on INSERT/UPDATE
CREATE OR REPLACE FUNCTION sync_documents_compat()
RETURNS trigger AS $$
BEGIN
  -- filename <-> file_name
  IF NEW.filename IS NOT NULL AND (NEW.file_name IS NULL OR NEW.file_name = '') THEN
    NEW.file_name = NEW.filename;
  ELSIF NEW.file_name IS NOT NULL AND (NEW.filename IS NULL OR NEW.filename = '') THEN
    NEW.filename = NEW.file_name;
  END IF;

  -- user_id <-> creator_id
  IF NEW.user_id IS NOT NULL AND NEW.creator_id IS NULL THEN
    NEW.creator_id = NEW.user_id;
  ELSIF NEW.creator_id IS NOT NULL AND NEW.user_id IS NULL THEN
    NEW.user_id = NEW.creator_id;
  END IF;

  -- defaults for new cols
  IF NEW.total_pages IS NULL THEN
    NEW.total_pages = 1;
  END IF;
  IF NEW.metadata IS NULL THEN
    NEW.metadata = '{}'::jsonb;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Drop existing triggers if any (idempotent) and create BEFORE triggers
DROP TRIGGER IF EXISTS trg_documents_compat_bi ON documents;
DROP TRIGGER IF EXISTS trg_documents_compat_bu ON documents;

CREATE TRIGGER trg_documents_compat_bi
BEFORE INSERT ON documents
FOR EACH ROW EXECUTE FUNCTION sync_documents_compat();

CREATE TRIGGER trg_documents_compat_bu
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION sync_documents_compat();
