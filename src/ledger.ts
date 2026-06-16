// ─────────────────────────────────────────────────────────────────────────────
// Append-only, hash-chained ledger stored as JSONL.
//
// One JSON object per line. Each line's hash chains off the previous line, so any
// edit, deletion, or reorder is detectable with `leash verify`. JSONL (not
// SQLite) keeps leash zero-dependency and the log greppable / diffable by hand.
// ─────────────────────────────────────────────────────────────────────────────

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { computeChainHash, GENESIS_PREV_HASH, verifyChain } from "./hash.ts";
import { payloadOf, type Receipt } from "./types.ts";

export class Ledger {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  /** Read every receipt in append order. Returns [] if the log doesn't exist. */
  readAll(): Receipt[] {
    if (!existsSync(this.path)) return [];
    const raw = readFileSync(this.path, "utf8");
    const out: Receipt[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      try {
        out.push(JSON.parse(trimmed) as Receipt);
      } catch {
        // A corrupt line is itself evidence of tampering; verify() will flag it.
      }
    }
    return out;
  }

  private lastReceipt(): Receipt | undefined {
    const all = this.readAll();
    return all[all.length - 1];
  }

  /**
   * Append one receipt, computing its sequence number and chain hash from the
   * current tail of the log. Returns the fully-formed, persisted receipt.
   */
  append(entry: Omit<Receipt, "seq" | "prevHash" | "hash">): Receipt {
    const prev = this.lastReceipt();
    const seq = prev ? prev.seq + 1 : 0;
    const prevHash = prev ? prev.hash : GENESIS_PREV_HASH;

    const withoutHash = { ...entry, seq };
    const hash = computeChainHash(prevHash, withoutHash);
    const receipt: Receipt = { ...withoutHash, prevHash, hash };

    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, `${JSON.stringify(receipt)}\n`, "utf8");
    return receipt;
  }

  /** Count receipts, optionally scoped to one session. */
  count(sessionId?: string): number {
    const all = this.readAll();
    return sessionId ? all.filter((r) => r.sessionId === sessionId).length : all.length;
  }

  /** Verify the full hash chain is intact. */
  verify() {
    return verifyChain(this.readAll(), payloadOf);
  }
}
