var LEAP_WINDOWS = [
  {
    leap_number: 1,
    age_days_start: 35,
    age_days_end: 55,
    developmental_change: 'senses feel sharper and the world may seem more intense',
    behavior_changes: 'extra clinginess, fussiness, or shorter sleep stretches',
    skills_emerging: 'more alert watching, longer gaze, and early pattern noticing',
    parent_support_tip: 'Keep stimulation light and return to familiar soothing routines.'
  },
  {
    leap_number: 2,
    age_days_start: 56,
    age_days_end: 84,
    developmental_change: 'your baby may start noticing simple patterns and repeated routines',
    behavior_changes: 'more frustration at transitions or a stronger need for contact',
    skills_emerging: 'longer coos, more purposeful movement, and growing interest in faces',
    parent_support_tip: 'Short routines, contact, and slower transitions can help.'
  },
  {
    leap_number: 3,
    age_days_start: 85,
    age_days_end: 119,
    developmental_change: 'movement and cause-and-effect may start to feel more connected',
    behavior_changes: 'wobbly naps, louder protest, or needing more help settling',
    skills_emerging: 'batting, turning, and more active social responses',
    parent_support_tip: 'Offer one simple activity at a time and more floor play breaks.'
  },
  {
    leap_number: 4,
    age_days_start: 120,
    age_days_end: 168,
    developmental_change: 'your baby may be linking sights, sounds, and movement in more complex ways',
    behavior_changes: 'clinginess, frustration, or unpredictable sleep can spike for a while',
    skills_emerging: 'rolling, reaching, and more deliberate play',
    parent_support_tip: 'Keep routines predictable and trim stimulation when the day feels noisy.'
  },
  {
    leap_number: 5,
    age_days_start: 180,
    age_days_end: 238,
    developmental_change: 'patterns, distance, and how things relate may feel more noticeable',
    behavior_changes: 'big reactions to separation or more protest during transitions',
    skills_emerging: 'sitting, pivoting, and stronger curiosity in play',
    parent_support_tip: 'Stay close, narrate what is happening, and keep practice playful.'
  },
  {
    leap_number: 6,
    age_days_start: 240,
    age_days_end: 305,
    developmental_change: 'your child may be working through early categories and sequence',
    behavior_changes: 'more sensitivity, frustration, or sudden routine wobble',
    skills_emerging: 'problem solving, imitation, and more intentional communication',
    parent_support_tip: 'Break tasks into smaller steps and lean on repetition.'
  }
];

function getLeapContextForKid(kid, referenceDate, timezone) {
  var tz = timezone || getDefaultTimezone();
  var ageDays = calculateAgeDays(kid.birthdate || kid.date_of_birth, tz);
  var adjustedAgeDays = calculateAdjustedAgeDays(kid.due_date, tz);
  var basisAgeDays = adjustedAgeDays !== null ? adjustedAgeDays : ageDays;
  var window = null;

  for (var i = 0; i < LEAP_WINDOWS.length; i += 1) {
    if (basisAgeDays >= LEAP_WINDOWS[i].age_days_start && basisAgeDays <= LEAP_WINDOWS[i].age_days_end) {
      window = LEAP_WINDOWS[i];
      break;
    }
  }

  return {
    chronological_age_days: ageDays,
    adjusted_age_days: adjustedAgeDays,
    leap_age_days: basisAgeDays,
    leap_confidence: adjustedAgeDays !== null ? 'higher' : 'lower',
    in_leap_window: !!window,
    leap: window
  };
}

function buildLeapSupportLine(leapContext) {
  if (!leapContext || !leapContext.in_leap_window || !leapContext.leap) {
    return '';
  }

  return 'Your baby may be in a stormy developmental window. You might notice extra clinginess, fussiness, or disrupted sleep as new skills are wiring in.';
}
