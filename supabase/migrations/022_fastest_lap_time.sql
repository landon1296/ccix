-- Migration 022: Add fastest_lap_time to race_results
-- Stores the player's personal fastest lap time as a display string (e.g. "1:23.456")
ALTER TABLE public.race_results
  ADD COLUMN IF NOT EXISTS fastest_lap_time VARCHAR(12) DEFAULT NULL;
