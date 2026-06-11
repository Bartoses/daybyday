export type { Database } from "./database.types.js";

/** Migration file order, exported so tooling/tests can assert it. */
export const MIGRATIONS = ["0001_core_schema.sql", "0002_reference.sql", "0003_rls.sql"] as const;
