import { STAGES, type StageDef, type StageKey } from "./enums.js";

/**
 * Resolve the developmental stage for a given age in days.
 * Ported from Config.js `getStageForAgeDays` / APP_CONFIG.stages.
 * Ages beyond the last stage clamp to `early_school_age`; negative ages (pre-birth)
 * return null so callers can branch on pregnancy.
 */
export function stageForAgeDays(ageDays: number): StageKey | null {
  if (ageDays < 0) return null;
  for (const stage of STAGES) {
    if (ageDays >= stage.minAgeDays && ageDays <= stage.maxAgeDays) {
      return stage.key;
    }
  }
  // Older than the last defined stage -> clamp to the final stage.
  const last = STAGES[STAGES.length - 1] as StageDef;
  return last.key;
}

/**
 * Whole days between a birthdate (YYYY-MM-DD) and a reference date, in the given IANA
 * timezone. Mirrors the legacy `calculateAgeDays`. Returns negative for future dates.
 */
export function ageDaysFromBirthdate(birthdate: string, reference: Date = new Date()): number {
  const birth = parseDateOnly(birthdate);
  const ref = parseDateOnly(toDateOnly(reference));
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((ref.getTime() - birth.getTime()) / msPerDay);
}

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function toDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
