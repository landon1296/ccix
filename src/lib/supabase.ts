import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types
export interface User {
  id: string;
  email: string;
  display_name: string | null;
  car_number: string | null;
  avatar_style: string | null;
  created_at: string;
}

export interface League {
  id: string;
  league_code: string;
  name: string;
  owner_id: string;
  scoring_config: ScoringConfig;
  created_at: string;
  updated_at: string;
}

export interface ScoringConfig {
  stagePoints: number[];
  finishPoints: number[];
  fastestLapBonus: number;
  numberOfStages?: number;
  stagesEnabled?: boolean;
  allStagesWinBonus?: number;
  grandSlamBonus?: number;
  crownJewelBonusEnabled?: boolean;
  crownJewelBonusAmount?: number;
}

export interface LeagueMember {
  league_id: string;
  user_id: string;
  joined_at: string;
}

export interface Season {
  id: string;
  league_id: string;
  season_number: number;
  season_id: string;
  name: string;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
  archived_at: string | null;
}

export interface Track {
  id: string;
  name: string;
  track_type: string;
  default_stage_count: number;
  created_at: string;
  updated_at: string;
}

export interface Race {
  id: string;
  season_id: string;
  track_name: string;
  track_id: string;
  canonical_track_name?: string;
  /** Optional display name / title for the race (e.g. "Daytona 500") */
  race_name?: string | null;
  race_number: number;
  race_id: string;
  created_at: string;
}

export interface RaceResult {
  id: string;
  race_id: string;
  user_id: string;
  stage1_pos: number | null;
  stage2_pos: number | null;
  stage3_pos: number | null;
  finish_pos: number;
  fastest_lap: boolean;
  fastest_lap_time: string | null;
  stage1_points: number;
  stage2_points: number;
  stage3_points: number;
  finish_points: number;
  fastest_lap_points: number;
  total_points: number;
  created_at: string;
  updated_at: string;
}

export interface NascarCupDriver {
  id: string;
  name: string;
  wins: number;
  is_active: boolean;
  updated_at: string;
}

export interface LeagueMemberWithUser extends LeagueMember {
  user: User;
}

export interface SeasonWithRaces extends Season {
  races: Race[];
}
