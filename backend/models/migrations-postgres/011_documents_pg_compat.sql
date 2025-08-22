-- Migration 011: Documents compatibility for PostgreSQL
-- Purpose: Align documents table with Node models and seeders (user_id, filename, total_pages, metadata)

-- 1) Add missing columns (idempotent)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2) Backfill new columns from legacy columns where possible
UPDATE documents SET user_id = creator_id WHERE user_id IS NULL;
UPDATE documents SET filename = COALESCE(filename, file_name) WHERE filename IS NULL;
UPDATE documents SET total_pages = COALESCE(total_pages, 1) WHERE total_pages IS NULL;
UPDATE documents SET metadata = '{}'::jsonb WHERE metadata IS NULL;

-- 3) Foreign key and indexes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_documents_user'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT fk_documents_user FOREIGN KEY (user_id)
      REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

-- 4) Reverse backfill to satisfy NOT NULL on legacy columns
UPDATE documents SET file_name = filename WHERE file_name IS NULL AND filename IS NOT NULL;
UPDATE documents SET creator_id = user_id WHERE creator_id IS NULL AND user_id IS NOT NULL;

-- 5) Sync triggers to keep legacy/new columns aligned
DO $$
BEGIN
  -- Create or replace function
  CREATE OR REPLACE FUNCTION sync_documents_compat()
  RETURNS trigger AS $$
  BEGIN
    -- Keep filename and file_name in sync
    IF NEW.filename IS NOT NULL AND (NEW.file_name IS NULL OR NEW.file_name = '') THEN
      NEW.file_name = NEW.filename;
    ELSIF NEW.file_name IS NOT NULL AND (NEW.filename IS NULL OR NEW.filename = '') THEN
      NEW.filename = NEW.file_name;
    END IF;

    -- Keep user_id and creator_id in sync
    IF NEW.user_id IS NOT NULL AND NEW.creator_id IS NULL THEN
      NEW.creator_id = NEW.user_id;
    ELSIF NEW.creator_id IS NOT NULL AND NEW.user_id IS NULL THEN
      NEW.user_id = NEW.creator_id;
    END IF;

    -- Defaults
    IF NEW.metadata IS NULL THEN
      NEW.metadata = '{}'::jsonb;
    END IF;
    IF NEW.total_pages IS NULL THEN
      NEW.total_pages = 1;
    END IF;

    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- Drop existing triggers if present to avoid duplicates
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_documents_compat_bi') THEN
    DROP TRIGGER trg_documents_compat_bi ON documents;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_documents_compat_bu') THEN
    DROP TRIGGER trg_documents_compat_bu ON documents;
  END IF;

  -- Create BEFORE INSERT/UPDATE triggers
  CREATE TRIGGER trg_documents_compat_bi
  BEFORE INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION sync_documents_compat();

  CREATE TRIGGER trg_documents_compat_bu
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION sync_documents_compat();
END$$;

-- 6) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename);

-- Keep existing creator_id and file_name for legacy compatibility.
-- New code should prefer user_id and filename.
