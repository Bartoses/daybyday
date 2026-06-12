/**
 * Wonder-Weeks-style developmental leap windows — ported verbatim from Leap.js.
 * During a leap window the engine boosts sleep / emotional / behavior tips.
 *
 * Pregnancy handling (T3.1.1): when a due_date is known and the baby was born
 * early/late, adjusted age (corrected for prematurity) is the more accurate basis
 * for leap timing, mirroring `calculateAdjustedAgeDays`.
 */

export interface LeapWindow {
  leapNumber: number;
  ageDaysStart: number;
  ageDaysEnd: number;
  developmentalChange: string;
  behaviorChanges: string;
  skillsEmerging: string;
  parentSupportTip: string;
}

export const LEAP_WINDOWS: readonly LeapWindow[] = [
  {
    leapNumber: 1,
    ageDaysStart: 35,
    ageDaysEnd: 55,
    developmentalChange: "senses feel sharper and the world may seem more intense",
    behaviorChanges: "extra clinginess, fussiness, or shorter sleep stretches",
    skillsEmerging: "more alert watching, longer gaze, and early pattern noticing",
    parentSupportTip: "Keep stimulation light and return to familiar soothing routines.",
  },
  {
    leapNumber: 2,
    ageDaysStart: 56,
    ageDaysEnd: 84,
    developmentalChange: "your baby may start noticing simple patterns and repeated routines",
    behaviorChanges: "more frustration at transitions or a stronger need for contact",
    skillsEmerging: "longer coos, more purposeful movement, and growing interest in faces",
    parentSupportTip: "Short routines, contact, and slower transitions can help.",
  },
  {
    leapNumber: 3,
    ageDaysStart: 85,
    ageDaysEnd: 119,
    developmentalChange: "movement and cause-and-effect may start to feel more connected",
    behaviorChanges: "wobbly naps, louder protest, or needing more help settling",
    skillsEmerging: "batting, turning, and more active social responses",
    parentSupportTip: "Offer one simple activity at a time and more floor play breaks.",
  },
  {
    leapNumber: 4,
    ageDaysStart: 120,
    ageDaysEnd: 168,
    developmentalChange:
      "your baby may be linking sights, sounds, and movement in more complex ways",
    behaviorChanges: "clinginess, frustration, or unpredictable sleep can spike for a while",
    skillsEmerging: "rolling, reaching, and more deliberate play",
    parentSupportTip: "Keep routines predictable and trim stimulation when the day feels noisy.",
  },
  {
    leapNumber: 5,
    ageDaysStart: 180,
    ageDaysEnd: 238,
    developmentalChange: "patterns, distance, and how things relate may feel more noticeable",
    behaviorChanges: "big reactions to separation or more protest during transitions",
    skillsEmerging: "sitting, pivoting, and stronger curiosity in play",
    parentSupportTip: "Stay close, narrate what is happening, and keep practice playful.",
  },
  {
    leapNumber: 6,
    ageDaysStart: 240,
    ageDaysEnd: 305,
    developmentalChange: "your child may be working through early categories and sequence",
    behaviorChanges: "more sensitivity, frustration, or sudden routine wobble",
    skillsEmerging: "problem solving, imitation, and more intentional communication",
    parentSupportTip: "Break tasks into smaller steps and lean on repetition.",
  },
] as const;

export interface LeapContext {
  chronologicalAgeDays: number;
  adjustedAgeDays: number | null;
  leapAgeDays: number;
  leapConfidence: "higher" | "lower";
  inLeapWindow: boolean;
  leap: LeapWindow | null;
}

/**
 * Resolve the leap context for a child. Port of `getLeapContextForKid`.
 * @param chronologicalAgeDays days since birth.
 * @param adjustedAgeDays corrected age (from due_date), or null if not applicable.
 */
export function leapContextForAge(
  chronologicalAgeDays: number,
  adjustedAgeDays: number | null = null,
): LeapContext {
  const basisAgeDays = adjustedAgeDays !== null ? adjustedAgeDays : chronologicalAgeDays;
  let leap: LeapWindow | null = null;

  for (const window of LEAP_WINDOWS) {
    if (basisAgeDays >= window.ageDaysStart && basisAgeDays <= window.ageDaysEnd) {
      leap = window;
      break;
    }
  }

  return {
    chronologicalAgeDays,
    adjustedAgeDays,
    leapAgeDays: basisAgeDays,
    leapConfidence: adjustedAgeDays !== null ? "higher" : "lower",
    inLeapWindow: leap !== null,
    leap,
  };
}
