/**
 * T2.1.1 — Knowledge sheet CSV reader.
 *
 * Accepts a CSV file exported from Google Sheets (UTF-8, first row = headers).
 * Skips columns prefixed "__unused__" to mirror Sheets.js ORM behaviour.
 * Returns fully-normalised ContentItemInsert rows ready for upsert.
 */

import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import { normalizeRow, type ContentItemInsert } from "./normalize.js";

export interface ReadResult {
  items: ContentItemInsert[];
  /** Total data rows in the CSV (excluding header). */
  totalRows: number;
  /** Rows that produced null from normalizeRow (missing required fields). */
  skippedRows: number;
}

/**
 * Parse a CSV file exported from the Knowledge Google Sheet.
 * Header row is lowercased + trimmed; "__unused__*" columns are excluded from lookup
 * so they don't accidentally shadow canonical names.
 */
export async function readCsvFile(filePath: string): Promise<ReadResult> {
  return new Promise((resolve, reject) => {
    const records: string[][] = [];

    const parser = createReadStream(filePath).pipe(
      parse({
        relax_quotes: true,
        skip_empty_lines: true,
        trim: true,
      }),
    );

    parser.on("data", (row: string[]) => {
      records.push(row);
    });

    parser.on("error", reject);

    parser.on("end", () => {
      if (records.length === 0) {
        resolve({ items: [], totalRows: 0, skippedRows: 0 });
        return;
      }

      // First row is headers — lowercase + trim to match GS normalisation.
      const rawHeaders = records[0] ?? [];
      const headers = rawHeaders.map((h) =>
        String(h ?? "")
          .trim()
          .toLowerCase(),
      );

      // Mask "__unused__*" columns so candidate lookup skips them.
      const maskedHeaders = headers.map((h) =>
        h.startsWith("__unused__") ? `__masked__${h}` : h,
      );

      const dataRows = records.slice(1);
      const items: ContentItemInsert[] = [];
      let skippedRows = 0;

      dataRows.forEach((row, i) => {
        // rowIndex is 1-based to match GS loop (starts at i=1 after header).
        const normalized = normalizeRow(maskedHeaders, row, i + 1);
        if (normalized) {
          items.push(normalized);
        } else {
          skippedRows++;
        }
      });

      resolve({ items, totalRows: dataRows.length, skippedRows });
    });
  });
}
