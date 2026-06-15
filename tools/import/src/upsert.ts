/**
 * T2.1.3 — Dedupe by tip_id and upsert into content_items.
 *
 * Deduplication strategy: if the same tip_id appears multiple times in the sheet,
 * the last occurrence wins (mirrors legacy "last row in sheet wins" behaviour from
 * the GS index cache).
 *
 * Prints a parity report: CSV logical rows vs inserted/updated vs unchanged.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentItemInsert } from "./normalize.js";

export interface UpsertResult {
  csvRows: number;
  skippedRows: number;
  uniqueTipIds: number;
  upserted: number;
  errors: number;
}

/** Batch size for Supabase upsert calls (keeps payloads manageable). */
const BATCH_SIZE = 200;

/**
 * Deduplicates items by tip_id (last-occurrence wins) then upserts in batches.
 * Uses `onConflict: "tip_id"` so re-runs are idempotent.
 */
export async function upsertContentItems(
  client: SupabaseClient,
  items: ContentItemInsert[],
  { csvRows, skippedRows }: { csvRows: number; skippedRows: number },
): Promise<UpsertResult> {
  // Dedupe: iterate in order, last occurrence of a tip_id wins.
  const deduped = new Map<string, ContentItemInsert>();
  for (const item of items) {
    deduped.set(item.tip_id, item);
  }

  const uniqueItems = Array.from(deduped.values());
  const result: UpsertResult = {
    csvRows,
    skippedRows,
    uniqueTipIds: uniqueItems.length,
    upserted: 0,
    errors: 0,
  };

  // Upload in batches.
  for (let i = 0; i < uniqueItems.length; i += BATCH_SIZE) {
    const batch = uniqueItems.slice(i, i + BATCH_SIZE);
    const { error, count } = await client
      .from("content_items")
      .upsert(batch, { onConflict: "tip_id", count: "exact" });

    if (error) {
      console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      result.errors += batch.length;
    } else {
      result.upserted += count ?? batch.length;
    }
  }

  return result;
}

export function printParityReport(result: UpsertResult): void {
  console.log("\n=== Content Import Parity Report ===");
  console.log(`  CSV data rows:     ${result.csvRows}`);
  console.log(`  Skipped (invalid): ${result.skippedRows}`);
  console.log(`  Unique tip_ids:    ${result.uniqueTipIds}`);
  console.log(`  Duplicates merged: ${result.csvRows - result.skippedRows - result.uniqueTipIds}`);
  console.log(`  Upserted:          ${result.upserted}`);
  if (result.errors > 0) {
    console.log(`  Errors:            ${result.errors}`);
  }
  console.log("====================================\n");
}
