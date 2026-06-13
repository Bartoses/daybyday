/**
 * Scoring weights ported verbatim from Config.js `APP_CONFIG.knowledge`.
 * These are the proven production values — changing them changes which tip a
 * family receives, so they live in one place and are covered by tests.
 */
export const ENGINE_CONFIG = {
  recentTipLookbackDays: 45,
  nearbyAgeWindowDays: 21,
  defaultCooldownDays: 21,
  stageBoostWeight: 20,
  leapBoostWeight: 25,
  /** Boost when a tip's category fits the current time of day (evening→sleep, etc.). */
  timeOfDayBoost: 12,
  noveltyWeight: 15,
  categoryRotationPenalty: 18,
  rotationGroupPenalty: 12,
  /** Penalty when a tip's category was sent before (legacy: hard-coded +18 boost / -25). */
  preferredTopicBoost: 18,
  repeatPenalty: 25,
  /** Max distance penalty for age-midpoint mismatch. */
  ageMidpointCap: 40,
  difficultyPenalty: {
    easy: 0,
    medium: 4,
    hard: 8,
  } as Record<string, number>,
} as const;
