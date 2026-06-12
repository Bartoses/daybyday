/**
 * Deterministic string hash — exact port of Config.js `hashString_`.
 * Java-style 32-bit rolling hash. Used for deterministic per-family/per-day
 * category rotation and child round-robin so the same inputs always yield the
 * same pick (no randomness in selection).
 */
export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return hash;
}
