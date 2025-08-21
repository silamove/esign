-- Migration 008: Fix envelope_templates missing columns
-- Add missing columns needed for smart templates

-- Add missing columns to envelope_templates
ALTER TABLE envelope_templates ADD COLUMN estimated_time INTEGER DEFAULT 30; -- Estimated completion time in minutes
ALTER TABLE envelope_templates ADD COLUMN difficulty_level TEXT DEFAULT 'medium' CHECK (difficulty_level IN ('easy', 'medium', 'hard', 'expert'));
