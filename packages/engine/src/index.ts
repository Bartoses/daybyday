/**
 * @daybyday/engine — the migrated tip-selection IP.
 *
 * Pure, deterministic port of the legacy Apps Script content engine
 * (Config.js / daily.js / knowledge_generator.js / Leap.js). No DB or network
 * access: callers supply candidates + history, the engine returns the pick.
 */

export { ENGINE_CONFIG } from "./config.js";
export { hashString } from "./hash.js";
export {
  LEAP_WINDOWS,
  leapContextForAge,
  type LeapWindow,
  type LeapContext,
} from "./leap.js";
export {
  ROTATING_CATEGORIES,
  requestedCategoryAliases,
  resolveFamilyCategory,
  chooseTopicForChild,
} from "./topic.js";
export {
  scoreCandidate,
  scorePool,
  selectContentItem,
  preferredCategoriesForHour,
  type Candidate,
  type HistoryEntry,
  type ScoreInput,
  type TemporalContext,
} from "./score.js";
export { renderCard, type RenderedCard } from "./render.js";

// Re-export stage helpers from schemas so consumers have one engine entry point.
export { stageForAgeDays, ageDaysFromBirthdate } from "@daybyday/schemas";
