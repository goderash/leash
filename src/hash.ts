// ─────────────────────────────────────────────────────────────────────────────
// SHA-256 hash chain (ported from recourse/src/hash.ts).
//
// Every receipt's hash = SHA-256( prevHash || canonicalJson(payload) ).
// A verifier walks the ledger in order and confirms no row has been mutated,
// removed, or reordered. The first receipt uses a deterministic genesis prevHash.
//
// This is what makes the leash log *tamper-evident*: if an agent (or anyone)
// edits or deletes a line after the fact, `leash verify` reports the break.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";

export const GENESIS_PREV_HASH = "0".repeat(64);

/** Deterministic JSON: keys sorted at every depth, undefined dropped, no whitespace. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) out[k] = sortDeep(v);
    return out;
  }
  return value;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Chained hash for a single receipt payload (pre-hash fields only). */
export function computeChainHash(prevHash: string, payload: unknown): string {
  return sha256Hex(`${prevHash}|${canonicalJson(payload)}`);
}

export type ChainVerification = { ok: boolean; firstBrokenIndex: number | null };

/** Walk receipts in sequence order and verify hash continuity. */
export function verifyChain<T extends { prevHash: string; hash: string }>(
  items: readonly T[],
  payloadOf: (item: T) => unknown,
): ChainVerification {
  let expectedPrev = GENESIS_PREV_HASH;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item === undefined) return { ok: false, firstBrokenIndex: i };
    if (item.prevHash !== expectedPrev) return { ok: false, firstBrokenIndex: i };
    const recomputed = computeChainHash(item.prevHash, payloadOf(item));
    if (recomputed !== item.hash) return { ok: false, firstBrokenIndex: i };
    expectedPrev = item.hash;
  }
  return { ok: true, firstBrokenIndex: null };
}
