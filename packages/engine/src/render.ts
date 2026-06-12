/**
 * Render payload + SMS length splitting — port of the render path in Guides.js
 * (buildChildSection / shortenAtSentenceBoundary / splitMessageIfNeeded).
 *
 * The app feed consumes the full (untruncated) fields; SMS uses the concise
 * caps + `splitSms` to chunk long multi-child messages into "Part x/n" parts.
 */

import type { Candidate } from "./score.js";

/** Legacy SMS limits (Config.js APP_CONFIG.sms). */
export const MAX_SMS_PART_LENGTH = 1200;

/** Concise caps used when rendering for SMS (buildChildSection). */
export const CAPS = {
  insight: 135,
  action: 110,
  reassurance: 60,
} as const;

export interface RenderedCard {
  tip_id: string;
  category: string;
  /** Full insight (app). */
  insight: string;
  /** Full action tip (app). */
  action_tip: string;
  /** Full reassurance (app). */
  reassurance: string;
  /** SMS-length variants (concise caps applied at sentence boundaries). */
  sms: {
    insight: string;
    action: string;
    reassurance: string;
  };
}

/** A content_items row with the renderable copy fields. */
export interface RenderableContent extends Candidate {
  insight: string;
  action_tip: string;
  reassurance: string;
}

function clean(text: string | null | undefined): string {
  return String(text ?? "").trim();
}

/** Ensure a string ends with terminal punctuation. Port of `ensureCompleteSentence`. */
function ensureCompleteSentence(text: string): string {
  const value = clean(text);
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

/**
 * Shorten text to <= maxLen, preferring a sentence boundary, then a word
 * boundary. Faithful port of `shortenAtSentenceBoundary` → `shortenAtWordBoundary`.
 */
export function shortenAtSentenceBoundary(text: string, maxLen: number): string {
  const value = clean(text);
  if (!value || value.length <= maxLen) return ensureCompleteSentence(value);

  const sentences = value.split(/(?<=[.!?])\s+/);
  let built = "";
  for (const s of sentences) {
    const candidate = built ? `${built} ${s}` : s;
    if (candidate.length <= maxLen) built = candidate;
    else break;
  }
  if (built) return ensureCompleteSentence(built);

  // No full sentence fits — fall back to word boundary.
  const words = value.split(/\s+/);
  built = "";
  for (const w of words) {
    const candidate = built ? `${built} ${w}` : w;
    if (candidate.length <= maxLen) built = candidate;
    else break;
  }
  return ensureCompleteSentence(built || value.slice(0, maxLen));
}

/** Strip a leading "Try this today:" / "Try this:" label. Port of `normalizeActionCopy_`. */
function normalizeAction(text: string): string {
  return clean(text)
    .replace(/^try this today:\s*/i, "")
    .replace(/^try this:\s*/i, "");
}

/** Build the render payload for a chosen content item. */
export function renderCard(content: RenderableContent): RenderedCard {
  const insight = clean(content.insight);
  const action = normalizeAction(content.action_tip);
  const reassurance = clean(content.reassurance);

  return {
    tip_id: content.tip_id,
    category: content.category,
    insight,
    action_tip: action,
    reassurance,
    sms: {
      insight: shortenAtSentenceBoundary(insight, CAPS.insight),
      action: shortenAtSentenceBoundary(action, CAPS.action),
      reassurance: shortenAtSentenceBoundary(reassurance, CAPS.reassurance),
    },
  };
}

/**
 * Split a long message body into <= maxPartLength chunks at sentence
 * boundaries, prefixing each with a "Part x/n" header when there's more than
 * one. Port of `splitMessageIfNeeded` + `addPartLabels_` (simplified to a single
 * body rather than the multi-child section builder).
 */
export function splitSms(body: string, maxPartLength: number = MAX_SMS_PART_LENGTH): string[] {
  const value = clean(body);
  if (!value) return [];
  if (value.length <= maxPartLength) return [value];

  // The "Part x/n" header costs characters; reserve room for it.
  const headerReserve = 12; // "Part 10/10\n\n"
  const budget = maxPartLength - headerReserve;

  const sentences = value.split(/(?<=[.!?])\s+/);
  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= budget) {
      current = candidate;
    } else {
      if (current) parts.push(current);
      // A single sentence longer than budget: hard-split on words.
      if (sentence.length > budget) {
        let chunk = "";
        for (const word of sentence.split(/\s+/)) {
          const c = chunk ? `${chunk} ${word}` : word;
          if (c.length <= budget) {
            chunk = c;
          } else {
            if (chunk) parts.push(chunk);
            chunk = word;
          }
        }
        current = chunk;
      } else {
        current = sentence;
      }
    }
  }
  if (current) parts.push(current);

  if (parts.length === 1) return parts;

  const total = parts.length;
  return parts.map((p, i) => `Part ${i + 1}/${total}\n\n${p}`);
}
