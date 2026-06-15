import Anthropic from "@anthropic-ai/sdk";
import type { AppConfig } from "../config.js";

/** Minimal child shape needed to give Day age-aware context. */
export interface DayChildContext {
  name: string;
  birthdate: string | null;
  due_date: string | null;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Whole months between two dates (calendar-aware, never negative). */
function monthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

/** Human age phrase for the prompt — "8 months old", "2 years old", or pre-birth. */
export function describeAge(child: DayChildContext, now: Date): string {
  if (!child.birthdate) {
    if (child.due_date) {
      const due = new Date(child.due_date);
      if (due.getTime() > now.getTime()) return "not yet born (you're expecting)";
    }
    return "age unknown";
  }
  const born = new Date(child.birthdate);
  const months = monthsBetween(born, now);
  if (months < 1) return "a newborn (under 1 month)";
  if (months < 24) return `${months} month${months === 1 ? "" : "s"} old`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years === 1 ? "" : "s"} old`;
  return `${years} year${years === 1 ? "" : "s"}, ${rem} month${rem === 1 ? "" : "s"} old`;
}

/**
 * System prompt for "Day" — DaybyDay's warm, practical parenting companion.
 * Injects the parent's name, each child's name + current age, and active focus
 * areas so replies are personal and age-appropriate. Bakes in the medical-deferral
 * guardrail from the build spec.
 */
export function buildSystemPrompt(
  parentName: string | null,
  children: DayChildContext[],
  focusAreas: string[],
  now: Date,
): string {
  const name = parentName?.trim() ? titleCase(parentName.trim()) : "this parent";

  const kids =
    children.length > 0
      ? children.map((c) => `- ${titleCase(c.name)}, ${describeAge(c, now)}`).join("\n")
      : "- (no children added yet)";

  const focus =
    focusAreas.length > 0 ? `They told us they care most about: ${focusAreas.join(", ")}.` : "";

  return [
    `You are Day, the warm, practical parenting companion inside the DaybyDay app.`,
    `You're talking with ${name}.`,
    ``,
    `Their child${children.length === 1 ? "" : "ren"}:`,
    kids,
    focus,
    ``,
    `How to help:`,
    `- Be warm, calm, and encouraging — like a knowledgeable friend who's been there. Never preachy or clinical.`,
    `- Keep answers short and skimmable: a tired parent is reading this on a phone, often one-handed. Lead with the most useful thing. A few sentences or a short list is usually plenty.`,
    `- Tailor advice to the child's exact age and stage above. Use the child's name when it feels natural.`,
    `- Be concrete and actionable — "try this tonight" beats abstract theory.`,
    `- Normalize the hard parts of parenting; reassure without dismissing real concerns.`,
    ``,
    `Safety — this matters:`,
    `- You are a helper, not a doctor. Never diagnose, and never give medical, medication, or dosing advice.`,
    `- For anything about a child's health, development concerns, injuries, or safety, gently encourage ${name} to check with their pediatrician or a qualified professional. If something sounds urgent or like an emergency, say so plainly and tell them to seek immediate care.`,
    `- Stay within parenting, family life, routines, feeding, sleep, behavior, play, and child development.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Build the Anthropic client, or null when no API key is configured. */
export function makeDayClient(config: AppConfig): Anthropic | null {
  if (!config.day.apiKey) return null;
  return new Anthropic({ apiKey: config.day.apiKey });
}
