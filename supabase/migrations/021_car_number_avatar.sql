-- Migration 021: Add car_number and avatar_style to users table
-- car_number: up to 2 chars (e.g. "48", "3")
-- avatar_style: one of 'classic', 'fire', 'chrome', 'neon'

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS car_number  VARCHAR(2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS avatar_style VARCHAR(20) DEFAULT 'classic';

-- Backfill existing rows so avatar_style is never null
UPDATE users SET avatar_style = 'classic' WHERE avatar_style IS NULL;
