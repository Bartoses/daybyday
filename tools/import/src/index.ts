/**
 * CLI entry point for the Knowledge Sheet → content_items importer.
 *
 * Usage (from repo root):
 *   pnpm --filter @daybyday/import import -- --input /path/to/knowledge.csv
 *   pnpm --filter @daybyday/import import -- --input /path/to/knowledge.csv --parity
 *   pnpm --filter @daybyday/import import -- --input /path/to/knowledge.csv --dry-run
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (loaded from the
 * repo-root .env regardless of the package cwd).
 */

import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Load the repo-root .env (../../.env from tools/import/src), not the package cwd.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../.env") });

import { createClient } from "@supabase/supabase-js";
import { readCsvFile } from "./reader.js";
import { upsertContentItems, printParityReport } from "./upsert.js";
import { runParityCheck } from "./parity.js";

function parseArgs(argv: string[]): {
  input: string | null;
  dryRun: boolean;
  parity: boolean;
} {
  let input: string | null = null;
  let dryRun = false;
  let parity = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === "--input" || arg === "-i") && argv[i + 1]) {
      input = argv[++i]!;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--parity") {
      parity = true;
    }
  }

  return { input, dryRun, parity };
}

async function main(): Promise<void> {
  const { input, dryRun, parity } = parseArgs(process.argv.slice(2));

  if (!input) {
    console.error("Usage: import --input <knowledge.csv> [--dry-run] [--parity]");
    process.exit(1);
  }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
    process.exit(1);
  }

  console.log(`Reading CSV: ${input}`);
  const { items, totalRows, skippedRows } = await readCsvFile(input);

  console.log(`  Rows read:    ${totalRows}`);
  console.log(`  Valid rows:   ${items.length}`);
  console.log(`  Skipped rows: ${skippedRows}`);

  if (dryRun) {
    console.log("\n--dry-run: skipping DB write. First 3 items:");
    for (const item of items.slice(0, 3)) {
      console.log(JSON.stringify(item, null, 2));
    }
    return;
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const result = await upsertContentItems(client, items, { csvRows: totalRows, skippedRows });
  printParityReport(result);

  if (parity) {
    const ok = await runParityCheck(client, items);
    if (!ok) process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
