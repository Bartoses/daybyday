/**
 * Category rotation + topic-alias logic, ported from daily.js / knowledge_generator.js.
 *
 * Works in DB-canonical categories (the content_items enum), not the legacy
 * "learning/play" / "emotional development" strings. The importer already
 * normalises content to these values.
 */

import type { Category } from "@daybyday/schemas";
import { hashString } from "./hash.js";

/** The family-rotating categories, in legacy order, expressed as DB categories. */
export const ROTATING_CATEGORIES: readonly Category[] = [
  "development",
  "sleep",
  "learning_play",
  "feeding",
  "behavior",
  "emotional",
  "safety",
] as const;

/**
 * Port of `getRequestedTopicAliases_` in DB-category terms.
 * A request for "behavior" also matches "emotional" content (legacy folded
 * "behavior" + "emotional development" together for this lookup).
 */
export function requestedCategoryAliases(category: Category): Category[] {
  if (category === "behavior") return ["behavior", "emotional"];
  return [category];
}

/**
 * Deterministic family category rotation — port of
 * `resolveFamilyRequestedCategory_`. Given an explicit request it returns that;
 * otherwise it picks a category not used recently, seeded by parent + date so
 * the same family on the same day always gets the same category.
 *
 * @param explicit caller-supplied category (skips rotation when present)
 * @param parentId stable family id
 * @param dateKey YYYY-MM-DD in the family's timezone
 * @param recentCategories most-recent-first categories already shown
 * @param isDaily distinguishes the daily seed from the follow-up seed
 */
export function resolveFamilyCategory(
  explicit: Category | null,
  parentId: string,
  dateKey: string,
  recentCategories: Category[],
  isDaily: boolean,
): Category {
  if (explicit) return explicit;

  const lastCategory = recentCategories[0] ?? null;

  let available = ROTATING_CATEGORIES.filter(
    (c) => c !== lastCategory && !recentCategories.includes(c),
  );
  if (available.length === 0) {
    available = ROTATING_CATEGORIES.filter((c) => c !== lastCategory);
  }
  if (available.length === 0) {
    available = [...ROTATING_CATEGORIES];
  }
  if (available.length === 0) return "development";

  const seed = Math.abs(hashString(`${parentId}:${dateKey}:${isDaily ? "daily" : "followup"}`));
  return available[seed % available.length] as Category;
}

/**
 * Deterministic per-child topic choice — port of `chooseTopicForKid_`.
 * Rotates the distinct topics available for the child's age so recently-used
 * categories sink to the back, then picks by a child+date hash.
 *
 * @param childId stable child id
 * @param dateKey YYYY-MM-DD
 * @param availableTopics distinct categories present in the age-eligible pool
 * @param recentCategories most-recent-first categories already shown to this child
 */
export function chooseTopicForChild(
  childId: string,
  dateKey: string,
  availableTopics: Category[],
  recentCategories: Category[],
): Category {
  const topics = availableTopics.length > 0 ? [...availableTopics] : [...ROTATING_CATEGORIES];

  // Move recently-used categories to the back (legacy splice+push).
  for (const recent of recentCategories) {
    const idx = topics.indexOf(recent);
    if (idx !== -1) {
      topics.splice(idx, 1);
      topics.push(recent);
    }
  }

  const index = Math.abs(hashString(`${childId}:${dateKey}`)) % topics.length;
  return topics[index] as Category;
}
