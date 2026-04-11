-- Migration 023: Add race_name column to races table
-- race_name is an optional display name / title for the race (e.g. "Daytona 500")
-- track_name remains the canonical track identifier used for stats
ALTER TABLE public.races
  ADD COLUMN IF NOT EXISTS race_name VARCHAR(120) DEFAULT NULL;
