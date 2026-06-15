/** Display + temporal-context helpers shared across screens. */

/** Neat, professional title-casing for names ("miles" → "Miles", "o'brien" → "O'Brien"). */
export function titleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-'])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function formatAge(days: number): string {
  if (days < 60) return `${days} days`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months`;
  const years = Math.floor(days / 365.25);
  return `${years} yr`;
}

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function wholeDaysBetween(a: Date, b: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((db - da) / ms);
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "th" : (s[n % 10] ?? "th");
  return `${n}${suffix}`;
}

function seasonNote(month: number, name: string): { emoji: string; text: string } {
  // Northern-hemisphere seasons (month is 0-indexed).
  if (month <= 1 || month === 11)
    return {
      emoji: "❄️",
      text: `Cozy winter days are perfect for indoor play and warm routines with ${name}.`,
    };
  if (month <= 4)
    return {
      emoji: "🌱",
      text: `Spring is here — a great time for ${name} to explore puddles, plants, and fresh air.`,
    };
  if (month <= 7)
    return {
      emoji: "☀️",
      text: `Summer days mean water play and shade-safe outdoor time for ${name}.`,
    };
  return {
    emoji: "🍂",
    text: `Autumn is a lovely time for crunchy leaves and slower, snuggly evenings with ${name}.`,
  };
}

export interface Moment {
  emoji: string;
  text: string;
}

/**
 * A warm, time-aware "moment" line for the child — surfaces the most relevant
 * of: birthday today, birthday soon, a monthly milestone, then a seasonal note.
 * Keeps the app feeling connected to where the child is in their life right now.
 */
export function contextualMoment(
  birthdate: string | null,
  rawName: string,
  now: Date = new Date(),
): Moment | null {
  if (!birthdate) return null;
  const name = titleCase(rawName) || "your little one";
  const birth = parseDateOnly(birthdate);
  const ageDays = wholeDaysBetween(birth, now);
  if (ageDays < 0) {
    return {
      emoji: "🤰",
      text: `Counting down to meeting ${name}. Rest and nourishment matter most now.`,
    };
  }

  const months = Math.floor(ageDays / 30.44);
  const isBirthdayToday = birth.getMonth() === now.getMonth() && birth.getDate() === now.getDate();
  const turningAge = now.getFullYear() - birth.getFullYear() + (isBirthdayToday ? 0 : 1);

  // Days until the next birthday.
  let nextBday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  if (wholeDaysBetween(now, nextBday) < 0)
    nextBday = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate());
  const daysToBday = wholeDaysBetween(now, nextBday);

  if (isBirthdayToday && turningAge >= 1) {
    return {
      emoji: "🎂",
      text: `Happy ${ordinal(turningAge)} birthday, ${name}! What a year of growing.`,
    };
  }
  if (daysToBday > 0 && daysToBday <= 14) {
    return {
      emoji: "🎂",
      text: `${name} turns ${turningAge} in ${daysToBday} ${daysToBday === 1 ? "day" : "days"} — a big milestone is coming.`,
    };
  }
  // Monthly "monthiversary" for the first two years (when months change fast).
  if (months >= 1 && months <= 24 && now.getDate() === birth.getDate()) {
    return { emoji: "✨", text: `${name} is ${months} months old today.` };
  }

  return seasonNote(now.getMonth(), name);
}
