/**
 * T2.1.4 — Parity spot-check harness.
 *
 * Picks up to 20 random items from the normalised CSV data, fetches the corresponding
 * rows from content_items in Supabase, and verifies that key fields match.
 *
 * AC: fields match the sheet content for all 20 sampled rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentItemInsert } from "./normalize.js";

const SAMPLE_SIZE = 20;

const CHECK_FIELDS = [
  "tip_id",
  "category",
  "age_min_days",
  "age_max_days",
  "insight",
  "action_tip",
  "reassurance",
  "difficulty_level",
  "cooldown_days",
  "active",
] as const;

type CheckField = (typeof CHECK_FIELDS)[number];

interface FieldResult {
  field: CheckField;
  expected: unknown;
  actual: unknown;
  match: boolean;
}

interface SampleResult {
  tip_id: string;
  pass: boolean;
  fields: FieldResult[];
  dbMissing: boolean;
}

export async function runParityCheck(
  client: SupabaseClient,
  items: ContentItemInsert[],
): Promise<boolean> {
  if (items.length === 0) {
    console.log("Parity check: no items to check.");
    return true;
  }

  // Deterministic sample: spread evenly across the full set.
  const step = Math.max(1, Math.floor(items.length / SAMPLE_SIZE));
  const sample: ContentItemInsert[] = [];
  for (let i = 0; i < items.length && sample.length < SAMPLE_SIZE; i += step) {
    sample.push(items[i]!);
  }

  const tipIds = sample.map((s) => s.tip_id);

  const { data: dbRows, error } = await client
    .from("content_items")
    .select(CHECK_FIELDS.join(", "))
    .in("tip_id", tipIds);

  if (error) {
    console.error("Parity check DB fetch error:", error.message);
    return false;
  }

  const dbMap = new Map<string, Record<string, unknown>>();
  for (const row of dbRows ?? []) {
    const r = row as unknown as Record<string, unknown>;
    dbMap.set(String(r["tip_id"]), r);
  }

  const results: SampleResult[] = [];

  for (const expected of sample) {
    const dbRow = dbMap.get(expected.tip_id);
    if (!dbRow) {
      results.push({ tip_id: expected.tip_id, pass: false, fields: [], dbMissing: true });
      continue;
    }

    const fields: FieldResult[] = CHECK_FIELDS.map((field) => {
      const exp = expected[field];
      const act = dbRow[field];
      return { field, expected: exp, actual: act, match: String(exp) === String(act) };
    });

    results.push({
      tip_id: expected.tip_id,
      pass: fields.every((f) => f.match),
      fields,
      dbMissing: false,
    });
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);

  console.log(`\n=== Parity Spot-Check (${sample.length} samples) ===`);
  console.log(`  Passed: ${passed} / ${sample.length}`);

  if (failed.length > 0) {
    console.log(`  Failed: ${failed.length}`);
    for (const r of failed) {
      if (r.dbMissing) {
        console.log(`    [MISSING] ${r.tip_id} — not found in DB after upsert`);
        continue;
      }
      const mismatches = r.fields.filter((f) => !f.match);
      for (const f of mismatches) {
        console.log(
          `    [MISMATCH] ${r.tip_id}.${f.field}: expected=${JSON.stringify(f.expected)} actual=${JSON.stringify(f.actual)}`,
        );
      }
    }
  }

  console.log("=============================================\n");

  return failed.length === 0;
}
