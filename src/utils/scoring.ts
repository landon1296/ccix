import { ScoringConfig } from '../lib/supabase';

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  stagePoints: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  finishPoints: [
    40, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19,
    18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 1, 1, 1,
  ],
  fastestLapBonus: 1,
  stagesEnabled: true,
  allStagesWinBonus: 0,
  grandSlamBonus: 0,
  crownJewelBonusEnabled: false,
  crownJewelBonusAmount: 5,
};

export const CHARLOTTE_MOTOR_SPEEDWAY = 'Charlotte Motor Speedway';

export const CROWN_JEWEL_TRACKS: readonly string[] = [
  'Daytona International Speedway',
  'Indianapolis Motor Speedway',
  'Darlington Raceway',
  'Charlotte Motor Speedway',
];

export function isCrownJewelTrack(trackName: string): boolean {
  return CROWN_JEWEL_TRACKS.includes(trackName);
}

export function getEffectiveStages(stagesEnabled: boolean, trackName: string): number {
  if (!stagesEnabled) return 0;
  return trackName === CHARLOTTE_MOTOR_SPEEDWAY ? 3 : 2;
}

export function calculateStagePoints(position: number | null, config: ScoringConfig): number {
  if (position === null || position < 1) return 0;
  const points = config.stagePoints[position - 1];
  return points !== undefined ? points : 0;
}

export function calculateFinishPoints(position: number, config: ScoringConfig): number {
  if (position < 1) return 0;
  const points = config.finishPoints[position - 1];
  return points !== undefined ? points : 0;
}

export function calculateFastestLapPoints(hasFastestLap: boolean, config: ScoringConfig): number {
  return hasFastestLap ? config.fastestLapBonus : 0;
}

export function calculateTotalPoints(
  stage1Pos: number | null,
  stage2Pos: number | null,
  stage3Pos: number | null,
  finishPos: number,
  fastestLap: boolean,
  config: ScoringConfig,
  effectiveStages?: number,
  trackName?: string
): {
  stage1Points: number;
  stage2Points: number;
  stage3Points: number;
  finishPoints: number;
  fastestLapPoints: number;
  allStagesWinBonusPoints: number;
  grandSlamBonusPoints: number;
  crownJewelBonusPoints: number;
  totalPoints: number;
} {
  const useStage3 =
    effectiveStages !== undefined ? effectiveStages >= 3 : (config.numberOfStages ?? 0) >= 3;
  const stage1Points = calculateStagePoints(stage1Pos, config);
  const stage2Points = calculateStagePoints(stage2Pos, config);
  const stage3Points = useStage3 ? calculateStagePoints(stage3Pos, config) : 0;
  const finishPoints = calculateFinishPoints(finishPos, config);
  const fastestLapPoints = calculateFastestLapPoints(fastestLap, config);

  const allStagesWinBonus = config.allStagesWinBonus ?? 0;
  const grandSlamBonus = config.grandSlamBonus ?? 0;
  const stagesUsed = (effectiveStages ?? 0) >= 2;

  const s1First = stage1Pos === 1;
  const s2First = stage2Pos === 1;
  const s3First = useStage3 ? stage3Pos === 1 : true;
  const finishFirst = finishPos === 1;
  const allStagesAndFinish = stagesUsed && s1First && s2First && s3First && finishFirst;
  const grandSlam = allStagesAndFinish && fastestLap;

  const allStagesWinBonusPoints = allStagesWinBonus > 0 && allStagesAndFinish ? allStagesWinBonus : 0;
  const grandSlamBonusPoints = grandSlamBonus > 0 && grandSlam ? grandSlamBonus : 0;

  const crownJewelEnabled = config.crownJewelBonusEnabled ?? false;
  const crownJewelAmount = config.crownJewelBonusAmount ?? 5;
  const crownJewelBonusPoints =
    crownJewelEnabled && finishPos === 1 && trackName != null && isCrownJewelTrack(trackName) && crownJewelAmount > 0
      ? crownJewelAmount
      : 0;

  const totalPoints =
    stage1Points + stage2Points + stage3Points + finishPoints + fastestLapPoints +
    allStagesWinBonusPoints + grandSlamBonusPoints + crownJewelBonusPoints;

  return {
    stage1Points, stage2Points, stage3Points, finishPoints, fastestLapPoints,
    allStagesWinBonusPoints, grandSlamBonusPoints, crownJewelBonusPoints, totalPoints,
  };
}

export interface BonusEarnerResult {
  allStagesWin: { displayName: string } | null;
  grandSlam: { displayName: string } | null;
  crownJewel: { displayName: string } | null;
}

export function getBonusEarners({
  results,
  config,
  trackName,
}: {
  results: {
    stage1_pos: number | null;
    stage2_pos: number | null;
    stage3_pos: number | null;
    finish_pos: number;
    fastest_lap: boolean;
    displayName: string;
  }[];
  config: ScoringConfig;
  trackName: string;
}): BonusEarnerResult {
  const allStagesWinBonus = config.allStagesWinBonus ?? 0;
  const grandSlamBonus = config.grandSlamBonus ?? 0;
  const crownJewelEnabled = config.crownJewelBonusEnabled ?? false;
  const stagesEnabled = config.stagesEnabled ?? true;

  let allStagesWin: { displayName: string } | null = null;
  let grandSlam: { displayName: string } | null = null;
  let crownJewel: { displayName: string } | null = null;

  for (const r of results) {
    const effectiveStages = stagesEnabled ? (trackName === CHARLOTTE_MOTOR_SPEEDWAY ? 3 : 2) : 0;
    const useStage3 = effectiveStages >= 3;
    const s1First = r.stage1_pos === 1;
    const s2First = r.stage2_pos === 1;
    const s3First = useStage3 ? r.stage3_pos === 1 : true;
    const finishFirst = r.finish_pos === 1;
    const allStagesAndFinish = effectiveStages >= 2 && s1First && s2First && s3First && finishFirst;
    const isGrandSlam = allStagesAndFinish && r.fastest_lap;

    if (isGrandSlam && grandSlamBonus > 0) {
      grandSlam = { displayName: r.displayName };
    } else if (allStagesAndFinish && allStagesWinBonus > 0) {
      allStagesWin = { displayName: r.displayName };
    }

    if (crownJewelEnabled && finishFirst && isCrownJewelTrack(trackName)) {
      crownJewel = { displayName: r.displayName };
    }
  }

  return { allStagesWin, grandSlam, crownJewel };
}
